"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Share2, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ScheduledItinerary, Visit } from "@/types";
import { DaySection } from "@/components/DaySection";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [itinerary, setItinerary] = useState<ScheduledItinerary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [isEstimated, setIsEstimated] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(`itinerary-${params.id}`);
    if (!raw) { router.replace("/"); return; }
    setItinerary(JSON.parse(raw));

    const warns = sessionStorage.getItem(`warnings-${params.id}`);
    if (warns) setWarnings(JSON.parse(warns));

    const est = sessionStorage.getItem(`isEstimated-${params.id}`);
    if (est) setIsEstimated(JSON.parse(est));
  }, [params.id, router]);

  function handleReorder(dayNumber: number, newVisits: Visit[]) {
    if (!itinerary) return;
    const updated = {
      ...itinerary,
      days: itinerary.days.map((d) =>
        d.day_number === dayNumber ? { ...d, visits: newVisits } : d
      ),
    };
    setItinerary(updated);
    sessionStorage.setItem(`itinerary-${params.id}`, JSON.stringify(updated));
  }

  function handleDwellChange(dayNumber: number, placeId: string, minutes: number) {
    if (!itinerary) return;
    const updated = {
      ...itinerary,
      days: itinerary.days.map((d) =>
        d.day_number === dayNumber
          ? {
              ...d,
              visits: d.visits.map((v) =>
                v.place.id === placeId
                  ? { ...v, place: { ...v.place, dwell_minutes: minutes } }
                  : v
              ),
            }
          : d
      ),
    };
    setItinerary(updated);
    sessionStorage.setItem(`itinerary-${params.id}`, JSON.stringify(updated));
  }

  async function handleShare() {
    if (!itinerary || sharing) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itinerary }),
      });
      const { token } = await res.json();
      const url = `${window.location.origin}/trip/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setSharing(false);
    }
  }

  if (!itinerary) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          重新規劃
        </button>

        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {sharing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : copied ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          {copied ? "已複製連結" : "分享行程"}
        </button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          {itinerary.city ? `${itinerary.city}行程` : "旅遊行程"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          共 {itinerary.days.length} 天 ·{" "}
          {itinerary.days.reduce((s, d) => s + d.visits.length, 0)} 個景點
          {itinerary.start_date && ` · 出發 ${itinerary.start_date}`}
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 space-y-1">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            部分景點注意事項
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs">• {w}</p>
          ))}
        </div>
      )}

      {/* Days */}
      {itinerary.days.map((day) => (
        <DaySection
          key={day.day_number}
          day={day}
          start_date={itinerary.start_date ?? undefined}
          isEstimated={isEstimated}
          onReorder={handleReorder}
          onDwellChange={handleDwellChange}
        />
      ))}
    </main>
  );
}
