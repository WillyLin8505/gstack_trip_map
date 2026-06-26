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

~~## T5 — Specify opening hours warning visual component~~
~~**CLOSED** — DT1 decision: integrated amber block with Clock icon in PlaceCard (Step 8 of sssss-main-design-20260626-134053.md). Covers card-level display. Map marker out of scope for this feature.~~

---

## T3 — Add place deduplication after resolution
**Priority:** P2 (before sharing with external users)
**What:** After /api/resolve returns place details, deduplicate by place_id. If two input names resolved to the same place_id, keep the first occurrence, show a UI warning: "故宮 and National Palace Museum are the same place — kept one entry."
**Why:** Users pasting mixed-language lists or copy-pasting from multiple sources will get duplicate places. Without dedup, the optimizer treats 故宮 + National Palace Museum as two separate 2-hour visits on the same day.
**Context:** Dedup happens after resolution (server-side), not before (we don't know place_id until Google responds). The dedup step: `const unique = [...new Map(places.map(p => [p.id, p])).values()]`.
**Blocked by:** Nothing
**Depends on:** /api/resolve implementation

---

## T6 — Re-run refineTravelTimes() after drag-reorder or dwell-time edit
**Priority:** P2
**What:** After user drags a place to a new position in a day, or changes dwell time, re-call /api/optimize (or a lightweight /api/refine endpoint) to get updated real travel times for the new sequence.
**Why:** Currently, refineTravelTimes() runs once at optimize time. After a drag reorder, travel times revert to the Haversine estimates that the optimizer used. This is acceptable for v1 but should be resolved before the app is used for serious trip planning.
**Context:** OV2 decision from autoplan: accepted for v1. Pre-existing gap (Haversine had same issue). A lightweight /api/refine route that accepts the current day sequence and returns refined times would avoid a full re-optimize.
**Blocked by:** Nothing
**Depends on:** Real routing implementation (sssss-main-design-20260626-134053.md)

---

## T8 — Proxy photo_url server-side to avoid API key in client JSON
**Priority:** P1 (UPGRADED from P2 — Directions API now also enabled on same exposed key)
**What:** `buildPhotoUrl()` in places.ts embeds `GOOGLE_PLACES_API_KEY` in the photo URL returned to the client. Anyone with browser devtools can extract the key. With Directions API now enabled on the same key, an extracted key can be used to make Directions API calls at the developer's expense.
**Why:** Key exposure risk is now higher — the key has both Places (New) AND Directions API permissions. A signed URL proxy (server-side photo serving) or separate read-only key for photos would close the exposure.
**Context:** T8 from autoplan N5. Codex #1 upgraded priority. Mitigation: (a) restrict the key to HTTP referrers (but breaks server-side calls), (b) use a separate API key for photo URLs with only Places Photo API scope, (c) proxy photos through /api/photo route that adds the key server-side.
**Blocked by:** Nothing
**Depends on:** Nothing

---

## T9 — Evaluate Routes API vs Directions API
**Priority:** P2
**What:** Evaluate switching directionsTime() from the legacy Directions API (`maps.googleapis.com/maps/api/directions/json`) to the newer Routes API (`routes.googleapis.com/directions/v2:computeRoutes`). Routes API supports traffic-aware ETAs, better transit options, and is Google's preferred future API.
**Why:** Directions API is legacy and on a deprecation roadmap. Routes API uses the same billing key and has better documentation. However, the response schema is different and would require changes to directionsTime() parsing.
**Context:** Autoplan T9 (P2). Not blocking v1 — Directions API works fine and delivers the same walking times for the use case.
**Blocked by:** Nothing
**Depends on:** Real routing implementation (sssss-main-design-20260626-134053.md)

---

## T10 — Fix DaySection stale visits state
**Priority:** P2
**What:** DaySection.tsx initializes `const [visits, setVisits] = useState(day.visits)` once from props. When a parent component (results/[id]/page.tsx) updates the itinerary (e.g., after a dwell change), DaySection's local `visits` state becomes stale. Opening hours and descriptions are static per place so display is correct, but arrival/departure times may be stale after edits.
**Why:** Codex #9 finding. Pre-existing issue — not introduced by the routing feature. The correct fix is to either remove local state (use `day.visits` directly from props) or add a `useEffect` that resets local state when `day` prop changes.
**Context:** Low visible impact for now since opening hours don't change per-visit. The issue manifests as stale timestamps in the display after dwell-time edits until page reload.
**Blocked by:** Nothing
**Depends on:** Nothing

---

## T12 — Add language=zh-TW to Places API (New) for localized hours + description
**Priority:** P2
**What:** Add `languageCode: 'zh-TW'` parameter to the Places API (New) `searchByText` or `getPlace` call in `resolvePlaces()`. This makes `weekday_descriptions` return Chinese-formatted strings like '09:00–21:00' (not '9:00 AM – 9:00 PM') and `editorialSummary` return Chinese text instead of English.
**Why:** The app is in Traditional Chinese but opening hours text (from DR5 in design review) is currently returned in English. Raw API text creates a jarring bilingual mismatch in the PlaceCard.
**Context:** DR5 decision from `/plan-design-review 2026-06-26`. Deferred to v1 because most Taiwanese users can read English hours format and the API call change is low-risk. The parameter is a single query param addition.
**Blocked by:** Nothing
**Depends on:** Real routing implementation (sssss-main-design-20260626-134053.md)

---

## T13 — Design token cleanup: replace Tailwind amber with CSS variables
**Priority:** P2
**What:** Replace `text-amber-600`/`border-amber-300`/`border-amber-500` hard-coded Tailwind classes with CSS variable tokens (e.g., `text-[var(--color-accent)]`, `border-[var(--color-accent-muted)]`) matching the established `#E8762C` accent from the design system.
**Why:** Prior learning `travel-tool-color-scheme` (confidence: 10/10) established `#E8762C` as the canonical amber accent. Tailwind's `amber-600` = `#D97706`, which is a different shade. Without CSS variables, every color usage has to be manually kept in sync.
**Context:** DR5 / Pass 5 from `/plan-design-review 2026-06-26`. Requires DESIGN.md (T4) to be written first so the CSS variable names are canonical.
**Blocked by:** T4 (DESIGN.md)
**Depends on:** T4

---

## T11 — Per-visit isEstimated flag
**Priority:** P2
**What:** The current `isEstimated: boolean` flag on OptimizeResponse is global — if any ONE travel pair falls back to Haversine, ALL travel times show `~`. This is misleading when most pairs have real data.
**Why:** Codex #6 finding. Global `isEstimated` accepted for v1. A per-visit flag would show `~` only on affected pairs: add `travel_minutes_estimated_from_prev: boolean` to the Visit type, set it per-pair in refineTravelTimes(), pass it down to PlaceCard.
**Context:** Global `isEstimated` accepted via OV1 autoplan decision. DaySection/PlaceCard already receive `isEstimated` prop — the per-visit upgrade is a backwards-compatible extension.
**Blocked by:** Nothing
**Depends on:** Real routing implementation (sssss-main-design-20260626-134053.md)

---

## T14 — Distinct Directions API status logging (ZERO_RESULTS, OVER_QUERY_LIMIT)
**Priority:** P2
**What:** `directionsTime()` previously only logged REQUEST_DENIED. Add distinct `console.warn` branches for ZERO_RESULTS ("no walking route found"), OVER_QUERY_LIMIT ("quota exhausted"), and a generic fallback for other non-OK statuses.
**Why:** Codex C3 finding from `/plan-devex-review 2026-06-26`. Without distinct logging, quota exhaustion and route-not-found both silently fall back to Haversine — impossible to distinguish in production logs whether the API is throttling or the route is genuinely unroutable.
**Context:** Fixed in plan (Step 4 of sssss-main-design-20260626-134053.md). The status → distinct warn → early-return pattern has been written into the plan.
**Blocked by:** Nothing
**Depends on:** Real routing implementation (sssss-main-design-20260626-134053.md)

---

## T15 — Add short-lived directionsTime() route cache
**Priority:** P3
**What:** Add a simple in-memory Map cache in `directionsTime()` keyed on `${lat1},${lng1},${lat2},${lng2},${mode}`. TTL: 60s (enough to survive a re-optimize in the same session). Same adjacent pair in the same plan call hits the cache instead of re-calling.
**Why:** Codex deferred finding from `/plan-devex-review 2026-06-26`. If a user optimizes, adjusts dwell time, then re-optimizes, the same lat/lng pairs are re-called. At $0.005/call this is low-cost but wasteful and adds ~3s latency per duplicate pair.
**Context:** Pure module-level cache (no external infra needed). The cache key is deterministic. Memory footprint is negligible (< 1KB per plan). Clear on cold-start (serverless function lifecycle handles it automatically on Vercel).
**Blocked by:** Nothing
**Depends on:** Real routing implementation (sssss-main-design-20260626-134053.md)

---

## T16 — Verify editorialSummary FieldMask doesn't change Places API billing SKU
**Priority:** P3
**What:** Confirm that adding `places.editorialSummary` to the Places API (New) FieldMask doesn't trigger a more expensive billing tier (e.g., "Atmosphere" vs "Basic"). Check GCP Places API pricing page for FieldMask → SKU mapping.
**Why:** Codex deferred finding from `/plan-devex-review 2026-06-26`. Google's Places API (New) bills per FieldMask group, not per-field. Unknown whether editorialSummary falls in a cheaper or more expensive group than the existing regularOpeningHours fields.
**Context:** If it's in a more expensive SKU, evaluate whether the brief editorial description is worth the cost delta. Add finding to GCP budget alert (T2).
**Blocked by:** Nothing
**Depends on:** T2 (GCP billing review already planned)
