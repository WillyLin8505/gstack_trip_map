import { NextRequest, NextResponse } from "next/server";
import { optimize } from "@/lib/optimizer";
import { refineTravelTimes } from "@/lib/places";
import { MAX_PLACES_PER_REQUEST } from "@/lib/constants";
import type { Place } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { places, city, start_date, start_time } = await req.json();

    if (!Array.isArray(places) || places.length === 0) {
      return NextResponse.json({ error: "places is required" }, { status: 400 });
    }

    if (places.length > MAX_PLACES_PER_REQUEST) {
      return NextResponse.json({ error: 'Too many places' }, { status: 400 });
    }

    const itinerary = optimize(
      places as Place[],
      city ?? "",
      start_date,
      start_time
    );

    let finalDays = itinerary.days;
    let isEstimated = false;
    try {
      const refined = await refineTravelTimes(itinerary.days);
      finalDays = refined.days;
      isEstimated = refined.isEstimated;
    } catch {
      isEstimated = true;
    }

    const finalItinerary = { ...itinerary, days: finalDays, isEstimated };
    return NextResponse.json({ itinerary: finalItinerary, isEstimated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[api/optimize]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
