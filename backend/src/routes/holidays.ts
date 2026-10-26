import { Router } from "express";
import { holidays } from "../data/holidays.js";

// A Router is a mini-app holding related routes. index.ts mounts it at /api/holidays,
// so "/" here means GET /api/holidays.
const router = Router();

// GET /api/holidays            → all holidays
// GET /api/holidays?upcoming=1 → only today and later
router.get("/", (req, res) => {
  if (req.query.upcoming) {
    const today = new Date().toISOString().slice(0, 10); // "2026-10-25"
    // "YYYY-MM-DD" strings sort like dates, so >= works.
    return res.json(holidays.filter((h) => h.date >= today));
  }
  res.json(holidays);
});

export default router;
