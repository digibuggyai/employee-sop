import { Router } from "express";
import { notices } from "../data/notices.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(notices);
});

export default router;
