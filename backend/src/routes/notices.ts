import { Router } from "express";
import { notices } from "../data/notices.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, (_req, res) => {
  res.json(notices);
});

export default router;
