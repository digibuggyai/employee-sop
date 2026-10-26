// Prisma's settings: where the schema is, where migrations go, and how to reach the DB.
// Prisma doesn't read .env by itself, so we load it here.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // process.env (not Prisma's env()) so `prisma generate` still works when no DB is configured
  datasource: { url: process.env.DATABASE_URL },
});
