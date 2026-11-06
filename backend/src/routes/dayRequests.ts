import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { isOffDay } from "../lib/reports.js";
import { firstName, notify, notifyAdmins } from "../lib/notify.js";
import { REPORT_MIN_CHARS } from "../lib/policy.js";

const router = Router();
router.use(requireAuth);

export const kindLabel = {
  WFH: "WFH",
  HALF_DAY: "Half day",
  SHORT_LEAVE: "Short leave",
  LATE_EARLY: "Late/early",
  WFH_REPORT: "WFH report",
} as const;

const include = {
  user: { select: { id: true, name: true, photoUpdatedAt: true } },
  reviewedBy: { select: { id: true, name: true } },
};

const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM for the time").nullable().optional();
const monthParam = z.string().regex(/^\d{4}-\d{2}$/);

router.get("/", async (req, res) => {
  const requests = await prisma.dayRequest.findMany({
    where: { userId: req.user!.id },
    include,
    orderBy: { date: "desc" },
    take: 100,
  });
  res.json(requests);
});

router.post("/", async (req, res) => {
  const parsed = z
    .object({
      kind: z.enum(["WFH", "HALF_DAY", "SHORT_LEAVE", "WFH_REPORT"]),
      date: z.iso.date({ error: "Pick a date" }),
      time: timeSchema,
      reason: z.string({ error: "Give a short reason" }).trim().min(3, "Give a short reason").max(5000),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { kind, date, time, reason } = parsed.data;
  const me = req.user!;

  if (kind === "WFH_REPORT") {
    if (reason.length < REPORT_MIN_CHARS) return res.status(400).json({ error: "Write what you got done that day" });
    const day = await prisma.attendance.findUnique({ where: { userId_date: { userId: me.id, date: toDbDate(date) } } });
    if (!day || day.place !== "WFH") return res.status(400).json({ error: "You didn't work from home that day" });
    if (day.report?.trim()) return res.status(400).json({ error: "That day already has a report" });
  } else {
    if (date < todayString()) return res.status(400).json({ error: "Ask before the day. For a past day, talk to your admin." });
    if (isOffDay(date, me.employmentType)) return res.status(400).json({ error: "That day is already off" });
    if (kind === "WFH" && me.employmentType === "REMOTE_INTERN") {
      return res.status(400).json({ error: "Remote interns don't need WFH approval" });
    }
    const leave = await prisma.leave.findFirst({ where: { userId: me.id, date: toDbDate(date), status: { not: "REJECTED" } } });
    if (leave) return res.status(409).json({ error: "You already have leave on that day" });
  }

  const existing = await prisma.dayRequest.findUnique({ where: { userId_date_kind: { userId: me.id, date: toDbDate(date), kind } } });
  if (existing && existing.status === "PENDING") {
    return res.status(409).json({ error: `You already asked for ${kindLabel[kind].toLowerCase()} on that day` });
  }
  if (existing && existing.status === "APPROVED") return res.status(409).json({ error: `Your ${kindLabel[kind].toLowerCase()} on that day is already approved` });

  const data = { reason, time: time || null, status: "PENDING" as const, reviewedById: null, reviewedAt: null };
  const saved = existing
    ? await prisma.dayRequest.update({ where: { id: existing.id }, data, include })
    : await prisma.dayRequest.create({ data: { ...data, userId: me.id, date: toDbDate(date), kind }, include });

  await notifyAdmins(
    {
      title: kind === "WFH_REPORT" ? `${me.name} sent a missing WFH report` : `${me.name} asked for ${kindLabel[kind].toLowerCase()}`,
      body: `${dayLabel(saved.date)}${time ? ` · ${time}` : ""} · ${reason.slice(0, 200)}`,
      link: "/admin/leaves",
    },
    me.id,
  );
  res.status(201).json(saved);
});

router.delete("/:id", async (req, res) => {
  const r = await prisma.dayRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!r || r.userId !== req.user!.id) return res.status(404).json({ error: "Request not found" });
  const future = r.date.toISOString().slice(0, 10) >= todayString();
  if (r.status === "REJECTED" || (r.status === "APPROVED" && (!future || r.kind === "WFH_REPORT"))) {
    return res.status(400).json({ error: "Only pending requests, or approved ones for today or later, can be withdrawn" });
  }
  await prisma.dayRequest.delete({ where: { id: r.id } });
  if (r.status === "APPROVED") {
    await notifyAdmins({ title: `${req.user!.name} withdrew a ${kindLabel[r.kind].toLowerCase()}`, body: dayLabel(r.date), link: "/admin/leaves" }, r.userId);
  }
  res.json({ ok: true });
});

router.get("/admin", requireAdmin, async (req, res) => {
  const month = monthParam.safeParse(req.query.month);
  if (month.success) {
    const [y, m] = month.data.split("-").map(Number);
    const requests = await prisma.dayRequest.findMany({
      where: { status: { not: "PENDING" }, date: { gte: toDbDate(`${month.data}-01`), lte: new Date(Date.UTC(y, m, 0)) } },
      include,
      orderBy: [{ date: "desc" }],
    });
    return res.json(requests);
  }
  const requests = await prisma.dayRequest.findMany({ where: { status: "PENDING" }, include, orderBy: { date: "asc" } });
  res.json(requests);
});

router.post("/record", requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      userId: z.string(),
      kind: z.enum(["HALF_DAY", "SHORT_LEAVE", "LATE_EARLY", "WFH"]),
      date: z.iso.date({ error: "Pick a date" }),
      time: timeSchema,
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { userId, kind, date, time, reason } = parsed.data;
  const person = await prisma.user.findUnique({ where: { id: userId }, select: { employmentType: true } });
  if (!person) return res.status(404).json({ error: "Employee not found" });
  if (isOffDay(date, person.employmentType)) return res.status(400).json({ error: "That day is off for them" });

  const data = {
    reason: reason || `Recorded by ${firstName(req.user!.name)}`,
    time: time || null,
    status: "APPROVED" as const,
    reviewedById: req.user!.id,
    reviewedAt: new Date(),
  };
  const saved = await prisma.dayRequest.upsert({
    where: { userId_date_kind: { userId, date: toDbDate(date), kind } },
    create: { ...data, userId, date: toDbDate(date), kind },
    update: data,
    include,
  });
  await notify(userId, {
    title: `${kindLabel[kind]} recorded`,
    body: `${dayLabel(saved.date)}${time ? ` · ${time}` : ""} · by ${firstName(req.user!.name)}`,
    link: "/attendance",
  });
  res.status(201).json(saved);
});

router.delete("/:id/admin", requireAdmin, async (req, res) => {
  const { count } = await prisma.dayRequest.deleteMany({ where: { id: String(req.params.id) } });
  if (!count) return res.status(404).json({ error: "Request not found" });
  res.json({ ok: true });
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = z.object({ status: z.enum(["APPROVED", "REJECTED"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose approve or reject" });
  const r = await prisma.dayRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!r) return res.status(404).json({ error: "Request not found" });

  const updated = await prisma.dayRequest.update({
    where: { id: r.id },
    data: { status: parsed.data.status, reviewedById: req.user!.id, reviewedAt: new Date() },
    include,
  });
  if (r.kind === "WFH_REPORT" && parsed.data.status === "APPROVED") {
    await prisma.attendance.updateMany({ where: { userId: r.userId, date: r.date }, data: { report: r.reason } });
  }
  if (parsed.data.status !== r.status) {
    await notify(r.userId, {
      title: `${kindLabel[r.kind]} ${parsed.data.status === "APPROVED" ? "approved" : "not approved"}`,
      body: `${dayLabel(r.date)} · by ${firstName(req.user!.name)}`,
      link: r.kind === "WFH_REPORT" ? "/attendance" : "/leave",
    });
  }
  res.json(updated);
});

export default router;
