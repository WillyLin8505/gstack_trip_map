"use client";

import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import type { Day } from "@/types";

const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  version: "weekly",
  libraries: [],
});

interface Props {
  days: Day[];
}

export function ItineraryMap({ days }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([]);
  const daysRef = useRef(days);
  daysRef.current = days;

  function clearOverlays() {
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
  }

  function redraw(map: google.maps.Map, currentDays: Day[]) {
    clearOverlays();
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    currentDays.forEach((day) => {
      const path: google.maps.LatLngLiteral[] = [];

      day.visits.forEach((visit, idx) => {
        const { lat, lng } = visit.place;
        if (!lat && !lng) return;

        const pos = { lat, lng };
        bounds.extend(pos);
        path.push(pos);
        hasPoints = true;

        const marker = new google.maps.Marker({
          position: pos,
          map,
          title: visit.place.name,
          label: {
            text: String(idx + 1),
            color: "#fff",
            fontSize: "11px",
            fontWeight: "bold",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: day.color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: idx + 1,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="font-size:13px;font-weight:600;max-width:180px">${visit.place.name}</div><div style="font-size:11px;color:#666;margin-top:2px">${visit.arrival_time} – ${visit.departure_time}</div>`,
        });
        marker.addListener("click", () => infoWindow.open(map, marker));
        overlaysRef.current.push(marker);
      });

      if (path.length > 1) {
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: day.color,
          strokeOpacity: 0.65,
          strokeWeight: 2.5,
          map,
        });
        overlaysRef.current.push(polyline);
      }
    });

    if (hasPoints) {
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    }
  }

  useEffect(() => {
    let live = true;
    loader.load().then(() => {
      if (!live || !containerRef.current || mapRef.current) return;
      mapRef.current = new google.maps.Map(containerRef.current, {
        zoom: 13,
        center: { lat: 25.033, lng: 121.565 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
      });
      redraw(mapRef.current, daysRef.current);
    });
    return () => {
      live = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) redraw(mapRef.current, days);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="relative w-full h-full bg-slate-100">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
