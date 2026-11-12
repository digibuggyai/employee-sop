import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { monthReports, thisMonth } from "../lib/reports.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const people = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      photoUpdatedAt: true,
      email: true,
      phone: true,
      designation: true,
      employmentType: true,
      team: true,
      office: true,
      timings: true,
      birthday: true,
    },
  });
  res.json(people);
});

router.get("/:id", requireAuth, async (req, res) => {
  const admin = isAdmin(req.user!);
  const person = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      name: true,
      photoUpdatedAt: true,
      email: true,
      phone: true,
      designation: true,
      employmentType: true,
      team: true,
      office: true,
      timings: true,
      birthday: true,
      joinedOn: true,
      active: true,
      role: true,
      leftOn: true,
      wfhAllowance: true,
      weeklyHours: true,
      isEmployee: true,
    },
  });
  if (!person || (!person.active && !admin)) return res.status(404).json({ error: "Person not found" });

  const { role, leftOn, wfhAllowance, weeklyHours, isEmployee, ...basic } = person;
  if (!admin) return res.json(basic);

  const [today, report] = await Promise.all([
    prisma.attendance.findUnique({
      where: { userId_date: { userId: person.id, date: toDbDate(todayString()) } },
      select: { place: true, checkIn: true, checkOut: true },
    }),
    isEmployee ? monthReports([person.id], thisMonth()).then((r) => r.get(person.id)!.summary) : Promise.resolve(null),
  ]);
  res.json({ ...basic, role, leftOn, wfhAllowance, weeklyHours, isEmployee, today, month: report });
});

export default router;
