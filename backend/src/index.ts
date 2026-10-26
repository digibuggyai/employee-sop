import "dotenv/config";
import express from "express";
import cors from "cors";
import holidaysRouter from "./routes/holidays.js";
import noticesRouter from "./routes/notices.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/holidays", holidaysRouter);
app.use("/api/notices", noticesRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});