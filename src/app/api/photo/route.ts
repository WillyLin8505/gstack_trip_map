import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const photoRef = req.nextUrl.searchParams.get('ref');
  if (!photoRef) return new NextResponse('Missing ref', { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return new NextResponse('Server misconfigured', { status: 500 });

  const url = `https://places.googleapis.com/v1/${encodeURIComponent(photoRef)}/media?maxWidthPx=800&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return new NextResponse('Photo fetch failed', { status: res.status });

  const blob = await res.blob();
  return new NextResponse(blob, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
