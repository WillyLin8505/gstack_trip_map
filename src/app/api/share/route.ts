import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import type { ScheduledItinerary } from "@/types";

// T1 BLOCKER: Supabase cache disabled until Google Maps Platform ToS §12 is verified.
// When T1 resolves: import supabase client, persist itinerary with share_token + 30d TTL.
// For now: store in a simple in-process map (development only).
const shareStore = new Map<string, { itinerary: ScheduledItinerary; expires: number }>();

export async function POST(req: NextRequest) {
  try {
    const { itinerary } = await req.json() as { itinerary: ScheduledItinerary };

    if (!itinerary?.id) {
      return NextResponse.json({ error: "itinerary is required" }, { status: 400 });
    }

    const token = uuidv4();
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    shareStore.set(token, { itinerary: { ...itinerary, share_token: token }, expires });

    return NextResponse.json({ token });
  } catch (err) {
    console.error("[api/share POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

  const entry = shareStore.get(token);
  if (!entry || entry.expires < Date.now()) {
    return NextResponse.json({ error: "分享連結已失效" }, { status: 404 });
  }

  return NextResponse.json({ itinerary: entry.itinerary });
}
