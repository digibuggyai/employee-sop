// ONE shared database connection for the whole app. Every route imports `prisma` from here.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// The adapter is the actual Postgres driver (the "pg" library) that Prisma talks through.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  // Safety net: never return passwordHash from any query unless a query explicitly asks for it.
  omit: { user: { passwordHash: true } },
});
