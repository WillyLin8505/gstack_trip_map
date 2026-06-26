"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { MAX_PLACES_PER_REQUEST } from "@/lib/constants";

export default function HomePage() {
  const router = useRouter();
  const [placeList, setPlaceList] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitRef = useRef(false);

  const placeCount = placeList
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitRef.current || loading) return;
    submitRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const names = placeList
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (names.length === 0) {
        setError("請輸入至少一個景點");
        return;
      }
      if (names.length > MAX_PLACES_PER_REQUEST) {
        setError(`最多支援 ${MAX_PLACES_PER_REQUEST} 個景點`);
        return;
      }

      // Step 1: resolve place names to coordinates
      const resolveRes = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_list: placeList, city }),
      });

      if (!resolveRes.ok) {
        const err = await resolveRes.json().catch(() => ({}));
        throw new Error(err.error ?? "解析景點時發生錯誤");
      }

      const { places, warnings } = await resolveRes.json();

      if (places.length === 0) {
        setError("找不到任何景點，請確認輸入是否正確");
        return;
      }

      // Step 2: optimize into days
      const optimizeRes = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places, city, start_date: startDate || undefined }),
      });

      if (!optimizeRes.ok) {
        const err = await optimizeRes.json().catch(() => ({}));
        throw new Error(err.error ?? "規劃行程時發生錯誤");
      }

      const { itinerary, isEstimated } = await optimizeRes.json();

      // Pass warnings via sessionStorage for the results page
      if (warnings?.length) {
        sessionStorage.setItem(`warnings-${itinerary.id}`, JSON.stringify(warnings));
      }
      sessionStorage.setItem(`itinerary-${itinerary.id}`, JSON.stringify(itinerary));
      sessionStorage.setItem(`isEstimated-${itinerary.id}`, JSON.stringify(isEstimated ?? false));

      router.push(`/results/${itinerary.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
      submitRef.current = false;
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent mb-4">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            旅遊行程規劃
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            輸入景點清單，自動分配天數與規劃最佳路線
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Place list textarea */}
          <div>
            <label
              htmlFor="place-list"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              景點清單
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                每行一個，最多 {MAX_PLACES_PER_REQUEST} 個
              </span>
            </label>
            <textarea
              id="place-list"
              value={placeList}
              onChange={(e) => setPlaceList(e.target.value)}
              placeholder={"台北101\n故宮博物院\n士林夜市\n九份老街\n淡水老街"}
              rows={8}
              className="w-full rounded-lg border border-border bg-white px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              disabled={loading}
            />
            {placeCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                已輸入 {placeCount} 個景點
              </p>
            )}
          </div>

          {/* City */}
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              城市
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                選填，提升搜尋精準度
              </span>
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="台北"
              className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={loading}
            />
          </div>

          {/* Start date */}
          <div>
            <label
              htmlFor="start-date"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              出發日期
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                選填
              </span>
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || placeCount === 0}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent text-white font-medium px-4 py-3 text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                規劃中…
              </>
            ) : (
              "開始規劃行程"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
