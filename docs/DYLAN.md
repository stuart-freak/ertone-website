# Ertone website handover for Dylan

Same pattern as the Freak site. Static pages built by `src/build.py` into `public/`, served by Vercel, with three small Vercel functions in `api/` for the forms. No WordPress and no Gravity Forms.

## Why no Gravity Forms

The new site is not WordPress, so Gravity Forms would mean running a WordPress install just for forms, a licence, and the CRM pulling entries over its API. The forms post to `/api/enquiry`, which sends a signed webhook straight to the CRM and an email copy to Ertone. That is fewer moving parts, entries arrive in the CRM within a second, and large CAD drawings go straight to private storage instead of a WordPress uploads folder.

## What we need from you

1. **GitHub** Create `WeAreFreak/ertone-website` (private) and give `stuart-freak` write access. We push the code there.
2. **Vercel** New project from that repo. Framework preset Other. `vercel.json` already sets the output folder, headers and redirects.
3. **Blob storage** In the Vercel project, Storage, create a Blob store with **private** access and connect it. That adds `BLOB_READ_WRITE_TOKEN` automatically.
4. **CRM intake endpoint** Build the endpoint described in `docs/CRM-INTAKE.md`, then send us the URL and a long random secret. Is this the same CRM as APT? If APT already has an intake route, the Ertone one can reuse it with its own secret and a source of `ertone.co.uk`.
5. **Email sending** A Resend account (or tell us if you would rather use Postmark or SMTP). Verify the sending domain `ertone.co.uk` with the SPF and DKIM records Resend gives you.
6. **Environment variables** in Vercel (Production and Preview)

| Name | Value |
|---|---|
| `CRM_WEBHOOK_URL` | The CRM intake URL |
| `CRM_WEBHOOK_SECRET` | Shared secret for the signature |
| `RESEND_API_KEY` | From Resend |
| `MAIL_FROM` | `Ertone website <website@ertone.co.uk>` |
| `ENQUIRY_TO` | `enquiries@ertoneplastics.co.uk` (comma separate to add more) |
| `FILE_LINK_SECRET` | Long random string for signed drawing links |
| `SITE_URL` | `https://ertone.co.uk` |
| `AUTOREPLY` | `on` to send customers a short confirmation, blank to switch off |
| `TURNSTILE_SECRET_KEY` | Optional. Cloudflare Turnstile secret if spam gets through the honeypot. Put the site key in `src/content/site.json` |

7. **Google Tag Manager** Create a container (or share Ertone's existing one) and send the GTM ID. We put it in `site.json`. Consent Mode v2 is already wired to the cookie banner. In GTM add a Google Ads conversion tag for the Enquiry form action, triggered by the custom event `enquiry_submitted` (fires once on the thank you page after a quote or contact form), plus the Conversion Linker on all pages.
8. **Old site files from Angry Apple**
   - A WordPress export (Tools, Export, All content) so the 20 articles keep their full text. `python3 tools/import_wordpress.py export.xml` brings the text and images in. `--strict` builds fail until they are there.
   - The ISO 9001 certificate PDF and the terms and conditions document, for the downloads page.
9. **Domain** When the ertone.co.uk transfer lands, point it at Vercel (apex `A 76.76.21.21` and `www` CNAME `cname.vercel-dns.com`, or whatever Vercel shows) and keep the existing MX records untouched so email keeps working. If ertoneplastics.co.uk also serves a website, redirect it to ertone.co.uk.

## How it fits together

```
Browser form ──► /api/upload ──► private Blob store   (drawings up to 50MB, direct from the browser)
     │
     └──────────► /api/enquiry ──► CRM webhook (signed JSON, one retry)
                           └─────► Ertone inbox (Resend, with signed drawing link)
                           └─────► customer auto reply (optional)
Drawing links ─► /api/file?p=…&e=…&s=…  (streams the private file, link valid 90 days)
```

Spam protection is a hidden honeypot field, a minimum fill time, a link count check and optional Turnstile. A submission counts as delivered if either the CRM or the email succeeds. If both fail the visitor sees an error asking them to email instead.

## Building

```
pip install jinja2 markdown pillow
npm install
python3 src/build.py            # production build into public/
python3 src/build.py --strict   # same, but fails if anything is still to confirm
python3 src/build.py --preview  # relative links, for sharing a preview
npm test                        # form and webhook tests
python3 tools/check.py public   # every page at 1440 and 390, console errors and overflow
```

The built `public/` folder is committed, so Vercel only installs the function dependencies and serves the files.

## Redirects

`vercel.json` sends every old WordPress page and article to its new address with a 301. `middleware.js` answers 410 Gone for WordPress system paths, and sends the old certificate and terms files in the media library to the new downloads.
