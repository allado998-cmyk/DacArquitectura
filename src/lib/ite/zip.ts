// Minimal ZIP reader and writer for the portal's import/export files. Works in
// the browser and in Node 22+ (both have CompressionStream "deflate-raw"), so
// the export zip is built on the user's machine: no function time, no 4.5 MB
// response limit.
//
// The portal's own zips: every entry deflated, no directory entries, plain
// ASCII names like ITE/informes/imatges/<id>/DEFICIENCIES/<file>.JPG.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function streamBytes(data: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(transform as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  return streamBytes(data, new CompressionStream("deflate-raw"));
}

export function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  return streamBytes(data, new DecompressionStream("deflate-raw"));
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipInput {
  name: string;
  data: Uint8Array;
}

export async function buildZip(entries: ZipInput[], when = new Date()): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(when);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const utf8 = /[^\x20-\x7e]/.test(e.name) ? 0x0800 : 0;
    const crc = crc32(e.data);
    const packed = await deflateRaw(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, utf8, true);
    local.setUint16(8, 8, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, packed.length, true);
    local.setUint32(22, e.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, packed);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, utf8, true);
    cd.setUint16(10, 8, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, packed.length, true);
    cd.setUint32(24, e.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + packed.length;
  }

  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

export interface ZipEntry {
  name: string;
  size: number;
  read(): Promise<Uint8Array>;
}

// Lists a zip's files; each one is only inflated when read.
export function readZip(buf: Uint8Array): ZipEntry[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let p = buf.length - 22; p >= Math.max(0, buf.length - 22 - 65535); p--) {
    if (view.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error("No és un fitxer ZIP.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP malmès.");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const usize = view.getUint32(p + 24, true);
    const nlen = view.getUint16(p + 28, true);
    const xlen = view.getUint16(p + 30, true);
    const clen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const nameBytes = buf.subarray(p + 46, p + 46 + nlen);
    const name = flags & 0x0800 ? dec.decode(nameBytes) : Array.from(nameBytes, (b) => String.fromCharCode(b)).join("");
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/")) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + csize);
    out.push({
      name,
      size: usize,
      read: async () => {
        if (method === 0) return raw.slice();
        if (method === 8) return inflateRaw(raw);
        throw new Error(`Compressió no suportada a ${name}.`);
      },
    });
  }
  return out;
}
