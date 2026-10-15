// GET /api/file?p=<pathname>&e=<expiry>&s=<signature>
// Streams a private drawing to whoever holds a valid, unexpired link from an enquiry email or the CRM.
import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import { checkFileLink } from "./_lib/enquiry.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "https://ertone.co.uk");
  const p = url.searchParams.get("p") || "";
  const e = url.searchParams.get("e") || "";
  const s = url.searchParams.get("s") || "";
  res.setHeader("x-robots-tag", "noindex");
  res.setHeader("cache-control", "private, no-store");
  if (!checkFileLink(process.env.FILE_LINK_SECRET || "", p, e, s)) {
    return res.status(403).send("This link has expired or is not valid. Please ask the website team for a new one.");
  }
  const result = await get(p, { access: "private" });
  if (!result || result.statusCode !== 200) return res.status(404).send("File not found.");
  const name = p.split("/").pop().replace(/"/g, "");
  res.setHeader("content-type", result.blob.contentType || "application/octet-stream");
  res.setHeader("content-length", String(result.blob.size));
  res.setHeader("content-disposition", `attachment; filename="${name}"`);
  Readable.fromWeb(result.stream).pipe(res);
}
