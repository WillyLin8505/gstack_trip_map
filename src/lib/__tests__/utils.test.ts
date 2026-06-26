import { describe, it, expect } from "vitest";
import {
  overstayWarningForVisit,
  addMinutes,
  tspWithLockAnchors,
  mealWindowSwap,
  recascadeTimes,
} from "@/lib/utils";
import type { OpeningHours, UserCategory, Visit } from "@/types";

const makeHours = (
  openDay: number, openH: number, openM: number,
  closeDay: number, closeH: number, closeM: number,
): OpeningHours => ({
  open_now: null,
  periods: [{ open: { day: openDay, hour: openH, minute: openM }, close: { day: closeDay, hour: closeH, minute: closeM } }],
});

function makeVisit(
  id: string,
  lat: number,
  lng: number,
  arrivalHhmm: string,
  dwellMins: number,
  opts?: { locked?: boolean; user_category?: UserCategory },
): Visit {
  return {
    place: {
      id,
      name: id,
      address: "",
      lat,
      lng,
      category: "",
      user_category: opts?.user_category,
      price_level: null,
      rating: null,
      opening_hours: null,
      photo_url: null,
      dwell_minutes: dwellMins,
      weekday_descriptions: null,
    },
    arrival_time: arrivalHhmm,
    departure_time: addMinutes(arrivalHhmm, dwellMins),
    travel_minutes_from_prev: 0,
    opening_warning: false,
    overstay_warning: false,
    locked: opts?.locked ?? false,
  };
}

describe("overstayWarningForVisit", () => {
  it("returns false when no opening_hours", () => {
    expect(overstayWarningForVisit(null, 1, "21:00")).toBe(false);
    expect(overstayWarningForVisit(undefined, 1, "21:00")).toBe(false);
  });

  it("returns false when periods is empty", () => {
    expect(overstayWarningForVisit({ open_now: null, periods: [] }, 1, "21:00")).toBe(false);
  });

  it("returns false when departure is before closing time", () => {
    // Mon closes at 22:00, departure 21:00 → no overstay
    const hours = makeHours(1, 9, 0, 1, 22, 0);
    expect(overstayWarningForVisit(hours, 1, "21:00")).toBe(false);
  });

  it("returns true when departure is after closing time", () => {
    // Mon closes at 21:00, departure 21:30 → overstay
    const hours = makeHours(1, 9, 0, 1, 21, 0);
    expect(overstayWarningForVisit(hours, 1, "21:30")).toBe(true);
  });

  it("returns false for a different day of week", () => {
    // Period is Monday (1), checking Tuesday (2)
    const hours = makeHours(1, 9, 0, 1, 21, 0);
    expect(overstayWarningForVisit(hours, 2, "22:00")).toBe(false);
  });

  it("handles midnight-spanning close (close.day > open.day)", () => {
    // Fri opens 18:00, closes Sat 02:00 → departure 01:30 Sat should NOT warn
    const hours = makeHours(5, 18, 0, 6, 2, 0);
    expect(overstayWarningForVisit(hours, 5, "01:30")).toBe(false);
  });

  it("returns true for midnight-spanning when departure exceeds close", () => {
    // Fri opens 18:00, closes Sat 02:00 → departure 02:30 Sat should warn
    const hours = makeHours(5, 18, 0, 6, 2, 0);
    expect(overstayWarningForVisit(hours, 5, "02:30")).toBe(true);
  });

  it("returns false for afternoon departure before midnight-spanning opening", () => {
    // Night market opens 16:00, closes next-day 00:00 → departure 15:08 (before open) should NOT warn
    const hours = makeHours(4, 16, 0, 5, 0, 0);
    expect(overstayWarningForVisit(hours, 4, "15:08")).toBe(false);
  });

  it("returns false when period has no close (open 24h)", () => {
    const hours: OpeningHours = {
      open_now: null,
      periods: [{ open: { day: 1, hour: 0, minute: 0 }, close: null }],
    };
    expect(overstayWarningForVisit(hours, 1, "23:59")).toBe(false);
  });

  it("returns false when departure is exactly at closing time", () => {
    const hours = makeHours(3, 9, 0, 3, 21, 0);
    expect(overstayWarningForVisit(hours, 3, "21:00")).toBe(false);
  });
});

describe("tspWithLockAnchors", () => {
  it("returns original order when fewer than 2 visits", () => {
    const v = makeVisit("a", 0, 0, "09:00", 60);
    expect(tspWithLockAnchors([v])[0].place.id).toBe("a");
    expect(tspWithLockAnchors([]).length).toBe(0);
  });

  it("returns original order when all visits are locked", () => {
    const v0 = makeVisit("a", 0, 0, "09:00", 60, { locked: true });
    const v1 = makeVisit("b", 5, 5, "09:00", 60, { locked: true });
    const result = tspWithLockAnchors([v0, v1]);
    expect(result[0].place.id).toBe("a");
    expect(result[1].place.id).toBe("b");
  });

  it("reorders free visits by nearest-neighbor to reduce total distance", () => {
    // Optimal: a(lng=0) → b(lng=1) → c(lng=2) → d(lng=3)
    // Input:   a(lng=0) → c(lng=2) → d(lng=3) → b(lng=1)  (suboptimal)
    // NN from a keeps a first, then picks nearest: b(lng=1) < c(lng=2) < d(lng=3)
    const a = makeVisit("a", 0, 0, "09:00", 60);
    const c = makeVisit("c", 0, 2, "09:00", 60);
    const d = makeVisit("d", 0, 3, "09:00", 60);
    const b = makeVisit("b", 0, 1, "09:00", 60);
    const result = tspWithLockAnchors([a, c, d, b]);
    expect(result.map(v => v.place.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps locked visit at original index and reorders free segment after it", () => {
    // v0(free), v1(locked at lng=1), v2(free far lng=10), v3(free close lng=2)
    // Segment [2,3] reordered via NN from v1(lng=1): nearest is v3(lng=2), then v2(lng=10)
    const v0 = makeVisit("a", 0, 0, "09:00", 60);
    const v1 = makeVisit("b", 0, 1, "09:00", 60, { locked: true });
    const v2 = makeVisit("c", 0, 10, "09:00", 60);
    const v3 = makeVisit("d", 0, 2, "09:00", 60);
    const result = tspWithLockAnchors([v0, v1, v2, v3]);
    expect(result[1].place.id).toBe("b"); // locked stays at 1
    expect(result[2].place.id).toBe("d"); // close to b, comes first
    expect(result[3].place.id).toBe("c"); // far from b, comes second
  });

  it("preserves original day start time at position 0", () => {
    const a = makeVisit("a", 0, 5, "09:00", 60); // far from b, may not stay first
    const b = makeVisit("b", 0, 0, "10:00", 60); // close to c
    const c = makeVisit("c", 0, 1, "09:00", 60);
    const result = tspWithLockAnchors([a, b, c]);
    // Whatever ends up at position 0, its arrival_time must be visits[0].arrival_time = "09:00"
    expect(result[0].arrival_time).toBe("09:00");
  });
});

describe("mealWindowSwap", () => {
  it("returns unchanged when no 餐廳 visits", () => {
    const v0 = makeVisit("a", 1, 1, "09:00", 60, { user_category: "景點" });
    const v1 = makeVisit("b", 1, 1, "09:00", 60, { user_category: "景點" });
    const result = mealWindowSwap([v0, v1]);
    expect(result.map(v => v.place.id)).toEqual(["a", "b"]);
  });

  it("returns unchanged when all visits are 餐廳 (no non-餐廳 to swap with)", () => {
    const v0 = makeVisit("a", 1, 1, "09:00", 60, { user_category: "餐廳" });
    const v1 = makeVisit("b", 1, 1, "09:00", 60, { user_category: "餐廳" });
    const v2 = makeVisit("c", 1, 1, "09:00", 60, { user_category: "餐廳" });
    // Should not crash; no swap possible
    const result = mealWindowSwap([v0, v1, v2]);
    expect(result.map(v => v.place.id)).toEqual(["a", "b", "c"]);
  });

  it("does not swap when 餐廳 already in lunch window", () => {
    // v0: 景點 09:00 dwell 120 → departs 11:00
    // v1: 餐廳, same coords → buffer 15 → arrives 11:15 (IN 11:00–14:00 window)
    // v2: 景點
    const v0 = makeVisit("a", 1, 1, "09:00", 120, { user_category: "景點" });
    const v1 = makeVisit("b", 1, 1, "09:00", 60, { user_category: "餐廳" });
    const v2 = makeVisit("c", 1, 1, "09:00", 60, { user_category: "景點" });
    const result = mealWindowSwap([v0, v1, v2]);
    expect(result[1].place.id).toBe("b"); // no swap
  });

  it("swaps 餐廳 toward lunch window when outside", () => {
    // v0: 景點 09:00 dwell 60 → departs 10:00
    // v1: 餐廳, same coords → arrives 10:15 (NOT in 11:00–14:00)
    // v2: 景點, same coords → arrives 11:30 (closer to 12:00)
    // Swap: 餐廳 moves to position 2, 景點 moves to position 1
    const v0 = makeVisit("a", 1, 1, "09:00", 60, { user_category: "景點" });
    const v1 = makeVisit("b", 1, 1, "09:00", 60, { user_category: "餐廳" });
    const v2 = makeVisit("c", 1, 1, "09:00", 60, { user_category: "景點" });
    const result = mealWindowSwap([v0, v1, v2]);
    expect(result[2].place.user_category).toBe("餐廳");
  });

  it("does not move locked 餐廳 when swapping", () => {
    const v0 = makeVisit("a", 1, 1, "09:00", 60, { user_category: "景點" });
    const v1 = makeVisit("b", 1, 1, "09:00", 60, { user_category: "餐廳", locked: true });
    const v2 = makeVisit("c", 1, 1, "09:00", 60, { user_category: "景點" });
    const result = mealWindowSwap([v0, v1, v2]);
    expect(result[1].place.id).toBe("b"); // locked, stays in place
  });
});

describe("recascadeTimes", () => {
  it("cascades times from position 0", () => {
    // Same coords → 0 travel, 15 min buffer between visits
    const v0 = makeVisit("a", 1, 1, "09:00", 60);
    const v1 = makeVisit("b", 1, 1, "09:00", 60);
    const result = recascadeTimes([v0, v1], 1);
    expect(result[0].arrival_time).toBe("09:00");
    expect(result[0].departure_time).toBe("10:00");
    expect(result[1].arrival_time).toBe("10:15"); // 10:00 + 0travel + 15buffer
    expect(result[1].departure_time).toBe("11:15");
  });

  it("preserves arrival_time for locked visits and cascades from their departure", () => {
    const v0 = makeVisit("a", 1, 1, "09:00", 60);
    const v1 = makeVisit("b", 1, 1, "15:00", 60, { locked: true }); // arrival pinned at 15:00
    const v2 = makeVisit("c", 1, 1, "09:00", 60);
    const result = recascadeTimes([v0, v1, v2], 1);
    expect(result[1].arrival_time).toBe("15:00");  // pinned
    expect(result[1].departure_time).toBe("16:00"); // 15:00 + 60 dwell
    expect(result[2].arrival_time).toBe("16:15");   // cascades from locked departure
  });

  it("treats locked visit at position 0 the same as unlocked (arrival kept)", () => {
    const v0 = makeVisit("a", 1, 1, "09:00", 60, { locked: true });
    const v1 = makeVisit("b", 1, 1, "09:00", 60);
    const result = recascadeTimes([v0, v1], 1);
    expect(result[0].arrival_time).toBe("09:00");
    expect(result[0].departure_time).toBe("10:00");
    expect(result[1].arrival_time).toBe("10:15");
  });

  it("returns empty array for empty input", () => {
    expect(recascadeTimes([], 1)).toEqual([]);
  });
});
