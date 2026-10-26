// Loads the values from .env into process.env (PORT, DATABASE_URL, JWT_SECRET, ...).
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
// Note the ".js": in Node's ES module mode, imports name the compiled file.
import holidaysRouter from "./routes/holidays.js";
import noticesRouter from "./routes/notices.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import directoryRouter from "./routes/directory.js";
import attendanceRouter from "./routes/attendance.js";

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
app.use("/api/holidays", holidaysRouter);
app.use("/api/notices", noticesRouter);

// Safety net: if any route throws (e.g. database unreachable), reply with a clean 500
// instead of crashing. Express recognises an error handler by its 4 parameters.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
