import 'server-only';

import pLimit from "p-limit";
import type { Place, Day } from "@/types";
import { DEFAULT_DWELL_MINUTES, TRAVEL_BUFFER_MINUTES } from "./constants";
import { travelMinutes, addMinutes, openingWarningForVisit } from "@/lib/utils";

const PLACES_API_BASE = "https://places.googleapis.com/v1";
const limit = pLimit(5);

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryTypeDisplayName?: { text: string };
  priceLevel?: string;
  rating?: number;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  editorialSummary?: { text?: string };
  photos?: Array<{ name: string }>;
}

function parsePriceLevel(level: string | undefined): 0 | 1 | 2 | 3 | 4 | null {
  const map: Record<string, 0 | 1 | 2 | 3 | 4> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return level ? (map[level] ?? null) : null;
}

function buildPhotoUrl(photoName: string | undefined): string | null {
  if (!photoName) return null;
  return `/api/photo?ref=${encodeURIComponent(photoName)}`;
}

async function searchPlace(query: string, city: string): Promise<GooglePlace | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error(
    'GOOGLE_PLACES_API_KEY not set. Copy .env.local.example to .env.local and add your Google Cloud API key. Enable Places API (New) + Directions API in GCP Console.'
  );

  const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryTypeDisplayName",
        "places.priceLevel",
        "places.rating",
        "places.regularOpeningHours",
        "places.editorialSummary",
        "places.regularOpeningHours.weekdayDescriptions",
        "places.photos",
      ].join(","),
    },
    body: JSON.stringify({ textQuery: `${query} ${city}`, maxResultCount: 1 }),
  });

  if (res.status === 401 || res.status === 403) {
    console.error(`[places] API key invalid or quota exceeded (${res.status})`);
    throw new Error("系統配置錯誤，請稍後再試");
  }

  if (!res.ok) return null;
  const data = await res.json();
  return data.places?.[0] ?? null;
}

async function directionsTime(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  mode = "walking"
): Promise<{ minutes: number; estimated: boolean }> {
  if (Math.abs(lat1) < 0.01 && Math.abs(lng1) < 0.01) {
    return { minutes: travelMinutes(lat1, lng1, lat2, lng2), estimated: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const params = new URLSearchParams({
      origin: `${lat1},${lng1}`,
      destination: `${lat2},${lng2}`,
      mode,
      key: process.env.GOOGLE_PLACES_API_KEY ?? '',
    });
    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();
    if (data.status !== 'OK') {
      if (data.status === 'REQUEST_DENIED') {
        console.warn('[Directions API] REQUEST_DENIED — check Directions API is enabled in GCP Console');
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        console.warn('[Directions API] OVER_QUERY_LIMIT — quota exhausted, falling back to estimate');
      } else if (data.status === 'ZERO_RESULTS') {
        console.warn('[Directions API] ZERO_RESULTS — no walking route found, falling back to estimate');
      } else {
        console.warn(`[Directions API] ${data.status} — falling back to estimate`);
      }
      return { minutes: travelMinutes(lat1, lng1, lat2, lng2), estimated: true };
    }
    if (!data.routes?.[0]) {
      return { minutes: travelMinutes(lat1, lng1, lat2, lng2), estimated: true };
    }
    return { minutes: Math.max(1, Math.round(data.routes[0].legs[0].duration.value / 60)), estimated: false };
  } catch {
    return { minutes: travelMinutes(lat1, lng1, lat2, lng2), estimated: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function refineTravelTimes(
  days: Day[], mode = "walking", startDate?: string
): Promise<{ days: Day[]; isEstimated: boolean }> {
  try {
    let anyEstimated = false;
    const startDayOfWeek = startDate
      ? new Date(startDate + 'T12:00:00').getDay()
      : new Date().getDay();

    const updatedDays = await Promise.all(days.map(async (day) => {
      if (day.visits.length < 2) return day;
      const results = await Promise.all(
        day.visits.slice(0, -1).map((_, i) =>
          limit(() => directionsTime(
            day.visits[i].place.lat, day.visits[i].place.lng,
            day.visits[i + 1].place.lat, day.visits[i + 1].place.lng,
            mode
          ))
        )
      );
      const newVisits = [...day.visits];
      for (let i = 0; i < results.length; i++) {
        const { minutes, estimated } = results[i];
        if (estimated) anyEstimated = true;
        newVisits[i + 1] = { ...newVisits[i + 1], travel_minutes_from_prev: minutes };
      }
      const visitDayOfWeek = (startDayOfWeek + 6 + (day.day_number - 1)) % 7;
      for (let i = 1; i < newVisits.length; i++) {
        const prev = newVisits[i - 1];
        const arrival = addMinutes(prev.departure_time, newVisits[i].travel_minutes_from_prev + TRAVEL_BUFFER_MINUTES);
        const departure = addMinutes(arrival, newVisits[i].place.dwell_minutes);
        newVisits[i] = {
          ...newVisits[i],
          arrival_time: arrival,
          departure_time: departure,
          opening_warning: openingWarningForVisit(newVisits[i].place.weekday_descriptions, visitDayOfWeek, arrival),
        };
      }
      return {
        ...day,
        visits: newVisits,
        total_travel_minutes: newVisits.slice(1).reduce((s, v) => s + v.travel_minutes_from_prev, 0),
      };
    }));
    return { days: updatedDays, isEstimated: anyEstimated };
  } catch {
    return { days, isEstimated: true };
  }
}

function extractCity(formattedAddress: string): string | null {
  const parts = formattedAddress.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const candidate = parts[parts.length - 2] ?? null;
  if (!candidate) return null;
  return candidate.replace(/\s+[\d][\d-]+$/, '').trim() || null;
}

export async function resolvePlaces(
  names: string[],
  city: string
): Promise<{ places: Place[]; warnings: string[]; detectedCity: string }> {
  const warnings: string[] = [];
  const seen = new Set<string>();

  // Auto-detect city from the first resolvable place if none provided
  let detectedCity = city;
  if (!city) {
    for (const name of names) {
      const gp = await searchPlace(name, "");
      if (gp?.formattedAddress) {
        const extracted = extractCity(gp.formattedAddress);
        if (extracted) { detectedCity = extracted; break; }
      }
    }
  }

  const results = await Promise.all(
    names.map((name) =>
      limit(async () => {
        try {
          const gp = await searchPlace(name, detectedCity);
          if (!gp) {
            warnings.push(`找不到「${name}」，已略過`);
            return null;
          }

          if (seen.has(gp.id)) {
            warnings.push(`「${name}」與其他地點重複，已略過`);
            return null;
          }
          seen.add(gp.id);

          const place: Place = {
            id: gp.id,
            name: gp.displayName?.text ?? name,
            address: gp.formattedAddress ?? "",
            lat: gp.location?.latitude ?? 0,
            lng: gp.location?.longitude ?? 0,
            category: gp.primaryTypeDisplayName?.text ?? "景點",
            price_level: parsePriceLevel(gp.priceLevel),
            rating: gp.rating ?? null,
            opening_hours: gp.regularOpeningHours
              ? {
                  open_now: gp.regularOpeningHours.openNow ?? null,
                  periods: (gp.regularOpeningHours.periods ?? []).map((p) => ({
                    open: p.open,
                    close: p.close ?? null,
                  })),
                }
              : null,
            photo_url: buildPhotoUrl(gp.photos?.[0]?.name),
            dwell_minutes: DEFAULT_DWELL_MINUTES,
            description: gp.editorialSummary?.text,
            weekday_descriptions: gp.regularOpeningHours?.weekdayDescriptions ?? null,
          };

          return place;
        } catch (err) {
          if (err instanceof Error && err.message.includes("系統配置")) throw err;
          warnings.push(`解析「${name}」時發生錯誤，已略過`);
          return null;
        }
      })
    )
  );

  return {
    places: results.filter((p): p is Place => p !== null),
    warnings,
    detectedCity,
  };
}
