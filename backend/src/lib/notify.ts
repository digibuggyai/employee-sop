import { prisma } from "./prisma.js";

export type NotificationInput = { title: string; body?: string | null; link?: string | null };

export async function notify(userIds: string | string[], n: NotificationInput) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, title: n.title.slice(0, 200), body: n.body?.slice(0, 2000) || null, link: n.link ?? null })),
    });
  } catch (err) {
    console.error("Could not save notification", err);
  }
}

export async function notifyEveryone(n: NotificationInput, exceptId?: string) {
  const users = await prisma.user.findMany({ where: { active: true, ...(exceptId && { NOT: { id: exceptId } }) }, select: { id: true } });
  await notify(users.map((u) => u.id), n);
}

export async function notifyAdmins(n: NotificationInput, exceptId?: string) {
  const admins = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "SUPER_ADMIN"] }, ...(exceptId && { NOT: { id: exceptId } }) },
    select: { id: true },
  });
  await notify(admins.map((u) => u.id), n);
}

export const firstName = (name: string) => name.split(" ")[0];
