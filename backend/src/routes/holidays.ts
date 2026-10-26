import { Router } from "express";
import { holidays } from "../data/holidays.js";

const router = Router();

router.get("/", (req, res) => {
  if (req.query.upcoming) {
    const today = new Date().toISOString().slice(0, 10); 
    return res.json(holidays.filter((h) => h.date >= today));
  }
  res.json(holidays);
});

export default router;
