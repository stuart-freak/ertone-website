// Bundled by esbuild into public/assets/upload.js. Loaded only when someone attaches a drawing.
// Uploads straight from the browser to a private Vercel Blob store, so large CAD files never pass
// through the enquiry function (which has a 4.5MB body limit).
import { upload } from "@vercel/blob/client";

export async function uploadDrawing(file, onProgress) {
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const month = new Date().toISOString().slice(0, 7);
  const blob = await upload(`enquiries/${month}/${safe}`, file, {
    access: "private",
    handleUploadUrl: "/api/upload",
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => onProgress && onProgress(Math.round(e.percentage)),
  });
  return { url: blob.url, pathname: blob.pathname };
}
