// Shared logic for website enquiries: validation, the CRM payload, webhook signing, signed file links
// and the notification emails. Kept free of Vercel specifics so it can be tested with plain Node.
import crypto from "node:crypto";

export const FORMS = ["quote", "contact", "newsletter"];
export const MAX_INLINE_BYTES = 3.5 * 1024 * 1024;
export const FILE_LINK_DAYS = 90;
const ATTRIBUTION = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;

export function clean(value, max = 300) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);
}
const line = (v, max) => clean(v, max).replace(/\s*\n\s*/g, " ");

export function isSpam(body) {
  if (clean(body.website)) return "honeypot";
  const elapsed = Number(body.elapsed_ms);
  if (Number.isFinite(elapsed) && elapsed < 2500) return "too fast";
  const text = `${body.message || ""}`;
  if ((text.match(/https?:\/\//gi) || []).length > 4) return "links";
  return null;
}

/** Returns { errors, enquiry } where enquiry is the normalised record sent to the CRM. */
export function buildEnquiry(body, { now = new Date(), country = "", userAgent = "" } = {}) {
  const form = FORMS.includes(body.form) ? body.form : "contact";
  const contact = {
    name: line(body.name, 120),
    company: line(body.company, 160),
    email: line(body.email, 200).toLowerCase(),
    phone: line(body.phone, 40),
  };
  const enquiry = {
    type: form === "quote" ? "Request a quote" : form === "newsletter" ? "Newsletter sign up" : line(body.enquiry_type, 60) || "General enquiry",
    service: line(body.service, 80),
    volume: line(body.volume, 60),
    message: clean(body.message, 5000),
  };
  const errors = {};
  if (!EMAIL_RE.test(contact.email)) errors.email = "Please check the email address.";
  if (form !== "newsletter") {
    if (!contact.name) errors.name = "Please add your name.";
    if (!enquiry.message) errors.message = "Please tell us a little about the project.";
  }
  const attribution = { page: line(body.page, 300), referrer: line(body.referrer, 500) };
  for (const k of ATTRIBUTION) if (body[k]) attribution[k] = line(body[k], 200);
  return {
    errors,
    enquiry: {
      event: "enquiry.created",
      id: crypto.randomUUID(),
      received_at: now.toISOString(),
      site: "ertone.co.uk",
      form,
      contact,
      enquiry,
      attachment: null,
      marketing: { newsletter_opt_in: form === "newsletter" },
      attribution,
      meta: { country: line(country, 4), user_agent: line(userAgent, 300) },
    },
  };
}

// ---------- webhook signing ----------
// The CRM verifies: HMAC_SHA256(secret, `${timestamp}.${rawBody}`) === signature, and rejects
// timestamps more than five minutes old. Same scheme as Stripe and Slack webhooks.
export function signPayload(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return { timestamp: String(timestamp), signature: `sha256=${sig}` };
}

export function verifySignature(secret, rawBody, timestamp, signature, toleranceSeconds = 300) {
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = signPayload(secret, rawBody, timestamp).signature;
  const a = Buffer.from(expected), b = Buffer.from(String(signature || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- signed, expiring links to private drawings ----------
export function signFileLink(baseUrl, secret, pathname, days = FILE_LINK_DAYS) {
  const e = Math.floor(Date.now() / 1000) + days * 86400;
  const s = crypto.createHmac("sha256", secret).update(`${pathname}.${e}`).digest("base64url");
  const url = `${baseUrl.replace(/\/$/, "")}/api/file?p=${encodeURIComponent(pathname)}&e=${e}&s=${s}`;
  return { url, expires_at: new Date(e * 1000).toISOString() };
}

export function checkFileLink(secret, pathname, e, s) {
  if (!pathname || !pathname.startsWith("enquiries/") || pathname.includes("..")) return false;
  if (!(Number(e) > Date.now() / 1000)) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${pathname}.${e}`).digest("base64url");
  const a = Buffer.from(expected), b = Buffer.from(String(s || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- emails ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function notificationEmail(rec) {
  const c = rec.contact, q = rec.enquiry, a = rec.attachment, t = rec.attribution;
  const who = [c.name, c.company && `(${c.company})`].filter(Boolean).join(" ") || c.email;
  const subject = rec.form === "quote" ? `Quote request from ${who}` : rec.form === "newsletter" ? `Newsletter sign up ${c.email}` : `${q.type} from ${who}`;
  const rows = [
    ["Name", c.name], ["Company", c.company], ["Email", c.email], ["Phone", c.phone],
    ["Enquiry", q.type], ["Service", q.service], ["Volume", q.volume],
  ].filter(([, v]) => v);
  const trackRows = Object.entries(t).filter(([, v]) => v);
  const fileHtml = a
    ? a.download_url
      ? `<p><a href="${esc(a.download_url)}">Download ${esc(a.name)}</a> (${Math.max(1, Math.round(a.size / 1024))} KB). This link works until ${esc(a.expires_at.slice(0, 10))}.</p>`
      : `<p>Attached ${esc(a.name)}.</p>`
    : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#202020">
<h2 style="font-size:18px;margin:0 0 12px">${esc(subject)}</h2>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd">
<tr style="background:#eee"><th align="left">Field</th><th align="left">Details</th></tr>
${rows.map(([k, v]) => `<tr><td style="border-top:1px solid #ddd"><b>${esc(k)}</b></td><td style="border-top:1px solid #ddd">${esc(v)}</td></tr>`).join("\n")}
</table>
${q.message ? `<h3 style="font-size:15px;margin:20px 0 6px">Message</h3><p style="white-space:pre-wrap;margin:0">${esc(q.message)}</p>` : ""}
${fileHtml}
${trackRows.length ? `<p style="color:#777;font-size:12px;margin-top:24px">${trackRows.map(([k, v]) => `${esc(k)} ${esc(v)}`).join("<br>")}<br>Reference ${esc(rec.id)}</p>` : ""}
</div>`;
  const text = [subject, "", ...rows.map(([k, v]) => `${k}  ${v}`), "", q.message, a && a.download_url ? `\nDrawing ${a.download_url}` : "", `\nReference ${rec.id}`].join("\n");
  return { subject, html, text };
}

export function autoReplyEmail(rec, phone) {
  const first = (rec.contact.name || "").split(" ")[0];
  const subject = "We have your enquiry";
  const text = `Hi ${first || "there"},\n\nThanks for getting in touch with Ertone. An engineer will review your enquiry and get back to you soon. If it is urgent, call us on ${phone}.\n\nErtone Plastics\nUnit 3 Telford Close, Aylesbury HP19 8DS`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#202020">${text.split("\n\n").map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
  return { subject, html, text };
}
