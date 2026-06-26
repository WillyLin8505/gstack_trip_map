import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

function httpsGet(url: string): Promise<{ status: number; contentType: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode ?? 200,
        contentType: res.headers['content-type'] ?? 'image/jpeg',
        buffer: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

export async function GET(req: NextRequest) {
  const photoRef = req.nextUrl.searchParams.get('ref');
  if (!photoRef) return new NextResponse('Missing ref', { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return new NextResponse('Server misconfigured', { status: 500 });

  if (photoRef.includes('..') || photoRef.startsWith('/')) return new NextResponse('Invalid ref', { status: 400 });

  try {
    const url = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=800&key=${apiKey}`;
    const { status, contentType, buffer } = await httpsGet(url);
    if (status < 200 || status >= 300) return new NextResponse('Photo fetch failed', { status });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Photo fetch failed', { status: 502 });
  }
}
