import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  COOKIE_NAME,
  checkPassword,
  cookieOptions,
  hashPassword,
  requireAuth,
  signToken,
} from "../lib/auth.js";

const router = Router();

// zod describes what a valid request body looks like and rejects anything else.
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password"),
});

// POST /api/auth/login   body: { email, password }
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password } = parsed.data;

  // passwordHash is hidden by default (see lib/prisma.ts), so ask for it explicitly here.
  const user = await prisma.user.findUnique({ where: { email }, omit: { passwordHash: false } });

  // Same message whether the email or the password is wrong, so nobody can probe which emails exist.
  if (!user || !user.active || !(await checkPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.cookie(COOKIE_NAME, signToken(user.id), cookieOptions);
  const { passwordHash: _, ...safeUser } = user; // copy everything except the hash
  res.json(safeUser);
});

// POST /api/auth/logout → delete the cookie
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// GET /api/auth/me → who am I? (the frontend calls this on every page load)
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// POST /api/auth/change-password   body: { currentPassword, newPassword }
router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    omit: { passwordHash: false },
  });
  if (!(await checkPassword(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "Current password is wrong" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  res.json(updated);
});

export default router;
