# TODOS

## T1 — Verify Google Maps Platform caching policy before finalizing DB schema
**Priority:** P0 (pre-schema-commit)
**What:** Read Google Maps Platform ToS §12 + Caching data policy. Confirm which fields (name, lat/lng, opening_hours, address) can be stored and for how long. Adjust schema TTL and field list if required. Add attribution fields if required.
**Why:** Storing Places API content in our own DB beyond what the ToS permits can result in API key termination — non-recoverable at launch. This is a 2-hour research task that gates the schema DDL.
**Context:** The DB schema caches name, lat, lng, category, opening_hours with a 24h TTL. Place_id is always safe; other fields have restrictions. Attribution (e.g., "Powered by Google") may be required in the UI for certain displayed fields.
**Blocked by:** Nothing
**Depends on:** Nothing

---

## T2 — Set GCP daily budget alert + quota cap before any public sharing
**Priority:** P1 (pre-public-demo, post-personal-use)
**What:** (1) Set monthly budget alert at $50 in GCP Console. (2) Set per-project quota cap for Places API calls (e.g., 500 Place Details/day). (3) Add server-side validation: max 30 places per /api/resolve request, return 400 if exceeded.
**Why:** The v1 plan has no per-user rate limiting. One curious user running 20 optimizations on 30 places costs $30 in API calls. Without a cap, the first person to share the link publicly can drain the API budget.
**Context:** At $0.05/place × 30 places = $1.50/session. 20 sessions = $30. GCP quota cap is the cheapest defense (free, takes 5 minutes in Cloud Console). Server-side 30-place cap prevents the theoretical 1000-place abuse case.
**Blocked by:** Nothing
**Depends on:** T1 (know what fields you're actually calling before capping the quota)

---

## T4 — Create DESIGN.md before implementing Phase 3 UI
**Priority:** P1 (before Phase 3 implementation begins)
**What:** Write `DESIGN.md` capturing all design system decisions from `/plan-design-review 2026-06-25`: color tokens (CSS variables), typography (DM Sans + Noto Sans TC), day color system (7 colors), component library (shadcn/ui + Tailwind), interaction patterns (drag handle, keyboard sensor, inline edit).
**Why:** Without a DESIGN.md, each UI implementation session has to re-derive these decisions. The 14 decisions made in the design review will drift as engineers make local choices without a canonical reference.
**Context:** All decisions are recorded in `design-travel-itinerary-20260625.md` under `## Design Decisions (from /plan-design-review 2026-06-25)`. DESIGN.md should be a standalone reference that survives the design doc becoming outdated. Use `/design-consultation` or just write it from the design doc content.
**Blocked by:** Nothing
**Depends on:** Design review decisions (now complete)

---

## T5 — Specify opening hours warning visual component
**Priority:** P1 (before implementing Phase 2/3 itinerary UI)
**What:** Define the visual design for places with unknown opening hours: (1) what icon/indicator appears on the place card, (2) what the map marker looks like for unknown-hours places, (3) what the tooltip/hover text says.
**Why:** Phase 2 spec says "places with unknown hours are flagged with hoursUnknown and retain their schedule slot with a warning" and Phase 3 requires "places with unknown opening hours display a visible warning in both the itinerary table and map tooltip". Without a spec, the engineer will invent inconsistent warning styles across card vs. map.
**Context:** Suggested approach: amber ⚠ icon on the card time slot + tooltip "開放時間未知，建議出發前確認". Map: orange marker ring instead of solid day-color. Both must pass 4.5:1 contrast ratio against the card surface (#FFFFFF) and map tiles.
**Blocked by:** Nothing
**Depends on:** D-T5 (results page layout), D-T6 (place cards)

---

## T3 — Add place deduplication after resolution
**Priority:** P2 (before sharing with external users)
**What:** After /api/resolve returns place details, deduplicate by place_id. If two input names resolved to the same place_id, keep the first occurrence, show a UI warning: "故宮 and National Palace Museum are the same place — kept one entry."
**Why:** Users pasting mixed-language lists or copy-pasting from multiple sources will get duplicate places. Without dedup, the optimizer treats 故宮 + National Palace Museum as two separate 2-hour visits on the same day.
**Context:** Dedup happens after resolution (server-side), not before (we don't know place_id until Google responds). The dedup step: `const unique = [...new Map(places.map(p => [p.id, p])).values()]`.
**Blocked by:** Nothing
**Depends on:** /api/resolve implementation
