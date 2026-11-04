import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { isOffDay } from "../lib/reports.js";
import { firstName, notify, notifyAdmins } from "../lib/notify.js";

const router = Router();
router.use(requireAuth);

export const kindLabel = { WFH: "WFH", HALF_DAY: "Half day", SHORT_LEAVE: "Short leave" } as const;

const include = {
  user: { select: { id: true, name: true, photoUpdatedAt: true } },
  reviewedBy: { select: { id: true, name: true } },
};

const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

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
      kind: z.enum(["WFH", "HALF_DAY", "SHORT_LEAVE"]),
      date: z.iso.date({ error: "Pick a date" }),
      time: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM for the time").nullable().optional(),
      reason: z.string({ error: "Give a short reason" }).trim().min(3, "Give a short reason").max(500),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { kind, date, time, reason } = parsed.data;
  const me = req.user!;

  if (date < todayString()) return res.status(400).json({ error: "Ask before the day. For a past day, talk to your admin." });
  if (isOffDay(date, me.employmentType)) return res.status(400).json({ error: "That day is already off" });
  if (kind === "WFH" && me.employmentType === "REMOTE_INTERN") {
    return res.status(400).json({ error: "Remote interns don't need WFH approval" });
  }
  const leave = await prisma.leave.findFirst({ where: { userId: me.id, date: toDbDate(date), status: { not: "REJECTED" } } });
  if (leave) return res.status(409).json({ error: "You already have leave on that day" });

  const existing = await prisma.dayRequest.findUnique({ where: { userId_date_kind: { userId: me.id, date: toDbDate(date), kind } } });
  if (existing && existing.status !== "REJECTED") return res.status(409).json({ error: `You already asked for ${kindLabel[kind].toLowerCase()} on that day` });

  const data = { reason, time: time || null, status: "PENDING" as const, reviewedById: null, reviewedAt: null };
  const saved = existing
    ? await prisma.dayRequest.update({ where: { id: existing.id }, data, include })
    : await prisma.dayRequest.create({ data: { ...data, userId: me.id, date: toDbDate(date), kind }, include });

  await notifyAdmins(
    {
      title: `${me.name} asked for ${kindLabel[kind].toLowerCase()}`,
      body: `${dayLabel(saved.date)}${time ? ` · ${time}` : ""} · ${reason}`,
      link: "/admin/leaves",
    },
    me.id,
  );
  res.status(201).json(saved);
});

router.delete("/:id", async (req, res) => {
  const r = await prisma.dayRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!r || r.userId !== req.user!.id) return res.status(404).json({ error: "Request not found" });
  if (r.status !== "PENDING") return res.status(400).json({ error: "Only pending requests can be withdrawn" });
  await prisma.dayRequest.delete({ where: { id: r.id } });
  res.json({ ok: true });
});

router.get("/admin", requireAdmin, async (req, res) => {
  const reviewed = req.query.status === "REVIEWED";
  const requests = await prisma.dayRequest.findMany({
    where: reviewed ? { status: { not: "PENDING" } } : { status: "PENDING" },
    include,
    orderBy: reviewed ? { reviewedAt: "desc" } : { date: "asc" },
    take: reviewed ? 30 : undefined,
  });
  res.json(requests);
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
  if (parsed.data.status !== r.status) {
    await notify(r.userId, {
      title: `${kindLabel[r.kind]} ${parsed.data.status === "APPROVED" ? "approved" : "not approved"}`,
      body: `${dayLabel(r.date)} · by ${firstName(req.user!.name)}`,
      link: "/leave",
    });
  }
  res.json(updated);
});

export default router;
