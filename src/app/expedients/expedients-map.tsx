"use client";

// Leaflet map of expedients. Leaflet touches `window`, so it is loaded inside
// an effect. Expedients at the same spot share one pin with a count; clicking
// it shows a card for each of them beside the map.
//
// Base layers: "Mapa" (OpenStreetMap) and "Satèl·lit" (ICGC orthophoto inside
// Catalonia, Esri World Imagery elsewhere, with place names on top).
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup, Marker, LatLngBoundsExpression } from "leaflet";

export interface MapGroup {
  key: string;
  lat: number;
  lng: number;
  ids: number[];
  colors: string[]; // one per expedient (categoria colour)
  title: string; // tooltip (one line per expedient)
}

// Àrea metropolitana de Barcelona.
const AMB: LatLngBoundsExpression = [
  [41.27, 1.93],
  [41.55, 2.3],
];
const CATALONIA: LatLngBoundsExpression = [
  [40.45, 0.1],
  [42.95, 3.4],
];

function iconHtml(g: MapGroup, selected: boolean): { html: string; size: number } {
  const ring = selected ? "0 0 0 3px #111,0 1px 4px rgba(0,0,0,.45)" : "0 0 0 1px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.35)";
  if (g.ids.length === 1) {
    const size = selected ? 22 : 18;
    return { size, html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${g.colors[0]};border:2px solid #fff;box-shadow:${ring};box-sizing:border-box"></div>` };
  }
  // Several expedients: a ring split by their categoria colours, with the count.
  const size = selected ? 32 : 28;
  const step = 100 / g.colors.length;
  const stops = g.colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(",");
  return {
    size,
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:conic-gradient(${stops});box-shadow:${ring};display:flex;align-items:center;justify-content:center">
      <div style="width:${size - 10}px;height:${size - 10}px;border-radius:50%;background:#1f2937;color:#fff;font:700 12px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${g.ids.length}</div>
    </div>`,
  };
}

export function ExpedientsMap({ groups, selectedKey, onSelect }: { groups: MapGroup[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; group: MapGroup }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const selectedRef = useRef(selectedKey);
  selectedRef.current = selectedKey;
  const drawRef = useRef<(() => void) | null>(null);

  // Create the map once, on the metropolitan area.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: true });
      m.fitBounds(AMB);

      const mapa = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });
      const satellit = L.layerGroup([
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution: "Imatges &copy; Esri, Maxar, Earthstar Geographics",
        }),
        // Sharper Catalan orthophoto from street level up; at overview zooms
        // the two imageries would meet in a visible step along the coast.
        L.tileLayer("https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto/MON3857NW/{z}/{x}/{y}.png", {
          minZoom: 14,
          maxZoom: 19,
          maxNativeZoom: 19,
          bounds: CATALONIA,
          attribution: 'Ortofoto &copy; <a href="https://www.icgc.cat">ICGC</a>',
        }),
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          maxNativeZoom: 18,
        }),
      ]);
      mapa.addTo(m);
      L.control.layers({ Mapa: mapa, "Satèl·lit": satellit }, undefined, { position: "topright", collapsed: false }).addTo(m);

      // View buttons under the zoom control.
      const View = L.Control.extend({
        onAdd() {
          const div = L.DomUtil.create("div", "leaflet-bar");
          const btn = (label: string, title: string, fn: () => void) => {
            const a = L.DomUtil.create("a", "", div);
            a.href = "#";
            a.title = title;
            a.setAttribute("role", "button");
            a.style.width = "auto";
            a.style.padding = "0 8px";
            a.style.fontSize = "12px";
            a.style.fontWeight = "600";
            a.textContent = label;
            L.DomEvent.on(a, "click", (e) => {
              L.DomEvent.preventDefault(e);
              fn();
            });
          };
          btn("Àrea metropolitana", "Tornar a l'àrea metropolitana de Barcelona", () => m.fitBounds(AMB));
          btn("Veure-ho tot", "Encabir tots els expedients que es mostren", () => {
            const gs = groupsRef.current;
            if (gs.length === 1) m.setView([gs[0].lat, gs[0].lng], 16);
            else if (gs.length > 1) m.fitBounds(L.latLngBounds(gs.map((g) => [g.lat, g.lng] as [number, number])), { padding: [30, 30], maxZoom: 16 });
          });
          L.DomEvent.disableClickPropagation(div);
          return div;
        },
      });
      new View({ position: "topleft" }).addTo(m);

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

  // (Re)draw the pins when the groups change. The view is left alone: the map
  // opens on the metropolitan area and "Veure-ho tot" fits the pins on demand.
  useEffect(() => {
    const draw = async () => {
      const L = (await import("leaflet")).default;
      const g = layer.current;
      if (!g) return;
      g.clearLayers();
      markers.current.clear();
      for (const grp of groups) {
        const { html, size } = iconHtml(grp, grp.key === selectedRef.current);
        const marker = L.marker([grp.lat, grp.lng], {
          icon: L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
          riseOnHover: true,
          zIndexOffset: grp.ids.length > 1 ? 100 : 0,
        })
          .bindTooltip(grp.title, { direction: "top", offset: [0, -size / 2] })
          .on("click", () => onSelectRef.current(grp.key));
        marker.addTo(g);
        markers.current.set(grp.key, { marker, group: grp });
      }
    };
    drawRef.current = () => void draw();
    void draw();
  }, [groups]);

  // Emphasise the selected pin.
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      for (const [key, { marker, group }] of markers.current) {
        const sel = key === selectedKey;
        const { html, size } = iconHtml(group, sel);
        marker.setIcon(L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }));
        marker.setZIndexOffset(sel ? 1000 : group.ids.length > 1 ? 100 : 0);
      }
    })();
  }, [selectedKey, groups]);

  // `isolate` keeps Leaflet's own z-indexes (400–1000) inside the map, so
  // modals opened from the page stay on top.
  return <div ref={el} className="isolate h-[70vh] min-h-[380px] w-full overflow-hidden rounded-xl border border-[var(--color-line)]" />;
}
