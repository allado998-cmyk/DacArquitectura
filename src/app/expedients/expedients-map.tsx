"use client";

// Leaflet map of expedients (OpenStreetMap tiles, no API key). Leaflet touches
// `window`, so it is loaded inside an effect.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup, CircleMarker } from "leaflet";

export interface MapPoint {
  id: number;
  lat: number;
  lng: number;
  color: string;
  title: string; // tooltip
}

const CATALONIA: [number, number] = [41.7, 1.9];

export function ExpedientsMap({ points, selectedId, onSelect }: { points: MapPoint[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const markers = useRef(new Map<number, CircleMarker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedKey = useRef<string>("");
  const drawRef = useRef<(() => void) | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: true }).setView(CATALONIA, 8);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      setTimeout(() => m.invalidateSize(), 0);
      drawRef.current?.();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
      markers.current.clear();
    };
  }, []);

  // (Re)draw markers when the points change; fit the view when the set changes.
  useEffect(() => {
    const draw = async () => {
      const L = (await import("leaflet")).default;
      const m = map.current;
      const g = layer.current;
      if (!m || !g) return;
      g.clearLayers();
      markers.current.clear();
      for (const p of points) {
        const sel = p.id === selectedRef.current;
        const mk = L.circleMarker([p.lat, p.lng], { radius: sel ? 12 : 8, color: sel ? "#111111" : "#ffffff", weight: sel ? 3 : 2, fillColor: p.color, fillOpacity: 0.95 })
          .bindTooltip(p.title, { direction: "top", offset: [0, -6] })
          .on("click", () => onSelectRef.current(p.id));
        mk.addTo(g);
        markers.current.set(p.id, mk);
      }
      const key = points.map((p) => p.id).sort((a, b) => a - b).join(",");
      if (key !== fittedKey.current) {
        fittedKey.current = key;
        if (points.length === 1) m.setView([points[0].lat, points[0].lng], 15);
        else if (points.length > 1) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 15 });
      }
    };
    drawRef.current = () => void draw();
    void draw();
  }, [points]);

  // Emphasise the selected marker.
  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const sel = id === selectedId;
      mk.setStyle({ radius: sel ? 12 : 8, weight: sel ? 3 : 2, color: sel ? "#111111" : "#ffffff" });
      if (sel) mk.bringToFront();
    }
  }, [selectedId, points]);

  return <div ref={el} className="h-[65vh] min-h-[360px] w-full overflow-hidden rounded-xl border border-[var(--color-line)]" />;
}
