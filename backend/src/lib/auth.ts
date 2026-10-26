import type { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import type { User } from "../generated/prisma/client.js";

// The logged-in user, without the password hash.
export type SafeUser = Omit<User, "passwordHash">;

// Teach TypeScript that `req.user` exists (set by requireAuth below).
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

// ---------- Passwords ----------
// bcrypt turns "Secret123" into "$2b$10$Xk2...": a one-way scramble. We store only that.
// To check a login we scramble the typed password the same way and compare.
export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const checkPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// ---------- Login token (JWT) ----------
// A JWT is a small signed note: { sub: userId }. Only the server knows JWT_SECRET,
// so nobody can forge or edit one; changing even one character breaks the signature.
export const signToken = (userId: string) => jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });

// The token travels in a cookie the browser sends automatically with every request.
export const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the page can't read it, so an XSS bug can't steal it
  sameSite: "lax", // not sent on requests made from other websites
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  maxAge: WEEK_MS,
  path: "/",
};

// ---------- Middleware ----------
// Put requireAuth in front of any route that needs a logged-in user.
// It reads the cookie → verifies the JWT → loads the user → puts it on req.user.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not logged in" });

  let userId: string;
  try {
    userId = (jwt.verify(token, JWT_SECRET!) as jwt.JwtPayload).sub!;
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }

  // Always re-check the database: an admin may have deactivated this person since they logged in.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return res.status(401).json({ error: "Account not active" });

  req.user = user;
  next(); // continue to the actual route
}

// Use after requireAuth: only admins get through.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admins only" });
  next();
}
