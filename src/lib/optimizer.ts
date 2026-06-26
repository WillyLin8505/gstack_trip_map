import type { Place, Day, Visit, ScheduledItinerary } from "@/types";
import { DAY_COLORS, DAY_MINUTES, TRAVEL_BUFFER_MINUTES } from "./constants";
import { addMinutes, travelMinutes } from "./utils";
import { v4 as uuidv4 } from "uuid";

// k-means++ with fixed seed for deterministic output
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

type Point = { lat: number; lng: number; idx: number };

function kmeanspp(points: Point[], k: number, rand: () => number): number[][] {
  // Select first centroid randomly
  const centroids: Point[] = [points[Math.floor(rand() * points.length)]];

  while (centroids.length < k) {
    // Distance-squared weighted selection
    const dists = points.map((p) =>
      Math.min(...centroids.map((c) => (p.lat - c.lat) ** 2 + (p.lng - c.lng) ** 2))
    );
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let chosen = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push(points[chosen]);
  }

  // Iterate k-means
  let assignments = new Array(points.length).fill(0);
  for (let iter = 0; iter < 100; iter++) {
    const newAssignments = points.map((p) => {
      let best = 0, bestDist = Infinity;
      centroids.forEach((c, ci) => {
        const d = (p.lat - c.lat) ** 2 + (p.lng - c.lng) ** 2;
        if (d < bestDist) { bestDist = d; best = ci; }
      });
      return best;
    });

    if (newAssignments.every((a, i) => a === assignments[i])) break;
    assignments = newAssignments;

    // Recompute centroids
    for (let ci = 0; ci < k; ci++) {
      const members = points.filter((_, i) => assignments[i] === ci);
      if (members.length === 0) continue;
      centroids[ci] = {
        lat: members.reduce((s, p) => s + p.lat, 0) / members.length,
        lng: members.reduce((s, p) => s + p.lng, 0) / members.length,
        idx: -1,
      };
    }
  }

  // Group by cluster
  const clusters: number[][] = Array.from({ length: k }, () => []);
  assignments.forEach((ci, i) => clusters[ci].push(points[i].idx));
  return clusters.filter((c) => c.length > 0);
}

// Greedy nearest-neighbor TSP within a cluster
function nearestNeighbor(places: Place[]): Place[] {
  if (places.length <= 1) return places;
  const visited = new Set<number>();
  const result: Place[] = [];
  let current = 0;
  visited.add(0);
  result.push(places[0]);

  while (result.length < places.length) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < places.length; i++) {
      if (visited.has(i)) continue;
      const d = travelMinutes(
        places[current].lat, places[current].lng,
        places[i].lat, places[i].lng
      );
      if (d < bestDist) { bestDist = d; best = i; }
    }
    visited.add(best);
    result.push(places[best]);
    current = best;
  }
  return result;
}

// 2-opt improvement pass
function twoOpt(places: Place[]): Place[] {
  if (places.length <= 3) return places;
  let improved = true;
  let route = [...places];

  const routeLength = (r: Place[]) =>
    r.reduce((sum, p, i) => {
      if (i === 0) return sum;
      return sum + travelMinutes(r[i - 1].lat, r[i - 1].lng, p.lat, p.lng);
    }, 0);

  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const newRoute = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1),
        ];
        if (routeLength(newRoute) < routeLength(route)) {
          route = newRoute;
          improved = true;
        }
      }
    }
  }
  return route;
}

function scheduleDay(
  places: Place[],
  dayNumber: number,
  startTime: string
): Day {
  const ordered = twoOpt(nearestNeighbor(places));
  let currentTime = startTime;
  const visits: Visit[] = [];
  let totalTravel = 0;
  let totalDwell = 0;

  ordered.forEach((place, i) => {
    const travel = i === 0
      ? 0
      : travelMinutes(ordered[i - 1].lat, ordered[i - 1].lng, place.lat, place.lng);

    if (i > 0) {
      currentTime = addMinutes(currentTime, travel + TRAVEL_BUFFER_MINUTES);
    }

    const arrival = currentTime;
    const departure = addMinutes(currentTime, place.dwell_minutes);
    const openingWarning = isClosedDuringVisit(place, arrival, departure);

    visits.push({
      place,
      arrival_time: arrival,
      departure_time: departure,
      travel_minutes_from_prev: travel,
      opening_warning: openingWarning,
    });

    totalTravel += travel;
    totalDwell += place.dwell_minutes;
    currentTime = departure;
  });

  return {
    day_number: dayNumber,
    color: DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length],
    visits,
    total_travel_minutes: totalTravel,
    total_dwell_minutes: totalDwell,
  };
}

function isClosedDuringVisit(place: Place, arrival: string, departure: string): boolean {
  if (!place.opening_hours?.periods?.length) return false;
  // Simplified check: if open_now is known false, flag it
  if (place.opening_hours.open_now === false) return true;
  return false;
}

export function optimize(
  places: Place[],
  city: string,
  startDate?: string,
  startTime = "09:00"
): ScheduledItinerary {
  const totalDwell = places.reduce((s, p) => s + p.dwell_minutes, 0);
  const travelEstimate = (places.length - 1) * TRAVEL_BUFFER_MINUTES;
  const k = Math.max(1, Math.ceil((totalDwell + travelEstimate) / DAY_MINUTES));

  const rand = seededRand(42);
  const points: Point[] = places.map((p, i) => ({ lat: p.lat, lng: p.lng, idx: i }));
  const clusters = k === 1 ? [places.map((_, i) => i)] : kmeanspp(points, k, rand);

  const days: Day[] = clusters.map((cluster, di) => {
    const clusterPlaces = cluster.map((i) => places[i]);
    return scheduleDay(clusterPlaces, di + 1, startTime);
  });

  return {
    id: uuidv4(),
    place_list_raw: places.map((p) => p.name).join("\n"),
    city,
    start_date: startDate ?? null,
    start_time: startTime,
    days,
    created_at: new Date().toISOString(),
    share_token: null,
    user_id: null,
  };
}
