# Trip Map

AI-assisted travel itinerary planner using Google Places API (New) + Directions API.

## Setup (5 steps, ~8 min including GCP)

1. **Prerequisites**: Node 18+, a Google Cloud account with billing enabled.

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create GCP API key**:
   - Open [GCP Console → APIs & Services → Enable APIs](https://console.cloud.google.com/apis/library)
   - Enable: **Places API (New)** and **Directions API** (same project)
   - Open [Credentials](https://console.cloud.google.com/apis/credentials) → Create API key

4. **Configure environment**:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local, replace `your_google_cloud_api_key` with your key
   ```

5. **Start the dev server**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000. Enter a list of places, click optimize.

## Architecture

- `src/app/api/resolve/` — resolves place names → Place objects via Places API (New)
- `src/app/api/optimize/` — optimizes route, calls Directions API for walking times
- `src/app/api/photo/` — server-side photo proxy (API key never sent to client)
- `src/lib/places.ts` — server-only; contains Google API calls (never sent to client)
- `src/components/PlaceCard.tsx` — displays place info, opening hours, travel time

## TODOS

See [TODOS.md](TODOS.md) for known gaps and planned improvements.
