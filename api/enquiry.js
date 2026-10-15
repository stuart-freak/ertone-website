// POST /api/enquiry
// Receives the quote, contact and newsletter forms. Sends a signed JSON webhook to the CRM and an email
// copy to the Ertone inbox. The enquiry counts as delivered if either one succeeds, so nothing is lost
// if the CRM is briefly down.
import { put } from "@vercel/blob";
import { buildEnquiry, isSpam, signPayload, signFileLink, notificationEmail, autoReplyEmail, MAX_INLINE_BYTES } from "./_lib/enquiry.js";

const env = (k, d = "") => (process.env[k] || d).trim();

async function verifyTurnstile(token, ip) {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret) return true;
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip || "" }),
  });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

async function postWithTimeout(url, init, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

async function sendToCrm(rec) {
  const url = env("CRM_WEBHOOK_URL");
  if (!url) return { skipped: true };
  const raw = JSON.stringify(rec);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { timestamp, signature } = signPayload(env("CRM_WEBHOOK_SECRET"), raw);
    try {
      const r = await postWithTimeout(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "ertone-website/1.0",
          "x-ertone-event": rec.event,
          "x-ertone-delivery": rec.id,
          "x-ertone-timestamp": timestamp,
          "x-ertone-signature": signature,
          "idempotency-key": rec.id,
        },
        body: raw,
      });
      if (r.ok) return { ok: true, status: r.status };
      if (r.status < 500) return { ok: false, status: r.status, error: (await r.text()).slice(0, 300) };
    } catch (e) {
      if (attempt === 2) return { ok: false, error: String(e) };
    }
  }
  return { ok: false, error: "CRM did not accept the enquiry" };
}

async function sendEmail({ to, replyTo, subject, html, text, attachments }) {
  const key = env("RESEND_API_KEY");
  if (!key || !to) return { skipped: true };
  const r = await postWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env("MAIL_FROM", "Ertone website <website@ertone.co.uk>"), to: to.split(",").map((s) => s.trim()), reply_to: replyTo || undefined, subject, html, text, attachments }),
  }, 10000);
  return r.ok ? { ok: true } : { ok: false, status: r.status, error: (await r.text()).slice(0, 300) };
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== "object") return res.status(400).json({ ok: false, error: "Sorry, that did not send. Please try again." });

  const spam = isSpam(body);
  if (spam) { console.warn("enquiry dropped", spam); return res.status(200).json({ ok: true }); }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (!(await verifyTurnstile(body["cf-turnstile-response"], ip))) {
    return res.status(400).json({ ok: false, error: "Please confirm you are not a robot and try again." });
  }

  const { errors, enquiry: rec } = buildEnquiry(body, { country: req.headers["x-vercel-ip-country"], userAgent: req.headers["user-agent"] });
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, error: Object.values(errors)[0], fields: errors });

  const site = env("SITE_URL", "https://ertone.co.uk");
  const linkSecret = env("FILE_LINK_SECRET");
  let attachments;

  // Drawing uploaded straight to private Blob storage by the browser
  if (body.file_pathname && String(body.file_pathname).startsWith("enquiries/") && linkSecret) {
    const link = signFileLink(site, linkSecret, String(body.file_pathname));
    rec.attachment = { name: String(body.file_name || "drawing").slice(0, 160), size: Number(body.file_size) || 0, content_type: String(body.file_type || "").slice(0, 100), storage_path: String(body.file_pathname), download_url: link.url, expires_at: link.expires_at };
  } else if (body.file_base64) {
    // Fallback when the direct upload failed. Small files only.
    const buf = Buffer.from(String(body.file_base64), "base64");
    const name = String(body.file_name || "drawing").replace(/[^\w.\-]+/g, "_").slice(-120);
    if (buf.length <= MAX_INLINE_BYTES) {
      rec.attachment = { name, size: buf.length, content_type: "", storage_path: null, download_url: null, expires_at: null };
      attachments = [{ filename: name, content: buf.toString("base64") }];
      if (env("BLOB_READ_WRITE_TOKEN") && linkSecret) {
        try {
          const blob = await put(`enquiries/${new Date().toISOString().slice(0, 7)}/${name}`, buf, { access: "private", addRandomSuffix: true });
          const link = signFileLink(site, linkSecret, blob.pathname);
          Object.assign(rec.attachment, { storage_path: blob.pathname, download_url: link.url, expires_at: link.expires_at });
        } catch (e) { console.error("blob put failed", e); }
      }
    }
  }

  const mail = notificationEmail(rec);
  const to = env("ENQUIRY_TO", "enquiries@ertoneplastics.co.uk");
  const isNewsletter = rec.form === "newsletter";
  const crm = await sendToCrm(rec);
  // Newsletter sign ups only need email when the CRM did not take them.
  const needEmail = !isNewsletter || !crm.ok;
  const mailResult = needEmail ? await sendEmail({ to, replyTo: rec.contact.email, ...mail, attachments }) : { skipped: true };

  if (!crm.ok && !crm.skipped) console.error("crm delivery failed", rec.id, crm);
  if (!mailResult.ok && !mailResult.skipped) console.error("email delivery failed", rec.id, mailResult);

  const delivered = crm.ok || mailResult.ok;
  if (!delivered) {
    console.error("enquiry not delivered", JSON.stringify(rec));
    return res.status(502).json({ ok: false, error: `Sorry, that did not send. Please try again, or email ${to.split(",")[0]}.` });
  }

  if (env("AUTOREPLY") === "on" && !isNewsletter) {
    const r = autoReplyEmail(rec, env("PHONE", "01296 431482"));
    await sendEmail({ to: rec.contact.email, replyTo: to.split(",")[0], ...r }).catch(() => {});
  }
  return res.status(200).json({ ok: true, id: rec.id });
}
