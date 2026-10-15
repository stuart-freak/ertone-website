// POST /api/upload
// Issues short lived tokens so the browser can upload drawings straight to a private Vercel Blob store.
// Files never pass through the enquiry function, which keeps large CAD files off its 4.5MB body limit.
import { handleUpload } from "@vercel/blob/client";

const MAX = 50 * 1024 * 1024;
const OK_EXT = /\.(pdf|dwg|dxf|step|stp|iges|igs|stl|x_t|sldprt|jpg|jpeg|png|heic|zip)$/i;

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("enquiries/") || pathname.includes("..") || !OK_EXT.test(pathname)) {
          throw new Error("That file type is not accepted.");
        }
        return {
          maximumSizeInBytes: MAX,
          addRandomSuffix: true,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
}
