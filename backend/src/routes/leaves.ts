import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { toDbDate } from "../lib/dates.js";
import { isOffDay, monthReports, thisMonth } from "../lib/reports.js";

const router = Router();
router.use(requireAuth);

// What we send back for a leave: the leave + who reviewed it
export const leaveInclude = { reviewedBy: { select: { id: true, name: true } } };

// Every working day from `from` to `to` (weekends and holidays don't need leave)
export function workingDaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    if (!isOffDay(date)) out.push(date);
  }
  return out;
}

// GET /api/leaves → my leave days (newest first) + my WFH usage this month
router.get("/", async (req, res) => {
  const me = req.user!;
  const [leaves, report] = await Promise.all([
    prisma.leave.findMany({ where: { userId: me.id }, include: leaveInclude, orderBy: { date: "desc" }, take: 100 }),
    monthReports([me.id], thisMonth()),
  ]);
  const s = report.get(me.id)!.summary;
  res.json({ leaves, wfh: { used: s.wfh, allowance: s.wfhAllowance, halfDays: s.halfDays } });
});

const requestSchema = z
  .object({
    from: z.iso.date("Pick a start date"),
    to: z.iso.date("Pick an end date"),
    reason: z.string().trim().min(3, "Write a short reason").max(500),
  })
  .refine((v) => v.to >= v.from, "End date can't be before the start date");

// POST /api/leaves  { from, to, reason } → one PENDING row per working day in the range
router.post("/", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { from, to, reason } = parsed.data;

  const dates = workingDaysBetween(from, to);
  if (dates.length === 0) return res.status(400).json({ error: "Those dates are all weekends or holidays" });
  if (dates.length > 31) return res.status(400).json({ error: "Request at most a month at a time" });

  // skipDuplicates: days that already have a leave row (any status) are left alone
  const { count } = await prisma.leave.createMany({
    data: dates.map((d) => ({ userId: req.user!.id, date: toDbDate(d), reason })),
    skipDuplicates: true,
  });
  if (count === 0) return res.status(409).json({ error: "You've already requested leave for those days" });
  res.status(201).json({ created: count, skipped: dates.length - count });
});

// DELETE /api/leaves/:id → cancel my own request while it's still pending
router.delete("/:id", async (req, res) => {
  const leave = await prisma.leave.findUnique({ where: { id: req.params.id } });
  if (!leave || leave.userId !== req.user!.id) return res.status(404).json({ error: "Leave not found" });
  if (leave.status !== "PENDING") return res.status(400).json({ error: "Only pending requests can be cancelled" });
  await prisma.leave.delete({ where: { id: leave.id } });
  res.json({ ok: true });
});

export default router;
