// Changing a past attendance day. Used by BOTH:
//   - an admin editing a day directly, and
//   - an admin approving an employee's change request.
// Keeping it in one place means both paths follow exactly the same rules.
import { z } from "zod";
import { prisma } from "./prisma.js";
import { istDateTime, toDbDate, todayString } from "./dates.js";

// What a form sends: a date plus times typed as "HH:MM" (India time).
// Every field except date is optional: leave it out to keep the current value.
export const dayChangeSchema = z.object({
  date: z.iso.date(),
  place: z.enum(["IN_OFFICE", "WFH"]).optional(),
  checkIn: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM for the in time").optional(),
  checkOut: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM for the out time").nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  halfDay: z.boolean().optional(),
});
export type DayChangeInput = z.infer<typeof dayChangeSchema>;

// The same change, with times turned into real moments
export type DayChange = {
  place?: "IN_OFFICE" | "WFH";
  checkIn?: Date;
  checkOut?: Date | null;
  note?: string | null;
  halfDay?: boolean;
};

export function toDayChange(input: DayChangeInput): DayChange {
  return {
    place: input.place,
    checkIn: input.checkIn ? istDateTime(input.date, input.checkIn) : undefined,
    checkOut: input.checkOut === undefined ? undefined : input.checkOut ? istDateTime(input.date, input.checkOut) : null,
    note: input.note === undefined ? undefined : input.note || null,
    halfDay: input.halfDay,
  };
}

// Checks the change against the current row. Returns an error message, or null if it's fine.
export async function checkDayChange(userId: string, date: string, change: DayChange): Promise<string | null> {
  if (date > todayString()) return "You can't change a day in the future";
  const current = await prisma.attendance.findUnique({ where: { userId_date: { userId, date: toDbDate(date) } } });

  // A day with no record yet needs the basics
  if (!current && (!change.place || !change.checkIn)) return "Add the place and the in time for this day";

  // Compare the times as they'll be AFTER the change
  const checkIn = change.checkIn ?? current?.checkIn;
  const checkOut = change.checkOut === undefined ? current?.checkOut : change.checkOut;
  if (checkIn && checkOut && checkOut <= checkIn) return "The out time must be after the in time";
  if (!checkOut && date < todayString()) return "Add the out time for a past day";
  return null;
}

// Applies the change: updates the day, or creates it if it didn't exist.
// (Not prisma.upsert: Prisma validates the "create" half even when the row exists,
//  and a change that only touches the out time has no place / in time to create with.)
export async function applyDayChange(userId: string, date: string, change: DayChange) {
  const key = { userId_date: { userId, date: toDbDate(date) } };
  const data = Object.fromEntries(Object.entries(change).filter(([, v]) => v !== undefined)); // only fields that change
  if (await prisma.attendance.findUnique({ where: key })) {
    return prisma.attendance.update({ where: key, data });
  }
  // checkDayChange already made sure place + checkIn exist for a new day
  return prisma.attendance.create({
    data: { userId, date: toDbDate(date), place: change.place!, checkIn: change.checkIn!, checkOut: change.checkOut ?? null, note: change.note ?? null, halfDay: change.halfDay ?? false },
  });
}
