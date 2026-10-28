// Loads the values from .env into process.env (PORT, DATABASE_URL, JWT_SECRET, ...).
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
// Note the ".js": in Node's ES module mode, imports name the compiled file.
import holidaysRouter from "./routes/holidays.js";
import noticesRouter from "./routes/notices.js";
import weeklyReportsRouter from "./routes/weeklyReports.js";
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

// CORS: lets the frontend's address call this API from the browser.
// credentials: true allows the login cookie to travel with those requests.
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// Lets us read JSON sent by the frontend (e.g. login form) as req.body.
app.use(express.json());

// Reads the Cookie header into req.cookies (that's where the login token lives).
app.use(cookieParser());

// A "route": when someone sends GET /api/health, run this function and reply with JSON.
// Railway can call this to check the server is alive.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Every route inside a router gets its prefix.
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

// Safety net: if any route throws (e.g. database unreachable), reply with a clean 500
// instead of crashing. Express recognises an error handler by its 4 parameters.
app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  // An upload bigger than a route allows (e.g. a profile photo over 300 KB)
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
