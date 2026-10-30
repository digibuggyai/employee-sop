import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";

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

export default router;
