import { prisma } from "./prisma.js";
import { istDateTime, todayString } from "./dates.js";
import { firstName, notify, notifyEveryone } from "./notify.js";

const WISH_FROM = "09:00";
const wishTitle = (name: string) => `Happy birthday, ${firstName(name)}!`;

export async function sendBirthdayWishes() {
  try {
    const today = todayString();
    if (Date.now() < istDateTime(today, WISH_FROM).getTime()) return;
    const monthDay = today.slice(5);
    const people = await prisma.user.findMany({ where: { active: true, birthday: { not: null } }, select: { id: true, name: true, birthday: true } });
    const dayStart = istDateTime(today, "00:00");
    for (const person of people) {
      if (person.birthday!.toISOString().slice(5, 10) !== monthDay) continue;
      const already = await prisma.notification.count({ where: { userId: person.id, title: wishTitle(person.name), createdAt: { gte: dayStart } } });
      if (already) continue;
      await notify(person.id, { title: wishTitle(person.name), body: "Wishing you a wonderful year ahead from everyone at Digibuggy.", link: "/" });
      await notifyEveryone({ title: `It's ${firstName(person.name)}'s birthday today`, body: `Wish ${person.name} a happy birthday!`, link: "/" }, person.id);
    }
  } catch (err) {
    console.error("sendBirthdayWishes failed", err);
  }
}

export function startBirthdayWishes() {
  sendBirthdayWishes();
  setInterval(sendBirthdayWishes, 15 * 60_000);
}
