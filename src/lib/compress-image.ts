// Browser only. Downscales and re-encodes a phone photo so a whole album stays
// a few MB, not tens. Anything that is not an image (or fails to decode) is
// returned as is.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (Math.max(w, h) > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return out ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A JPEG of at most maxBytes with its long side at most maxDim: smaller sizes
// and lower qualities in turn until it fits (for the ITE portal's uploads).
// A JPEG that already fits is kept as it is. null if the browser cannot read
// the image (e.g. HEIC on Windows).
export async function fitJpeg(blob: Blob, maxBytes: number, maxDim: number): Promise<Blob | null> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const long = Math.max(bmp.width, bmp.height);
    if (/^image\/jpe?g$/i.test(blob.type) && blob.size <= maxBytes && long <= maxDim) return blob;
    const sides = [...new Set([maxDim, 1024, 800, 640, 480].filter((d) => d <= maxDim).map((d) => Math.min(d, long)))];
    let last: Blob | null = null;
    for (const side of sides) {
      const s = side / long;
      const w = Math.max(1, Math.round(bmp.width * s));
      const h = Math.max(1, Math.round(bmp.height * s));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, w, h);
      for (const q of [0.85, 0.75, 0.65, 0.55]) {
        const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
        if (!out) return null;
        last = out;
        if (out.size <= maxBytes) return out;
      }
    }
    return last;
  } finally {
    bmp.close();
  }
}
