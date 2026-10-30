import type { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import type { User } from "../generated/prisma/client.js";

export type SafeUser = Omit<User, "passwordHash">;

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set (locally: backend/.env, on Railway: the service's Variables tab)");

export const COOKIE_NAME = "token";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const checkPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const signToken = (userId: string) => jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: WEEK_MS,
  path: "/",
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not logged in" });

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET!) as jwt.JwtPayload;
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
  const userId = payload.sub!;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return res.status(401).json({ error: "Account not active" });

  if (Date.now() / 1000 - (payload.iat ?? 0) > 24 * 60 * 60) {
    res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions);
  }

  req.user = user;
  next();
}

export const isAdmin = (user: { role: string }) => user.role === "ADMIN" || user.role === "SUPER_ADMIN";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isAdmin(req.user)) return res.status(403).json({ error: "Admins only" });
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Super admins only" });
  next();
}
