import { describe, it, expect } from "vitest";
import { overstayWarningForVisit } from "@/lib/utils";
import type { OpeningHours } from "@/types";

const makeHours = (
  openDay: number, openH: number, openM: number,
  closeDay: number, closeH: number, closeM: number,
): OpeningHours => ({
  open_now: null,
  periods: [{ open: { day: openDay, hour: openH, minute: openM }, close: { day: closeDay, hour: closeH, minute: closeM } }],
});

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
