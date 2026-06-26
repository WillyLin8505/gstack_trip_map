import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OpeningHours } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "上午" : "下午";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function openingWarningForVisit(
  weekdayDescriptions: string[] | null | undefined,
  visitDayOfWeek: number,
  arrivalHhmm: string,
): boolean {
  const weekdayText = weekdayDescriptions?.[visitDayOfWeek];
  if (!weekdayText) return false;

  const hoursText = weekdayText.replace(/^[^:]+:\s*/, '');
  if (/open 24/i.test(hoursText)) return false;
  if (/closed/i.test(hoursText)) return true;

  const m = hoursText.match(/(\d+):(\d+)\s*(AM|PM)[^–\-]*[–\-]\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return false;

  const toMins = (h: string, min: string, ampm: string) => {
    let hours = parseInt(h, 10);
    const mins = parseInt(min, 10);
    if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
  };

  const openMins = toMins(m[1], m[2], m[3]);
  let closeMins = toMins(m[4], m[5], m[6]);
  if (closeMins <= openMins) closeMins += 24 * 60;

  const [ah, am] = arrivalHhmm.split(':').map(Number);
  const arrivalMins = ah * 60 + am;
  return arrivalMins < openMins || arrivalMins >= closeMins;
}

export function overstayWarningForVisit(
  openingHours: OpeningHours | null | undefined,
  visitDayOfWeek: number,
  departureHhmm: string,
): boolean {
  if (!openingHours?.periods?.length) return false;
  const [dh, dm] = departureHhmm.split(':').map(Number);
  const depMins = dh * 60 + dm;
  const todayPeriods = openingHours.periods.filter(p => p.open.day === visitDayOfWeek);
  for (const period of todayPeriods) {
    if (!period.close) continue;
    const openMins = period.open.hour * 60 + period.open.minute;
    const closeMins = period.close.hour * 60 + period.close.minute;
    const spansMiddnight = period.close.day !== period.open.day;
    const effectiveClose = spansMiddnight ? closeMins + 24 * 60 : closeMins;
    // Early-morning departure (before noon) on a midnight-spanning period = next-day cycle.
    // Afternoon departure before opening is just before-open, not an overstay.
    const effectiveDep = (spansMiddnight && depMins < openMins && depMins < 12 * 60)
      ? depMins + 24 * 60
      : depMins;
    if (effectiveDep > effectiveClose) return true;
  }
  return false;
}

// Walking/transit estimate: ~15 min/km baseline
export function travelMinutes(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  return Math.round(haversineKm(lat1, lng1, lat2, lng2) * 15);
}
