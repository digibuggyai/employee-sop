import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { todayString } from "../lib/dates.js";
import { parseTimings } from "../lib/policy.js";
import { hashPassword, requireAdmin, requireAuth } from "../lib/auth.js";
import { sendMail } from "../lib/mailer.js";
import { passwordResetEmail, welcomeEmail } from "../lib/emails.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const isSuperAdmin = (req: Request) => req.user!.role === "SUPER_ADMIN";

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

const profileFields = {
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  role: z.enum(["EMPLOYEE", "ADMIN", "SUPER_ADMIN"]),
  isEmployee: z.boolean().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "INTERN", "REMOTE_INTERN"]),
  phone: optionalText,
  designation: optionalText,
  team: optionalText,
  office: optionalText,
  timings: optionalText.refine((v) => !v || parseTimings(v), "Write timings like 11:30 to 6:00"),
  birthday: optionalDate,
  joinedOn: optionalDate,
  leftOn: optionalDate,
  wfhAllowance: z.coerce.number().int().min(0, "WFH days can't be negative").max(31),
  leaveOpening: z.coerce.number().min(0, "Leave balance can't be negative").max(60).optional(),
  weeklyHours: z
    .preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1, "Weekly hours must be at least 1").max(100).nullable())
    .optional(),
};

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  res.json(users);
});

const createSchema = z.object({
  ...profileFields,
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
  notify: z.boolean().default(true),
});

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

  const mail = notify ? await sendMail({ to: user.email, ...welcomeEmail(user.name, user.email, password) }) : null;
  res.status(201).json({ ...user, mail });
});

const updateSchema = z
  .object({
    ...profileFields,
    active: z.boolean(),
    password: z.string().min(8, "New password must be at least 8 characters"),
    notify: z.boolean(),
  })
  .partial();

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { password, notify = true, ...changes } = parsed.data;
  const id = req.params.id;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "User not found" });
  const self = id === req.user!.id;
  const roleChange = changes.role !== undefined && changes.role !== target.role;

  if (self && (changes.active === false || roleChange)) {
    return res.status(400).json({ error: "You can't deactivate yourself or change your own role" });
  }
  if (!isSuperAdmin(req) && ((!self && target.role !== "EMPLOYEE") || roleChange)) {
    return res.status(403).json({ error: "Only a Super admin can change admin accounts or roles" });
  }
  if (changes.email) {
    const other = await prisma.user.findUnique({ where: { email: changes.email } });
    if (other && other.id !== id) return res.status(409).json({ error: "Someone already uses this email" });
  }

  if (changes.active === false && changes.leftOn === undefined && !target.leftOn) changes.leftOn = new Date(todayString());
  if (changes.active === true) changes.leftOn = null;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...changes,
      ...(password && { passwordHash: await hashPassword(password), mustChangePassword: true }),
    },
  });

  const mail =
    password && notify ? await sendMail({ to: user.email, ...passwordResetEmail(user.name, user.email, password) }) : null;
  res.json({ ...user, mail });
});

export default router;
