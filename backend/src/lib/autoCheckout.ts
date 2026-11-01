import { prisma } from "./prisma.js";
import { TIMEZONE, istDateTime, toDbDate, todayString } from "./dates.js";
import { AUTO_CHECKOUT_AT, parseTimings } from "./policy.js";
import { syncMakeUps } from "./makeups.js";
import { notify } from "./notify.js";

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export async function autoCheckout() {
  try {
    const today = todayString();
    const cutoff = istDateTime(today, AUTO_CHECKOUT_AT);
    const open = await prisma.attendance.findMany({
      where: {
        checkOut: null,
        OR: [{ date: { lt: toDbDate(today) } }, ...(Date.now() >= cutoff.getTime() ? [{ date: toDbDate(today), checkIn: { lt: cutoff } }] : [])],
      },
      include: { breaks: true, user: { select: { timings: true } } },
    });

    for (const day of open) {
      const date = day.date.toISOString().slice(0, 10);
      const shift = parseTimings(day.user.timings);
      const planned = istDateTime(date, shift ? hhmm(shift.end) : AUTO_CHECKOUT_AT);
      const checkOut = planned > day.checkIn ? planned : day.checkIn;

      const { count } = await prisma.attendance.updateMany({
        where: { id: day.id, checkOut: null },
        data: { checkOut, note: day.note ?? "Auto checked out" },
      });
      if (!count) continue;
      for (const b of day.breaks.filter((b) => !b.end)) {
        await prisma.break.update({ where: { id: b.id }, data: { end: b.start > checkOut ? b.start : checkOut } });
      }

      await syncMakeUps(day.userId);
      const time = checkOut.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE });
      const label = day.date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
      await notify(day.userId, {
        title: "You forgot to check out",
        body: `${label} · checked out at ${time} automatically. If that's wrong, ask for a change on Attendance.`,
        link: "/attendance",
      });
    }
  } catch (err) {
    console.error("autoCheckout failed", err);
  }
}

export function startAutoCheckout() {
  autoCheckout();
  setInterval(autoCheckout, 5 * 60_000);
}
