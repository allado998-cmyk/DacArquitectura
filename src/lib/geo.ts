// Locating an expedient's works on the map. Server only.
//
// 1. A Google Maps link: the coordinates are read from it (pin "!3d…!4d…",
//    centre "@lat,lng", or "q=lat,lng"). Short links (maps.app.goo.gl) are
//    expanded first, following redirects only through Google hosts.
// 2. Plain coordinates typed in the link field: "41.3851, 2.1734".
// 3. Otherwise the address (plus city) is geocoded with OpenStreetMap's
//    Nominatim service (free, no key; light use with an identifying UA).

export interface LatLng {
  lat: number;
  lng: number;
}

function valid(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";

// "41.3851, 2.1734" / "41.3851,2.1734" / "41,3851 2,1734" is not supported (ambiguous).
export function coordsFromText(s: string): LatLng | null {
  const m = new RegExp(`^\\s*${NUM}\\s*[,;]\\s*${NUM}\\s*$`).exec(s);
  return m ? valid(parseFloat(m[1]), parseFloat(m[2])) : null;
}

function dmsToDec(deg: string, min: string, sec: string, hemi: string): number {
  const v = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
  return hemi === "S" || hemi === "W" ? -v : v;
}

export function coordsFromMapsUrl(raw: string): LatLng | null {
  let url = raw;
  try {
    url = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  // The place's own pin (most precise).
  let m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));
  // Explicit coordinates as the query.
  m = new RegExp(`[?&](?:q|query|ll|center|destination|daddr|sll)=${NUM},\\s*\\+?${NUM}`).exec(url);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));
  m = new RegExp(`/(?:search|place|dir)/${NUM},\\s*\\+?${NUM}`).exec(url);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));
  // Degrees, minutes, seconds: 41°23'06.4"N 2°10'24.2"E
  m = /(\d{1,3})°(\d{1,2})'([\d.]+)"([NS])[\s+,]*(\d{1,3})°(\d{1,2})'([\d.]+)"([EW])/.exec(url);
  if (m) return valid(dmsToDec(m[1], m[2], m[3], m[4]), dmsToDec(m[5], m[6], m[7], m[8]));
  // Map centre (less precise, but close for a link shared from a place).
  m = new RegExp(`@${NUM},${NUM}`).exec(url);
  if (m) return valid(parseFloat(m[1]), parseFloat(m[2]));
  return null;
}

// The place name or address inside a link, to geocode when it has no coordinates.
export function placeTextFromMapsUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const q = u.searchParams.get("q") ?? u.searchParams.get("query") ?? u.searchParams.get("destination");
  if (q && !coordsFromText(q)) return q.trim() || null;
  const m = /\/(?:place|search)\/([^/@]+)/.exec(u.pathname);
  if (m) {
    const text = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    if (text && !coordsFromText(text)) return text;
  }
  return null;
}

const GOOGLE_HOST = /(^|\.)(google\.[a-z.]{2,6}|goo\.gl|app\.goo\.gl|g\.co)$/i;

function isGoogleHost(host: string): boolean {
  return GOOGLE_HOST.test(host);
}

// Follows a short link's redirects (Google hosts only) and returns the final URL.
export async function expandMapsLink(raw: string): Promise<string> {
  let url = new URL(raw);
  for (let hop = 0; hop < 6; hop++) {
    if (url.protocol !== "https:" || !isGoogleHost(url.hostname)) return url.toString();
    // EU consent interstitial: the real destination is in "continue".
    if (url.hostname.startsWith("consent.")) {
      const next = url.searchParams.get("continue");
      if (!next) return url.toString();
      url = new URL(next);
      continue;
    }
    if (coordsFromMapsUrl(url.toString())) return url.toString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (DacArquitectura)" } });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url);
        continue;
      }
      return url.toString();
    } catch {
      return url.toString();
    } finally {
      clearTimeout(timer);
    }
  }
  return url.toString();
}

export async function geocodeAddress(text: string): Promise<LatLng | null> {
  const q = text.trim();
  if (q.length < 3) return null;
  for (const country of ["es", ""]) {
    const params = new URLSearchParams({ format: "jsonv2", limit: "1", q });
    if (country) params.set("countrycodes", country);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: ctrl.signal,
        headers: { "user-agent": "DacArquitectura/1.0 (https://dac-arquitectura.vercel.app)", "accept-language": "ca,es" },
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as { lat: string; lon: string }[];
      if (rows[0]) {
        const r = valid(parseFloat(rows[0].lat), parseFloat(rows[0].lon));
        if (r) return r;
      }
    } catch {
      /* try the next variant */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function locate(input: { mapsUrl: string | null; adreca: string | null; ciutat: string | null }): Promise<(LatLng & { source: "link" | "adreca" }) | null> {
  const link = input.mapsUrl?.trim();
  if (link) {
    const typed = coordsFromText(link);
    if (typed) return { ...typed, source: "link" };
    if (/^https?:\/\//i.test(link)) {
      let full = link;
      try {
        if (isGoogleHost(new URL(link).hostname)) full = await expandMapsLink(link);
      } catch {
        full = link;
      }
      const c = coordsFromMapsUrl(full);
      if (c) return { ...c, source: "link" };
      const place = placeTextFromMapsUrl(full);
      if (place) {
        const g = await geocodeAddress(place);
        if (g) return { ...g, source: "link" };
      }
    }
  }
  const adreca = input.adreca?.trim();
  if (adreca) {
    const ciutat = input.ciutat?.trim();
    const withCity = ciutat && !adreca.toLowerCase().includes(ciutat.toLowerCase()) ? `${adreca}, ${ciutat}` : adreca;
    const g = (await geocodeAddress(withCity)) ?? (withCity !== adreca ? await geocodeAddress(adreca) : null);
    if (g) return { ...g, source: "adreca" };
  }
  return null;
}

export function googleMapsHref(e: { maps_url?: string | null; lat?: number | null; lng?: number | null; adreca?: string | null; ciutat?: string | null }): string | null {
  if (e.maps_url && /^https?:\/\//i.test(e.maps_url)) return e.maps_url;
  if (e.lat != null && e.lng != null) return `https://www.google.com/maps?q=${e.lat},${e.lng}`;
  const text = [e.adreca, e.ciutat].filter(Boolean).join(", ");
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null;
}
