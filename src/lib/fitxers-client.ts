// Browser side: uploads a file straight to the private store.
import { upload } from "@vercel/blob/client";
import { newUploadPathAction } from "@/app/fitxers/actions";

export async function uploadFitxer(
  kind: "acta" | "expedient" | "ite",
  id: number,
  file: Blob,
  name: string,
  onProgress?: (percentage: number) => void,
): Promise<{ pathname: string; bytes: number }> {
  const pathname = await newUploadPathAction(kind, id, name);
  await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/fitxers/token",
    contentType: file.type || undefined,
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });
  return { pathname, bytes: file.size };
}
