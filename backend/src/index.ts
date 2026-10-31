import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import holidaysRouter from "./routes/holidays.js";
import noticesRouter from "./routes/notices.js";
import weeklyReportsRouter from "./routes/weeklyReports.js";
import sopsRouter from "./routes/sops.js";
import vaultRouter from "./routes/vault.js";
import notificationsRouter from "./routes/notifications.js";
import reimbursementsRouter from "./routes/reimbursements.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import directoryRouter from "./routes/directory.js";
import attendanceRouter from "./routes/attendance.js";
import tasksRouter from "./routes/tasks.js";
import adminRouter from "./routes/admin.js";
import leavesRouter from "./routes/leaves.js";
import photosRouter from "./routes/photos.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use(express.json());

app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/directory", directoryRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/admin", adminRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/photos", photosRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/notices", noticesRouter);
app.use("/api/weekly-reports", weeklyReportsRouter);
app.use("/api/sops", sopsRouter);
app.use("/api/vault", vaultRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/reimbursements", reimbursementsRouter);

app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
