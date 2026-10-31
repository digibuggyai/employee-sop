import express, { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAdmin, requireAdmin, requireAuth } from "../lib/auth.js";
import { toDbDate, todayString } from "../lib/dates.js";
import { firstName, notify, notifyAdmins } from "../lib/notify.js";
import { addDays, daysOfMonth, thisMonth } from "../lib/reports.js";

const router = Router();
router.use(requireAuth);

export const CATEGORIES = ["Travel", "Food", "Office supplies", "Courier", "Software", "Repairs", "Other"] as const;
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const claimSelect = {
  id: true,
  date: true,
  amountPaise: true,
  category: true,
  description: true,
  receiptName: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  paidAt: true,
  createdAt: true,
  reviewedBy: { select: { id: true, name: true } },
} as const;

const adminSelect = { ...claimSelect, user: { select: { id: true, name: true, photoUpdatedAt: true, designation: true } } } as const;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

router.get("/", async (req, res) => {
  const claims = await prisma.reimbursement.findMany({
    where: { userId: req.user!.id },
    select: claimSelect,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  res.json({ categories: CATEGORIES, claims });
});

const createSchema = z.object({
  date: z.iso
    .date()
    .refine((d) => d <= todayString(), "The expense date can't be in the future")
    .refine((d) => d >= addDays(todayString(), -120), "That's too far back. Talk to your admin about older expenses."),
  amount: z.coerce.number().positive("Enter the amount").max(200000, "That's over ₹2,00,000. Talk to your admin."),
  category: z.enum(CATEGORIES, "Choose a category"),
  description: z.string().trim().min(3, "Write what the expense was for").max(1000),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { date, amount, category, description } = parsed.data;
  const claim = await prisma.reimbursement.create({
    data: { userId: req.user!.id, date: toDbDate(date), amountPaise: Math.round(amount * 100), category, description },
    select: claimSelect,
  });
  await notifyAdmins(
    {
      title: `${req.user!.name} added a ${rupees(claim.amountPaise)} expense`,
      body: `${category} · ${dayLabel(claim.date)} · ${description}`,
      link: "/admin/reimbursements",
    },
    req.user!.id,
  );
  res.status(201).json(claim);
});

router.put("/:id/receipt", express.raw({ type: RECEIPT_TYPES, limit: MAX_RECEIPT_BYTES }), async (req, res) => {
  const claim = await prisma.reimbursement.findUnique({ where: { id: String(req.params.id) }, select: { userId: true, status: true } });
  if (!claim || claim.userId !== req.user!.id) return res.status(404).json({ error: "Expense not found" });
  if (claim.status !== "PENDING") return res.status(400).json({ error: "This expense was already reviewed" });
  const data = req.body as Buffer;
  const type = req.get("Content-Type")?.split(";")[0] ?? "";
  if (!Buffer.isBuffer(data) || !data.length || !RECEIPT_TYPES.includes(type)) {
    return res.status(400).json({ error: "Attach a photo (JPG, PNG) or a PDF of the bill" });
  }
  let receiptName = "receipt";
  try {
    receiptName = decodeURIComponent(req.get("X-File-Name") ?? receiptName).slice(0, 200);
  } catch {}
  const saved = await prisma.reimbursement.update({
    where: { id: String(req.params.id) },
    data: { receiptData: new Uint8Array(data), receiptName, receiptType: type },
    select: claimSelect,
  });
  res.json(saved);
});

router.get("/:id/receipt", async (req, res) => {
  const claim = await prisma.reimbursement.findUnique({
    where: { id: String(req.params.id) },
    select: { userId: true, receiptData: true, receiptName: true, receiptType: true },
  });
  if (!claim?.receiptData || (claim.userId !== req.user!.id && !isAdmin(req.user!))) return res.status(404).json({ error: "Receipt not found" });
  res.set({
    "Content-Type": claim.receiptType ?? "application/octet-stream",
    "Content-Disposition": `inline; filename="${(claim.receiptName ?? "receipt").replace(/[^\w.\- ]/g, "_")}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  });
  res.send(Buffer.from(claim.receiptData));
});

router.delete("/:id", async (req, res) => {
  const claim = await prisma.reimbursement.findUnique({ where: { id: String(req.params.id) }, select: { userId: true, status: true } });
  if (!claim || claim.userId !== req.user!.id) return res.status(404).json({ error: "Expense not found" });
  if (claim.status !== "PENDING") return res.status(400).json({ error: "Only expenses waiting for approval can be removed" });
  await prisma.reimbursement.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

router.get("/admin/list", requireAdmin, async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(thisMonth()).parse(req.query.month);
  const [open, monthClaims] = await Promise.all([
    prisma.reimbursement.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      select: adminSelect,
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.reimbursement.findMany({
      where: { date: { gte: toDbDate(`${month}-01`), lte: toDbDate(daysOfMonth(month).at(-1)!) } },
      select: adminSelect,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  res.json({ month, open, claims: monthClaims });
});

router.patch("/:id/review", requireAdmin, async (req, res) => {
  const parsed = z
    .object({ status: z.enum(["APPROVED", "REJECTED", "PAID"]), note: z.string().trim().max(500).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose approve, reject or paid" });
  const { status, note } = parsed.data;
  const claim = await prisma.reimbursement.findUnique({ where: { id: String(req.params.id) } });
  if (!claim) return res.status(404).json({ error: "Expense not found" });
  if (claim.status === "PAID") return res.status(400).json({ error: "This expense is already paid" });
  if (status === "PAID" && claim.status === "REJECTED") return res.status(400).json({ error: "Approve it before marking it paid" });
  if (status === "REJECTED" && !note) return res.status(400).json({ error: "Write why it's rejected, so they know" });

  const saved = await prisma.reimbursement.update({
    where: { id: claim.id },
    data: {
      status,
      ...(status === "PAID" ? { paidAt: new Date() } : { paidAt: null }),
      ...(status !== "PAID" || claim.status === "PENDING" ? { reviewedById: req.user!.id, reviewedAt: new Date() } : {}),
      ...(note !== undefined && { reviewNote: note || null }),
    },
    select: adminSelect,
  });
  const what = `${rupees(claim.amountPaise)} ${claim.category.toLowerCase()} expense`;
  await notify(claim.userId, {
    title: status === "APPROVED" ? `Expense approved: ${rupees(claim.amountPaise)}` : status === "PAID" ? `Reimbursed: ${rupees(claim.amountPaise)}` : `Expense not approved: ${rupees(claim.amountPaise)}`,
    body: `${what} from ${dayLabel(claim.date)} · by ${firstName(req.user!.name)}${note ? `\n${note}` : ""}`,
    link: "/reimbursements",
  });
  res.json(saved);
});

export default router;
