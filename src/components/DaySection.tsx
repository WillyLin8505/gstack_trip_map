"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Day, Visit } from "@/types";
import { PlaceCard } from "./PlaceCard";
import { DAY_COLORS } from "@/lib/constants";

interface DaySectionProps {
  day: Day;
  start_date?: string;
  isEstimated?: boolean;
  onReorder?: (dayNumber: number, newVisits: Visit[]) => void;
  onDwellChange?: (dayNumber: number, placeId: string, minutes: number) => void;
  readonly?: boolean;
}

function SortableVisit({
  visit,
  dayColor,
  position,
  openingHoursText,
  isEstimated,
  onDwellChange,
  readonly,
}: {
  visit: Visit;
  dayColor: string;
  position: number;
  openingHoursText: string | null;
  isEstimated?: boolean;
  onDwellChange?: (minutes: number) => void;
  readonly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: visit.place.id, disabled: readonly });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-dragging={isDragging}
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
            readonly={readonly}
          />
        </div>
      </div>
    </div>
  );
}

export function DaySection({ day, start_date, isEstimated, onReorder, onDwellChange, readonly }: DaySectionProps) {
  const [visits, setVisits] = useState<Visit[]>(day.visits);
  const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length];

  const startDay = start_date
    ? new Date(start_date + 'T12:00:00').getDay()
    : new Date().getDay();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = visits.findIndex((v) => v.place.id === active.id);
    const newIdx = visits.findIndex((v) => v.place.id === over.id);
    const reordered = arrayMove(visits, oldIdx, newIdx);
    setVisits(reordered);
    onReorder?.(day.day_number, reordered);
  }

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
            {visits.length} 個景點 · 移動約 {day.total_travel_minutes} 分鐘
          </p>
        </div>
      </div>

      {/* Sortable visits */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visits.map((v) => v.place.id)}
          strategy={verticalListSortingStrategy}
        >
          {visits.map((visit, i) => {
            const dayIndex = (startDay + 6 + (day.day_number - 1)) % 7;
            const openingHoursText = visit.place.weekday_descriptions?.[dayIndex]
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
                readonly={readonly}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </section>
  );
}
