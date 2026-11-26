import type { CookieOptions, NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
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
if (!JWT_SECRET || JWT_SECRET === "change-me") {
  throw new Error("JWT_SECRET is not set (locally: backend/.env, on Railway: the service's Variables tab)");
}
if (JWT_SECRET.length < 32) console.warn("JWT_SECRET is short. Use at least 32 random characters.");

export const COOKIE_NAME = "token";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const checkPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

const passwordStamp = (passwordHash: string) => crypto.createHmac("sha256", JWT_SECRET).update(passwordHash).digest("base64url").slice(0, 16);

export const signToken = (userId: string, passwordHash: string) =>
  jwt.sign({ sub: userId, pv: passwordStamp(passwordHash) }, JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
export const burnPasswordCheck = (plain: string) => bcrypt.compare(plain, DUMMY_HASH);

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
    payload = jwt.verify(token, JWT_SECRET!, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
  const userId = payload.sub!;

  const found = await prisma.user.findUnique({ where: { id: userId }, omit: { passwordHash: false } });
  if (!found || !found.active) return res.status(401).json({ error: "Account not active" });
  if (payload.pv !== passwordStamp(found.passwordHash)) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
  const { passwordHash, ...user } = found;

  if (Date.now() / 1000 - (payload.iat ?? 0) > 24 * 60 * 60) {
    res.cookie(COOKIE_NAME, signToken(user.id, passwordHash), cookieOptions);
  }

  const viewAs = req.get("x-view-as");
  if (viewAs && viewAs !== user.id && isAdmin(user)) {
    if (req.method !== "GET") return res.status(403).json({ error: "You are previewing someone else. Exit the preview to make changes." });
    const target = await prisma.user.findUnique({ where: { id: viewAs } });
    if (!target || !target.active) return res.status(404).json({ error: "That person was not found" });
    if (target.role !== "EMPLOYEE" && user.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Only Super admins can preview admins" });
    req.user = target;
    return next();
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
