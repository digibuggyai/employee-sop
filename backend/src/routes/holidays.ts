import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { holidayList, holidayOn, loadHolidays } from "../lib/holidays.js";
import { syncMakeUps } from "../lib/makeups.js";

const router = Router();

router.get("/", (req, res) => {
  const list = holidayList();
  if (req.query.upcoming) return res.json(list.filter((h) => h.date >= todayString()));
  if (typeof req.query.year === "string") return res.json(list.filter((h) => h.date.startsWith(req.query.year as string)));
  res.json(list);
});

async function resync() {
  const people = await prisma.user.findMany({ where: { isEmployee: true }, select: { id: true } });
  for (const p of people) await syncMakeUps(p.id);
}

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      date: z.iso.date({ error: "Pick a date" }),
      name: z.string().trim().min(2, "Give the holiday a name").max(60),
      type: z.enum(["Gazetted", "Compulsory"]).default("Gazetted"),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { date, name, type } = parsed.data;
  if (holidayOn(date)) return res.status(409).json({ error: "That day is already a holiday" });

  const holiday = await prisma.holiday.create({ data: { date: toDbDate(date), name, type } });
  const { count: leavesRemoved } = await prisma.leave.deleteMany({ where: { date: toDbDate(date) } });
  await loadHolidays();
  await resync();
  res.status(201).json({ id: holiday.id, date, name, type, leavesRemoved });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { count } = await prisma.holiday.deleteMany({ where: { id: String(req.params.id) } });
  if (!count) return res.status(404).json({ error: "Holiday not found" });
  await loadHolidays();
  await resync();
  res.json({ ok: true });
});

export default router;
