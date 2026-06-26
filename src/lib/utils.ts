import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { OpeningHours, Visit } from "@/types";
import { TRAVEL_BUFFER_MINUTES } from "@/lib/constants";

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

// --- TSP + cascade helpers ---

// Pure time cascade for estimation only (no warnings, no locked pinning).
// Used internally by mealWindowSwap to decide swap positions.
function estimateTimePass(visits: Visit[]): Visit[] {
  if (visits.length === 0) return [];
  const result = visits.map(v => ({ ...v }));
  result[0].departure_time = addMinutes(result[0].arrival_time, result[0].place.dwell_minutes);
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const tm = travelMinutes(prev.place.lat, prev.place.lng, result[i].place.lat, result[i].place.lng);
    const arrival = addMinutes(prev.departure_time, tm + TRAVEL_BUFFER_MINUTES);
    result[i] = {
      ...result[i],
      travel_minutes_from_prev: tm,
      arrival_time: arrival,
      departure_time: addMinutes(arrival, result[i].place.dwell_minutes),
    };
  }
  return result;
}

// NN starting from visits[startIdx] (keeps it first, greedy for the rest).
function nnFromIndex(visits: Visit[], startIdx: number): Visit[] {
  if (visits.length === 0) return [];
  const remaining = [...visits];
  const first = remaining.splice(startIdx, 1)[0];
  const ordered: Visit[] = [first];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last.place.lat, last.place.lng, remaining[i].place.lat, remaining[i].place.lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return ordered;
}

// NN starting from a fixed lat/lng (an anchor position, not a visit).
function nnFromLatLng(visits: Visit[], lat: number, lng: number): Visit[] {
  if (visits.length === 0) return [];
  const remaining = [...visits];
  const ordered: Visit[] = [];
  let curLat = lat;
  let curLng = lng;
  while (remaining.length > 0) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(curLat, curLng, remaining[i].place.lat, remaining[i].place.lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    curLat = remaining[best].place.lat;
    curLng = remaining[best].place.lng;
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return ordered;
}

// Nearest-neighbor TSP that treats locked visits as position anchors.
// Locked visits stay at their original indices; free visits in each segment
// between anchors are reordered by NN starting from the preceding locked visit.
export function tspWithLockAnchors(visits: Visit[]): Visit[] {
  if (visits.length < 2) return [...visits];

  const freeCount = visits.filter(v => !v.locked).length;
  if (freeCount <= 1) return [...visits];

  // Build result with locked visits placed; free slots = null
  const result: (Visit | null)[] = visits.map(v => v.locked ? v : null);

  // Collect contiguous free-slot segments with their preceding locked anchor
  type Segment = { slots: number[]; anchorLat: number | null; anchorLng: number | null };
  const segments: Segment[] = [];
  let i = 0;
  while (i < result.length) {
    if (result[i] !== null) { i++; continue; }
    const slots: number[] = [];
    while (i < result.length && result[i] === null) { slots.push(i); i++; }
    const prevIdx = slots[0] - 1;
    const anchor = prevIdx >= 0 && result[prevIdx] !== null ? result[prevIdx]! : null;
    segments.push({ slots, anchorLat: anchor?.place.lat ?? null, anchorLng: anchor?.place.lng ?? null });
  }

  for (const seg of segments) {
    const segVisits = seg.slots.map(idx => visits[idx]);
    if (segVisits.length <= 1) {
      seg.slots.forEach((idx, k) => { result[idx] = segVisits[k]; });
      continue;
    }
    const ordered = seg.anchorLat !== null
      ? nnFromLatLng(segVisits, seg.anchorLat, seg.anchorLng!)
      : nnFromIndex(segVisits, 0); // segment 0: no anchor, keep first visit first
    seg.slots.forEach((idx, k) => { result[idx] = ordered[k]; });
  }

  const final = result as Visit[];
  // Preserve the original day start time at position 0
  if (!final[0].locked) {
    final[0] = { ...final[0], arrival_time: visits[0].arrival_time };
  }
  return final;
}

// Soft-swap 餐廳 visits into meal windows after TSP ordering.
// Estimates times once from the TSP order, then performs at most one swap
// per window (lunch 11:00–14:00, dinner 17:00–20:00).
export function mealWindowSwap(visits: Visit[]): Visit[] {
  if (visits.length === 0) return visits;

  const toMins = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const isInAnyMealWindow = (mins: number) =>
    (mins >= 660 && mins <= 840) || (mins >= 1020 && mins <= 1200);

  const result = [...visits];

  const doSwap = (targetMins: number, windowStart: number, windowEnd: number) => {
    // Re-estimate from current result order so each swap sees the updated sequence
    const est = estimateTimePass(result);

    if (est.some(v =>
      !v.locked && v.place.user_category === '餐廳' &&
      toMins(v.arrival_time) >= windowStart && toMins(v.arrival_time) <= windowEnd
    )) return;

    // Only consider 餐廳 not already placed in any meal window (avoids undoing a prior swap)
    const restIdxs = est
      .map((v, idx) => ({ idx, v }))
      .filter(({ v }) => !v.locked && v.place.user_category === '餐廳' &&
        !isInAnyMealWindow(toMins(v.arrival_time)));
    if (restIdxs.length === 0) return;

    const nonRestIdxs = est
      .map((v, idx) => ({ idx, v }))
      .filter(({ v }) => !v.locked && v.place.user_category !== '餐廳');
    if (nonRestIdxs.length === 0) return; // no non-餐廳 to swap with

    const bestRest = restIdxs.reduce((a, b) =>
      Math.abs(toMins(a.v.arrival_time) - targetMins) <= Math.abs(toMins(b.v.arrival_time) - targetMins) ? a : b
    );
    const bestNonRest = nonRestIdxs.reduce((a, b) =>
      Math.abs(toMins(a.v.arrival_time) - targetMins) <= Math.abs(toMins(b.v.arrival_time) - targetMins) ? a : b
    );

    [result[bestRest.idx], result[bestNonRest.idx]] = [result[bestNonRest.idx], result[bestRest.idx]];
  };

  doSwap(720, 660, 840);    // lunch: 11:00–14:00, target 12:00
  doSwap(1080, 1020, 1200); // dinner: 17:00–20:00, target 18:00

  return result;
}

// Full time cascade with warnings and locked-visit arrival_time pinning.
// Recalculates all leg distances from haversine (since TSP changed order).
// Note: deliberately separate from handleDwellChange which PRESERVES existing
// travel_minutes_from_prev (Directions API values). Merging them would silently
// downgrade precision every time a user adjusts dwell time.
export function recascadeTimes(visits: Visit[], visitDayOfWeek: number): Visit[] {
  if (visits.length === 0) return [];
  const result = visits.map(v => ({ ...v }));
  result[0].departure_time = addMinutes(result[0].arrival_time, result[0].place.dwell_minutes);
  for (let i = 1; i < result.length; i++) {
    if (result[i].locked) {
      // Pin arrival_time — label says "鎖定到達時間"; only position is TSP-anchored,
      // time must also be preserved.
      const departure = addMinutes(result[i].arrival_time, result[i].place.dwell_minutes);
      result[i] = {
        ...result[i],
        departure_time: departure,
        opening_warning: openingWarningForVisit(result[i].place.weekday_descriptions, visitDayOfWeek, result[i].arrival_time),
        overstay_warning: overstayWarningForVisit(result[i].place.opening_hours, visitDayOfWeek, departure),
      };
      continue;
    }
    const prev = result[i - 1];
    const tm = travelMinutes(prev.place.lat, prev.place.lng, result[i].place.lat, result[i].place.lng);
    const arrival = addMinutes(prev.departure_time, tm + TRAVEL_BUFFER_MINUTES);
    const departure = addMinutes(arrival, result[i].place.dwell_minutes);
    result[i] = {
      ...result[i],
      travel_minutes_from_prev: tm,
      arrival_time: arrival,
      departure_time: departure,
      opening_warning: openingWarningForVisit(result[i].place.weekday_descriptions, visitDayOfWeek, arrival),
      overstay_warning: overstayWarningForVisit(result[i].place.opening_hours, visitDayOfWeek, departure),
    };
  }
  return result;
}
