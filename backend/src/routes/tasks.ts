import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { firstName, notify } from "../lib/notify.js";
import { TASK_NOTE_MIN_WORDS, wordCount } from "../lib/policy.js";

const router = Router();
router.use(requireAuth);

export const taskInclude = {
  user: { select: { id: true, name: true, photoUpdatedAt: true } },
  assignedBy: { select: { id: true, name: true } },
};

const optionalText = z.string().trim().nullable().optional().transform((v) => v || null);
const optionalDate = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? toDbDate(v) : null));

const taskFields = {
  title: z.string().trim().min(1, "Write what the task is"),
  details: optionalText,
  link: optionalText,
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "POSTPONED"]),
  deadline: optionalDate,
};

const completedAtFor = (status?: string) =>
  status === undefined ? {} : { completedAt: status === "COMPLETED" ? new Date() : null };

router.get("/", async (req, res) => {
  const month = todayString().slice(0, 7);
  const from = typeof req.query.from === "string" ? req.query.from : `${month}-01`;
  const to = typeof req.query.to === "string" ? req.query.to : todayString();
  const tasks = await prisma.task.findMany({
    where: { userId: req.user!.id, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    include: taskInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  res.json(tasks);
});

const createSchema = z.object({
  ...taskFields,
  date: z.iso.date().optional(),
  userId: z.string().optional(),
});

export const taskNoteSelect = { id: true, date: true, text: true, createdAt: true, updatedAt: true } as const;

router.get("/note", async (req, res) => {
  const date = z.iso.date().catch(() => todayString()).parse(req.query.date);
  const note = await prisma.dailyTaskNote.findUnique({
    where: { userId_date: { userId: req.user!.id, date: toDbDate(date) } },
    select: taskNoteSelect,
  });
  res.json({ date, minWords: TASK_NOTE_MIN_WORDS, note });
});

router.put("/note", async (req, res) => {
  const parsed = z
    .object({ text: z.string().trim().max(10000) })
    .refine((v) => wordCount(v.text) >= TASK_NOTE_MIN_WORDS, `Write at least ${TASK_NOTE_MIN_WORDS} words`)
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const date = toDbDate(todayString());
  const note = await prisma.dailyTaskNote.upsert({
    where: { userId_date: { userId: req.user!.id, date } },
    update: { text: parsed.data.text },
    create: { userId: req.user!.id, date, text: parsed.data.text },
    select: taskNoteSelect,
  });
  res.json(note);
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { userId, date, ...fields } = parsed.data;
  const me = req.user!;

  const ownerId = userId ?? me.id;
  if (ownerId !== me.id && !isAdmin(me)) {
    return res.status(403).json({ error: "Only admins can assign tasks to others" });
  }

  const task = await prisma.task.create({
    data: {
      ...fields,
      ...completedAtFor(fields.status),
      userId: ownerId,
      assignedById: ownerId === me.id ? null : me.id,
      date: toDbDate(date ?? todayString()),
    },
    include: taskInclude,
  });
  if (ownerId !== me.id) await notify(ownerId, { title: `New task from ${firstName(me.name)}`, body: task.title, link: "/tasks" });
  res.status(201).json(task);
});

async function findEditable(id: string, user: { id: string; role: string }) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { ok: false, status: 404, message: "Task not found" } as const;
  if (task.userId !== user.id && !isAdmin(user)) return { ok: false, status: 403, message: "Not your task" } as const;
  return { ok: true, task } as const;
}

router.patch("/:id", async (req, res) => {
  const parsed = z.object(taskFields).partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const found = await findEditable(req.params.id, req.user!);
  if (!found.ok) return res.status(found.status).json({ error: found.message });

  const task = await prisma.task.update({
    where: { id: found.task.id },
    data: { ...parsed.data, ...completedAtFor(parsed.data.status) },
    include: taskInclude,
  });
  res.json(task);
});

router.delete("/:id", async (req, res) => {
  const found = await findEditable(req.params.id, req.user!);
  if (!found.ok) return res.status(found.status).json({ error: found.message });
  if (found.task.assignedById && !isAdmin(req.user!)) {
    return res.status(403).json({ error: "Tasks assigned by an admin can't be deleted, mark them Postponed instead" });
  }
  await prisma.task.delete({ where: { id: found.task.id } });
  res.json({ ok: true });
});

export default router;
