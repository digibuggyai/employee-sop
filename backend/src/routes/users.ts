import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { todayString } from "../lib/dates.js";
import { hashPassword, requireAdmin, requireAuth } from "../lib/auth.js";
import { sendMail } from "../lib/mailer.js";
import { passwordResetEmail, welcomeEmail } from "../lib/emails.js";

const router = Router();

// Every route in this file: must be logged in AND an admin.
router.use(requireAuth, requireAdmin);

const isSuperAdmin = (req: Request) => req.user!.role === "SUPER_ADMIN";

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
  role: z.enum(["EMPLOYEE", "ADMIN", "SUPER_ADMIN"]),
  // false = not tracked (no attendance, leave or WFH). Optional: the database defaults it to true.
  isEmployee: z.boolean().optional(),
  employmentType: z.enum(["FULL_TIME", "INTERN", "REMOTE_INTERN"]),
  phone: optionalText,
  designation: optionalText,
  team: optionalText,
  office: optionalText,
  timings: optionalText,
  birthday: optionalDate,
  joinedOn: optionalDate,
  leftOn: optionalDate, // last working day, for someone who has left
  // z.coerce turns the form's "4" (text) into the number 4
  wfhAllowance: z.coerce.number().int().min(0, "WFH days can't be negative").max(31),
  // empty in the form = no weekly target
  weeklyHours: z
    .preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1, "Weekly hours must be at least 1").max(100).nullable())
    .optional(),
};

// GET /api/users → everyone, active first, then A–Z
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  res.json(users);
});

const createSchema = z.object({
  ...profileFields,
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
  notify: z.boolean().default(true), // email the login details to the new employee
});

// POST /api/users → admin creates an account with a temporary password
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, notify, ...profile } = parsed.data;

  if (profile.role !== "EMPLOYEE" && !isSuperAdmin(req)) {
    return res.status(403).json({ error: "Only a Super admin can create admin accounts" });
  }
  if (await prisma.user.findUnique({ where: { email: profile.email } })) {
    return res.status(409).json({ error: "Someone already uses this email" });
  }

  const user = await prisma.user.create({
    data: { ...profile, passwordHash: await hashPassword(password), mustChangePassword: true },
  });

  // The account exists now. Emailing is a bonus: if it fails, the admin is told and can share the
  // password themselves, so a mail problem never blocks creating an account.
  const mail = notify ? await sendMail({ to: user.email, ...welcomeEmail(user.name, user.email, password) }) : null;
  res.status(201).json({ ...user, mail });
});

// For edits every field is optional (.partial()), plus active and an optional password reset.
const updateSchema = z
  .object({
    ...profileFields,
    active: z.boolean(),
    password: z.string().min(8, "New password must be at least 8 characters"),
    notify: z.boolean(), // email the new password (only used together with password)
  })
  .partial();

// PATCH /api/users/:id → edit profile, change role, deactivate, or reset password
router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, notify = true, ...changes } = parsed.data;
  const id = req.params.id;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "User not found" });
  const self = id === req.user!.id;
  const roleChange = changes.role !== undefined && changes.role !== target.role;

  // Stop admins from locking themselves out by accident.
  if (self && (changes.active === false || roleChange)) {
    return res.status(400).json({ error: "You can't deactivate yourself or change your own role" });
  }
  // A plain admin manages employees only: admin accounts (other than their own profile)
  // and every role change belong to the Super admins.
  if (!isSuperAdmin(req) && ((!self && target.role !== "EMPLOYEE") || roleChange)) {
    return res.status(403).json({ error: "Only a Super admin can change admin accounts or roles" });
  }
  if (changes.email) {
    const other = await prisma.user.findUnique({ where: { email: changes.email } });
    if (other && other.id !== id) return res.status(409).json({ error: "Someone already uses this email" });
  }

  // Leaving: deactivating without a last working day means they left today.
  // Coming back: reactivating clears it.
  if (changes.active === false && changes.leftOn === undefined && !target.leftOn) changes.leftOn = new Date(todayString());
  if (changes.active === true) changes.leftOn = null;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...changes,
      // A reset password is temporary again, so they must change it at next login.
      ...(password && { passwordHash: await hashPassword(password), mustChangePassword: true }),
    },
  });

  // Only a password reset sends an email; normal profile edits don't.
  const mail =
    password && notify ? await sendMail({ to: user.email, ...passwordResetEmail(user.name, user.email, password) }) : null;
  res.json({ ...user, mail });
});

export default router;
