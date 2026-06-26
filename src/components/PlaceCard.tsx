"use client";

import { Star, Clock, AlertTriangle, DoorOpen, Lock, LockOpen } from "lucide-react";
import type { Visit, UserCategory } from "@/types";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CATEGORIES: UserCategory[] = ["餐廳", "景點", "點心"];

function nextCategory(current: UserCategory): UserCategory {
  const idx = CATEGORIES.indexOf(current);
  return CATEGORIES[(idx + 1) % CATEGORIES.length];
}

const categoryColors: Record<UserCategory, string> = {
  餐廳: "bg-red-100 text-red-700",
  景點: "bg-green-100 text-green-700",
  點心: "bg-yellow-100 text-yellow-700",
};

interface PlaceCardProps {
  visit: Visit;
  dayColor: string;
  position: number;
  openingHoursText?: string | null;
  isEstimated?: boolean;
  onDwellChange?: (minutes: number) => void;
  onCategoryChange?: (category: UserCategory) => void;
  onLockToggle?: (locked: boolean) => void;
  readonly?: boolean;
}

export function PlaceCard({
  visit,
  dayColor,
  position,
  openingHoursText,
  isEstimated,
  onDwellChange,
  onCategoryChange,
  onLockToggle,
  readonly = false,
}: PlaceCardProps) {
  const { place, arrival_time, departure_time, travel_minutes_from_prev, opening_warning, overstay_warning, locked } = visit;
  const userCategory: UserCategory = place.user_category ?? "景點";

  return (
    <div className="relative flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{ backgroundColor: dayColor }}
        >
          {position}
        </div>
        <div className="w-px flex-1 mt-1" style={{ backgroundColor: dayColor, opacity: 0.2 }} />
      </div>

      {/* Card */}
      <div
        className={cn(
          "flex-1 mb-4 rounded-lg border bg-white p-3.5 shadow-sm",
          locked ? "border-l-2 border-l-blue-400 border-border" : "",
          opening_warning && !locked ? "border-amber-300" : !locked ? "border-border" : ""
        )}
      >
        {/* Travel indicator */}
        {position > 1 && travel_minutes_from_prev > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            {isEstimated ? '~' : '+'}{travel_minutes_from_prev} 分鐘移動
          </p>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{place.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{place.address}</p>

            {place.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {place.description}
              </p>
            )}
          </div>

          <div className="flex items-start gap-1.5 shrink-0">
            {place.photo_url && (
              <img
                src={place.photo_url}
                alt={place.name}
                className="w-12 h-12 rounded-md object-cover"
              />
            )}
            {/* Lock toggle */}
            {!readonly && onLockToggle && (
              <button
                onClick={() => onLockToggle(!locked)}
                className={cn(
                  "p-1 rounded transition-colors",
                  locked
                    ? "text-blue-500 hover:text-blue-700"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={locked ? "解除鎖定" : "鎖定到達時間"}
                aria-label={locked ? `解除 ${place.name} 的鎖定` : `鎖定 ${place.name} 的到達時間`}
              >
                {locked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Time */}
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {locked && <Lock className="w-2.5 h-2.5 text-blue-400" />}
            {formatTime(arrival_time)} – {formatTime(departure_time)}
          </span>

          {/* Category badge — clickable */}
          {!readonly && onCategoryChange ? (
            <button
              onClick={() => onCategoryChange(nextCategory(userCategory))}
              className={cn("rounded-full px-2 py-0.5 font-medium transition-opacity hover:opacity-80", categoryColors[userCategory])}
              title="點擊切換分類"
            >
              {userCategory}
            </button>
          ) : (
            <span className={cn("rounded-full px-2 py-0.5 font-medium", categoryColors[userCategory])}>
              {userCategory}
            </span>
          )}

          {/* Rating */}
          {place.rating && (
            <span className="flex items-center gap-0.5 text-amber-500">
              <Star className="w-3 h-3 fill-current" />
              {place.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Opening hours + warning */}
        {openingHoursText ? (
          <div
            className={cn(
              "flex items-center gap-1 text-xs mt-1",
              opening_warning && "text-amber-600"
            )}
            {...(opening_warning ? { role: "status" } : {})}
          >
            {opening_warning && (
              <span className="sr-only">請注意：此景點可能在您到訪時間尚未開放。</span>
            )}
            <DoorOpen className="w-3 h-3 shrink-0" />
            <span className="truncate" title={openingHoursText}>{openingHoursText}</span>
          </div>
        ) : opening_warning ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>請注意：此景點可能在您到訪時間尚未開放</span>
          </div>
        ) : null}

        {/* Overstay warning */}
        {overstay_warning && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-orange-600">
            <Clock className="w-3 h-3 shrink-0" />
            <span>提醒：您的停留時間可能延伸至關門後</span>
          </div>
        )}

        {/* Dwell time editor */}
        {!readonly && onDwellChange && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">停留時間</span>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={place.dwell_minutes}
              onChange={(e) => onDwellChange(Number(e.target.value))}
              className="w-16 rounded border border-border px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label={`${place.name} 停留時間（分鐘）`}
            />
            <span className="text-xs text-muted-foreground">分鐘</span>
          </div>
        )}
      </div>
    </div>
  );
}
