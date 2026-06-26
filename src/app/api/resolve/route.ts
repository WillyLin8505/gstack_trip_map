import { NextRequest, NextResponse } from "next/server";
import { resolvePlaces } from "@/lib/places";
import { MAX_PLACES_PER_REQUEST } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { place_list, city } = await req.json();

    if (typeof place_list !== "string" || place_list.trim().length === 0) {
      return NextResponse.json({ error: "place_list is required" }, { status: 400 });
    }

    const names = place_list
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean);

    if (names.length > MAX_PLACES_PER_REQUEST) {
      return NextResponse.json(
        { error: `最多支援 ${MAX_PLACES_PER_REQUEST} 個景點` },
        { status: 400 }
      );
    }

    const { places, warnings } = await resolvePlaces(names, city ?? "");
    return NextResponse.json({ places, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[api/resolve]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
