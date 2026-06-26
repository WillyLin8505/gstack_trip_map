"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { MAX_PLACES_PER_REQUEST } from "@/lib/constants";

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function HomePage() {
  const router = useRouter();
  const [placeList, setPlaceList] = useState("");
  const [startDate, setStartDate] = useState("");
  const [numDays, setNumDays] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // D5 city fallback (when all places fail to resolve)
  const [showCityFallback, setShowCityFallback] = useState(false);
  const [fallbackCity, setFallbackCity] = useState("");

  const submitRef = useRef(false);

  const placeCount = placeList
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  async function runFlow(placeListText: string, city: string) {
    const names = placeListText
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

    // Step 1: resolve places (auto-detect city if none provided)
    const resolveRes = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_list: placeListText, city }),
    });

    if (!resolveRes.ok) {
      const err = await resolveRes.json().catch(() => ({}));
      throw new Error(err.error ?? "解析景點時發生錯誤");
    }

    const { places, warnings, detectedCity } = await resolveRes.json();

    if (places.length === 0) {
      setShowCityFallback(true);
      setError("找不到任何景點，請輸入城市名稱協助搜尋");
      return;
    }

    // Step 2: optimize into days
    const optimizeRes = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        places,
        city: detectedCity ?? city,
        start_date: startDate || undefined,
        ...(numDays !== undefined && { num_days: numDays }),
      }),
    });

    if (!optimizeRes.ok) {
      const err = await optimizeRes.json().catch(() => ({}));
      throw new Error(err.error ?? "規劃行程時發生錯誤");
    }

    const { itinerary, isEstimated } = await optimizeRes.json();

    if (warnings?.length) {
      sessionStorage.setItem(`warnings-${itinerary.id}`, JSON.stringify(warnings));
    }
    if (numDays !== undefined) {
      sessionStorage.setItem(`requestedNumDays-${itinerary.id}`, String(numDays));
    }
    sessionStorage.setItem(`itinerary-${itinerary.id}`, JSON.stringify(itinerary));
    sessionStorage.setItem(`isEstimated-${itinerary.id}`, JSON.stringify(isEstimated ?? false));

    router.push(`/results/${itinerary.id}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitRef.current || loading) return;
    submitRef.current = true;
    setLoading(true);
    setError(null);
    setShowCityFallback(false);

    try {
      await runFlow(placeList, "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
      submitRef.current = false;
    }
  }

  async function handleRetryWithCity() {
    if (!fallbackCity.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      await runFlow(placeList, fallbackCity.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setLoading(false);
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

          {/* Days chips */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              行程天數
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setNumDays(undefined)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  numDays === undefined
                    ? "bg-accent text-white border-accent"
                    : "bg-white text-muted-foreground border-border hover:border-accent hover:text-accent"
                }`}
                disabled={loading}
              >
                自動
              </button>
              {DAY_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumDays(n)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    numDays === n
                      ? "bg-accent text-white border-accent"
                      : "bg-white text-muted-foreground border-border hover:border-accent hover:text-accent"
                  }`}
                  disabled={loading}
                >
                  {n}天
                </button>
              ))}
            </div>
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

          {/* D5 city fallback */}
          {showCityFallback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
              <p className="text-sm text-amber-800 font-medium">
                請輸入旅遊城市以協助搜尋
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fallbackCity}
                  onChange={(e) => setFallbackCity(e.target.value)}
                  placeholder="例：台北、東京、曼谷"
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
                  disabled={loading}
                  onKeyDown={(e) => e.key === "Enter" && handleRetryWithCity()}
                />
                <button
                  type="button"
                  onClick={handleRetryWithCity}
                  disabled={loading || !fallbackCity.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "重新搜尋"}
                </button>
              </div>
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
