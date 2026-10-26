import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/directory → active colleagues, for any logged-in employee.
// `select` picks ONLY the fields colleagues should see (no role, no account flags).
router.get("/", requireAuth, async (_req, res) => {
  const people = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
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

export default router;
