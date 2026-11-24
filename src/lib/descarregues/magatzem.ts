// The Descàrregues files in the private Vercel Blob store (layout in
// cataleg.ts). Nothing here touches the database.
import { del, get, list, put } from "@vercel/blob";
import { areaPrefix, type Manifest } from "./cataleg";

type Area = "dac" | "demo";

const INDEX = "index.json";

// One regeneration at a time per area (generar.ts → regenerarSiCal): a marker
// taken with a create-only write; one older than 10 minutes (a run that died)
// is taken over.
const BLOQUEIG = "regenerant.json";

export async function agafarBloqueig(area: Area): Promise<boolean> {
  const path = `${areaPrefix(area)}${BLOQUEIG}`;
  const body = JSON.stringify({ des: new Date().toISOString() });
  const opts = { access: "private" as const, contentType: "application/json", addRandomSuffix: false };
  try {
    await put(path, body, { ...opts, allowOverwrite: false });
    return true;
  } catch {
    const r = await get(path, { access: "private", useCache: false }).catch(() => null);
    const des = r?.statusCode === 200 && r.stream ? Date.parse(((await new Response(r.stream).json().catch(() => ({}))) as { des?: string }).des ?? "") : NaN;
    if (Number.isFinite(des) && Date.now() - des < 10 * 60_000) return false;
    await put(path, body, { ...opts, allowOverwrite: true });
    return true;
  }
}

export async function deixarBloqueig(area: Area): Promise<void> {
  await del(`${areaPrefix(area)}${BLOQUEIG}`).catch(() => {});
}

export async function llegirManifest(area: Area): Promise<Manifest | null> {
  const r = await get(`${areaPrefix(area)}${INDEX}`, { access: "private", useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  try {
    return (await new Response(r.stream).json()) as Manifest;
  } catch {
    return null;
  }
}

async function inParallel<T>(items: T[], n: number, fn: (item: T) => Promise<unknown>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

// Deletes the run folders `quines` picks (never the index).
async function esborrarCarpetes(area: Area, quines: (carpeta: string) => boolean) {
  const prefix = areaPrefix(area);
  const pathnames: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) {
      const rest = b.pathname.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash > 0 && quines(rest.slice(0, slash))) pathnames.push(b.pathname);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < pathnames.length; i += 500) await del(pathnames.slice(i, i + 500));
  return pathnames.length;
}

// Stores a run: its files in their own folder, then the index that points at
// them, then the older runs go. If a newer run published while this one was
// working (a manual run during the cron, say), this one steps aside.
export async function publicar(
  area: Area,
  manifest: Manifest,
  fitxers: { nom: string; data: Uint8Array; tipus: string }[],
): Promise<{ publicat: boolean; esborrats: number }> {
  const prefix = areaPrefix(area);
  const { carpeta } = manifest;
  await inParallel(fitxers, 8, (f) =>
    put(`${prefix}${carpeta}/${f.nom}`, Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength), {
      access: "private",
      contentType: f.tipus,
      addRandomSuffix: false,
      allowOverwrite: true,
    }),
  );
  const actual = await llegirManifest(area);
  if (actual && actual.carpeta > carpeta) {
    await esborrarCarpetes(area, (c) => c === carpeta);
    return { publicat: false, esborrats: 0 };
  }
  await put(`${prefix}${INDEX}`, JSON.stringify(manifest), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return { publicat: true, esborrats: await esborrarCarpetes(area, (c) => c < carpeta) };
}
