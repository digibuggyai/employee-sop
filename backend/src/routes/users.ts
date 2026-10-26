import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, requireAdmin, requireAuth } from "../lib/auth.js";

const router = Router();

// Every route in this file: must be logged in AND an admin.
router.use(requireAuth, requireAdmin);

// "YYYY-MM-DD" from a form → Date for the database. Empty → null.
const optionalDate = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : v === undefined ? undefined : null));
const optionalText = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

// The profile fields an admin can fill in (shared by create and edit).
const profileFields = {
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  role: z.enum(["EMPLOYEE", "ADMIN"]),
  employmentType: z.enum(["FULL_TIME", "INTERN", "REMOTE_INTERN"]),
  phone: optionalText,
  designation: optionalText,
  team: optionalText,
  office: optionalText,
  timings: optionalText,
  birthday: optionalDate,
  joinedOn: optionalDate,
  // z.coerce turns the form's "4" (text) into the number 4
  wfhAllowance: z.coerce.number().int().min(0, "WFH days can't be negative").max(31),
};

// GET /api/users → everyone, active first, then A–Z
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  res.json(users);
});

const createSchema = z.object({
  ...profileFields,
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
});

// POST /api/users → admin creates an account with a temporary password
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, ...profile } = parsed.data;

  if (await prisma.user.findUnique({ where: { email: profile.email } })) {
    return res.status(409).json({ error: "Someone already uses this email" });
  }

  const user = await prisma.user.create({
    data: { ...profile, passwordHash: await hashPassword(password), mustChangePassword: true },
  });
  res.status(201).json(user);
});

// For edits every field is optional (.partial()), plus active and an optional password reset.
const updateSchema = z
  .object({
    ...profileFields,
    active: z.boolean(),
    password: z.string().min(8, "New password must be at least 8 characters"),
  })
  .partial();

// PATCH /api/users/:id → edit profile, change role, deactivate, or reset password
router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, ...changes } = parsed.data;
  const id = req.params.id;

  // Stop admins from locking themselves out by accident.
  if (id === req.user!.id && (changes.active === false || changes.role === "EMPLOYEE")) {
    return res.status(400).json({ error: "You can't deactivate or demote yourself" });
  }

  if (!(await prisma.user.findUnique({ where: { id } }))) {
    return res.status(404).json({ error: "User not found" });
  }
  if (changes.email) {
    const other = await prisma.user.findUnique({ where: { email: changes.email } });
    if (other && other.id !== id) return res.status(409).json({ error: "Someone already uses this email" });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...changes,
      // A reset password is temporary again, so they must change it at next login.
      ...(password && { passwordHash: await hashPassword(password), mustChangePassword: true }),
    },
  });
  res.json(user);
});

export default router;
