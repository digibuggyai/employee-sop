import { Router } from "express";
import { notices } from "../data/notices.js";

const router = Router();

// GET /api/notices → all notice board items
router.get("/", (_req, res) => {
  res.json(notices);
});

export default router;
