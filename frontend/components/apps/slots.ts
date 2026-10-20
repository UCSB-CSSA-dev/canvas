import { LIMITS } from "@/lib/api";

/** Mirrors the backend: slot = weekday * SLOTS_PER_DAY + minuteOfDay / slotMinutes, weekday 0 = Sunday. */
export const SLOTS_PER_DAY = (24 * 60) / LIMITS.meetingSlotMinutes;

export function slotOf(day: number, minutes: number) {
  return day * SLOTS_PER_DAY + minutes / LIMITS.meetingSlotMinutes;
}

export function slotDay(slot: number) {
  return Math.floor(slot / SLOTS_PER_DAY);
}

export function slotMinutes(slot: number) {
  return (slot % SLOTS_PER_DAY) * LIMITS.meetingSlotMinutes;
}

export function clock(minutes: number) {
  if (minutes === 24 * 60) return "24:00";
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/** Monday-first display order. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
