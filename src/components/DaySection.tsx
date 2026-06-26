"use client";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Day, Visit, UserCategory } from "@/types";
import { PlaceCard } from "./PlaceCard";
import { DAY_COLORS } from "@/lib/constants";

interface DaySectionProps {
  day: Day;
  start_date?: string;
  isEstimated?: boolean;
  onDwellChange?: (dayNumber: number, placeId: string, minutes: number) => void;
  onCategoryChange?: (dayNumber: number, placeId: string, category: UserCategory) => void;
  onLockToggle?: (dayNumber: number, placeId: string, locked: boolean) => void;
  readonly?: boolean;
}

function SortableVisit({
  visit,
  dayColor,
  position,
  openingHoursText,
  isEstimated,
  onDwellChange,
  onCategoryChange,
  onLockToggle,
  readonly,
}: {
  visit: Visit;
  dayColor: string;
  position: number;
  openingHoursText: string | null;
  isEstimated?: boolean;
  onDwellChange?: (minutes: number) => void;
  onCategoryChange?: (category: UserCategory) => void;
  onLockToggle?: (locked: boolean) => void;
  readonly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: visit.place.id, disabled: readonly });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div className="flex items-start gap-1">
        {!readonly && (
          <button
            {...attributes}
            {...listeners}
            className="mt-2 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label={`拖曳移動 ${visit.place.name}`}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1">
          <PlaceCard
            visit={visit}
            dayColor={dayColor}
            position={position}
            openingHoursText={openingHoursText}
            isEstimated={isEstimated}
            onDwellChange={onDwellChange}
            onCategoryChange={onCategoryChange}
            onLockToggle={onLockToggle}
            readonly={readonly}
          />
        </div>
      </div>
    </div>
  );
}

export function DaySection({ day, start_date, isEstimated, onDwellChange, onCategoryChange, onLockToggle, readonly }: DaySectionProps) {
  const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length];

  const startDay = start_date
    ? new Date(start_date + 'T12:00:00').getDay()
    : new Date().getDay();

  // Droppable zone for the entire day (catches drops on empty days or between items)
  const droppableId = `day-${day.day_number}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <section className="mb-8">
      {/* Day header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
          style={{ backgroundColor: color }}
        >
          {day.day_number}
        </div>
        <div>
          <h2 className="font-semibold text-foreground">第 {day.day_number} 天</h2>
          <p className="text-xs text-muted-foreground">
            {day.visits.length} 個景點 · 移動約 {day.total_travel_minutes} 分鐘
          </p>
        </div>
      </div>

      {/* Sortable visits */}
      <div
        ref={setNodeRef}
        className={
          day.visits.length === 0
            ? `min-h-14 rounded-lg border-2 border-dashed transition-colors ${
                isOver ? "border-accent bg-accent/5" : "border-border"
              } flex items-center justify-center`
            : ""
        }
      >
        {day.visits.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isOver ? "放在這裡" : "（無景點）"}
          </p>
        )}

        <SortableContext
          items={day.visits.map((v) => v.place.id)}
          strategy={verticalListSortingStrategy}
        >
          {day.visits.map((visit, i) => {
            const dayIndex = (startDay + 6 + (day.day_number - 1)) % 7;
            const openingHoursText =
              visit.place.weekday_descriptions?.[dayIndex]
                ?.replace(/^[^:]+:\s*/, '') ?? null;

            return (
              <SortableVisit
                key={visit.place.id}
                visit={visit}
                dayColor={color}
                position={i + 1}
                openingHoursText={openingHoursText}
                isEstimated={isEstimated}
                onDwellChange={
                  onDwellChange
                    ? (mins) => onDwellChange(day.day_number, visit.place.id, mins)
                    : undefined
                }
                onCategoryChange={
                  onCategoryChange
                    ? (cat) => onCategoryChange(day.day_number, visit.place.id, cat)
                    : undefined
                }
                onLockToggle={
                  onLockToggle
                    ? (locked) => onLockToggle(day.day_number, visit.place.id, locked)
                    : undefined
                }
                readonly={readonly}
              />
            );
          })}
        </SortableContext>
      </div>
    </section>
  );
}
