// Creates the FIRST admin. After that, admins add everyone else from the app.
// Usage:  npm run create-admin -- "Your Name" you@digibuggy.com "YourPassword"
// Running it again with the same email makes that person an admin and resets the password.
import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";

const [name, rawEmail, password] = process.argv.slice(2);

if (!name || !rawEmail || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- "Name" email@example.com "password (8+ chars)"');
  process.exit(1);
}
const email = rawEmail.trim().toLowerCase();
const passwordHash = await hashPassword(password);

// upsert = update if exists, otherwise create
const user = await prisma.user.upsert({
  where: { email },
  update: { role: "ADMIN", active: true, passwordHash, mustChangePassword: false },
  create: { name, email, passwordHash, role: "ADMIN", employmentType: "FULL_TIME", mustChangePassword: false },
});

console.log(`✔ ${user.name} (${user.email}) is an admin. Log in at the frontend.`);
await prisma.$disconnect();
