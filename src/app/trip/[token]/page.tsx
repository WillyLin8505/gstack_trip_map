import { Loader2 } from "lucide-react";
import type { ScheduledItinerary } from "@/types";
import { DaySection } from "@/components/DaySection";

async function getItinerary(token: string): Promise<ScheduledItinerary | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/share?token=${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.itinerary ?? null;
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const itinerary = await getItinerary(token);

  if (!itinerary) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-xl font-semibold text-foreground">連結已失效</p>
          <p className="mt-2 text-sm text-muted-foreground">
            分享連結有效期為 30 天，此連結已過期或不存在
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm text-accent hover:opacity-80 transition-opacity"
          >
            重新規劃行程
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="inline-block text-xs text-muted-foreground bg-muted rounded-full px-3 py-1 mb-3">
          唯讀分享
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          {itinerary.city ? `${itinerary.city}行程` : "旅遊行程"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          共 {itinerary.days.length} 天 ·{" "}
          {itinerary.days.reduce((s, d) => s + d.visits.length, 0)} 個景點
          {itinerary.start_date && ` · 出發 ${itinerary.start_date}`}
        </p>
      </div>

      {itinerary.days.map((day) => (
        <DaySection
          key={day.day_number}
          day={day}
          start_date={itinerary.start_date ?? undefined}
          isEstimated={itinerary.isEstimated ?? false}
          readonly
        />
      ))}

      <div className="mt-8 text-center">
        <a
          href="/"
          className="text-sm text-accent hover:opacity-80 transition-opacity"
        >
          自己規劃行程 →
        </a>
      </div>
    </main>
  );
}
