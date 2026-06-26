export const DAY_COLORS = [
  "#E8762C", // Day 1 — amber
  "#0D9488", // Day 2 — teal
  "#E11D48", // Day 3 — rose
  "#7C3AED", // Day 4 — violet
  "#0284C7", // Day 5 — sky
  "#65A30D", // Day 6 — lime
  "#EA580C", // Day 7 — orange
] as const;

export const PRICE_LABELS = ["免費", "便宜", "普通", "較貴", "高級"] as const;

export const DEFAULT_START_TIME = "09:00";
export const DEFAULT_DWELL_MINUTES = 60;
export const TRAVEL_BUFFER_MINUTES = 15;
export const MAX_PLACES_PER_REQUEST = 30;
export const DAY_MINUTES = 480; // 8 hours of active touring
