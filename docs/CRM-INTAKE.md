# CRM intake for website enquiries

The website sends every enquiry to one CRM address as a signed JSON POST. No Gravity Forms, no plugin and no polling. The same record also goes to the Ertone inbox by email, so an enquiry is never lost if the CRM is down for a moment.

## What Dylan needs to build

One HTTPS endpoint in the CRM, for example `https://crm.example.com/api/intake/ertone`, that

1. reads the raw request body before any JSON parsing
2. checks the signature (below) and rejects anything older than five minutes
3. ignores a repeat of an `id` it has already stored (the website retries once on a timeout or 5xx)
4. creates or updates the contact by email, then creates the enquiry or lead
5. answers `200` or `201` within eight seconds

Anything in the 4xx range is treated as final and the enquiry falls back to email only. A 5xx or a timeout is retried once.

## Headers

| Header | Example | Notes |
|---|---|---|
| `content-type` | `application/json` | |
| `x-ertone-event` | `enquiry.created` | Only event for now |
| `x-ertone-delivery` | `f9d3cffb-0e8f-490d-b317-e17b7e38a647` | Same as `id` in the body |
| `idempotency-key` | `f9d3cffb-0e8f-490d-b317-e17b7e38a647` | Same as `id` |
| `x-ertone-timestamp` | `1792007978` | Unix seconds |
| `x-ertone-signature` | `sha256=5d1c…` | HMAC SHA256 of `timestamp + "." + rawBody` with `CRM_WEBHOOK_SECRET`, hex |

## Body

```json
{
  "event": "enquiry.created",
  "id": "f9d3cffb-0e8f-490d-b317-e17b7e38a647",
  "received_at": "2026-10-14T19:59:38.000Z",
  "site": "ertone.co.uk",
  "form": "quote",
  "contact": {
    "name": "Jane Smith",
    "company": "Acme Ltd",
    "email": "jane@acme.co.uk",
    "phone": "01234 567890"
  },
  "enquiry": {
    "type": "Request a quote",
    "service": "Injection moulding",
    "volume": "Low volume",
    "message": "10,000 serving trays in PP, first delivery in March"
  },
  "attachment": {
    "name": "tray.step",
    "size": 120000,
    "content_type": "",
    "storage_path": "enquiries/2026-10/tray-AbC123.step",
    "download_url": "https://ertone.co.uk/api/file?p=…&e=…&s=…",
    "expires_at": "2027-01-12T19:59:38.000Z"
  },
  "marketing": { "newsletter_opt_in": false },
  "attribution": {
    "page": "/services/injection-moulding",
    "referrer": "https://www.google.com/",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "Search | 1 Injection moulding",
    "gclid": "Cj0KCQ…"
  },
  "meta": { "country": "GB", "user_agent": "Mozilla/5.0 …" }
}
```

Field notes

- `form` is `quote`, `contact` or `newsletter`. Newsletter records only carry `contact.email` and `marketing.newsletter_opt_in: true`.
- `enquiry.type` on the contact form is one of `Request a quote`, `Tool transfer`, `Closed loop recycling`, `General enquiry`.
- `attachment` is `null` when no drawing was sent. `download_url` is a signed link that works for 90 days. If the CRM should keep drawings for longer, download the file when the enquiry arrives and store it against the record.
- `attribution.gclid` lets the CRM send good and bad leads back to Google Ads as offline conversions later.
- Strings are trimmed and capped (message 5,000 characters, other fields 40 to 500).

## Checking the signature

Node

```js
import crypto from "node:crypto";

export function isFromErtoneWebsite(rawBody, headers, secret) {
  const t = headers["x-ertone-timestamp"];
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(headers["x-ertone-signature"] || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

PHP

```php
function is_from_ertone_website(string $raw, array $h, string $secret): bool {
    $t = $h['x-ertone-timestamp'] ?? '';
    if (abs(time() - (int) $t) > 300) return false;
    $expected = 'sha256=' . hash_hmac('sha256', $t . '.' . $raw, $secret);
    return hash_equals($expected, $h['x-ertone-signature'] ?? '');
}
// $raw = file_get_contents('php://input');
```

## Testing

`tests/enquiry.test.js` covers the signing, validation and links. To send a real test record once the endpoint exists, set `CRM_WEBHOOK_URL` and `CRM_WEBHOOK_SECRET` in a Vercel preview deployment and submit the quote form there.
