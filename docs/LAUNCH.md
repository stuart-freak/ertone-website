# Launch checklist

## To confirm with Ertone

| Item | Where it shows | Current state |
|---|---|---|
| Opening hours | Contact page, call asset in Google Ads | Confirmed 8am - 8pm. Days not yet stated |
| Aerospace product names | Aerospace page cabin equipment | Described as Trolley trays, Galley drawers, Meal trays. Ertone to correct if needed |
| Drinkware minimum order | Hospitality page, drinkware ads | Not stated |
| Team photos and any further team members | About page | Saul O'Neil and Jon Hall only |
| Case study and testimonial | Design had placeholders | Left out until there is a real project and quote with permission |

Confirmed 14th Oct. Jon Hall. Vacuum forming and fabrication are APT services, shown as secondary services only. Defence images, the hospitality sector and the legal pages are fine for now.

## Placeholder images to replace with real Ertone photos

These were generated with AI on 14th Oct so the site has the right look while Ertone's own photos are taken. Swap the files in `src/img-src/` (same names) and `src/video/`, then rebuild.

| File | Where it shows |
|---|---|
| `src/video/hero-home.mp4`, `hero-home.webm`, `hero-home-poster.jpg` | Home page hero video (five AI factory stills with slow camera moves) |
| `hero-home-factory.jpg` | Home hero fallback image for reduced motion |
| `hero-about-factory.jpg` | About page hero |
| `prod-*.jpg` (15 files) | Example parts bands on the construction, automation, sports, defence and hospitality pages |

To rebuild the video from new stills, put five landscape images in `src/video-src/` as v1.png to v5.png and run the ffmpeg recipe in `docs/VIDEO.md`.

## Files we still need

- WordPress export of the current site, for the 20 article bodies
- ISO 9001 certificate PDF, saved as `src/downloads/ertone-iso-9001-certificate.pdf`
- Terms and conditions of sale, saved as `src/downloads/ertone-terms-and-conditions.docx`
- Company brochure PDF once designed, saved as `src/downloads/ertone-brochure.pdf` with `file` set in `pages.json`

## Before switching DNS

1. `python3 src/build.py --strict` passes
2. `npm test` and `python3 tools/check.py public` pass
3. Test a quote with a drawing and a contact enquiry on the Vercel preview, and check both arrive in the CRM and the inbox
4. GTM container published with the Enquiry form conversion on `enquiry_submitted`
5. Google Ads final URLs moved to the new addresses (redirects cover them, but direct URLs keep Quality Score clean)
   - Injection moulding campaign to `/services/injection-moulding`
   - Aerospace campaign to `/sectors/aerospace`
   - Drinkware campaign to `/sectors/hospitality-catering`
6. Search Console verified for the domain, sitemap submitted, old URLs spot checked for 301s

## After launch

- Watch Search Console coverage for 404s from old addresses and add redirects for any that matter
- Request indexing for the home page and the five most important service and sector pages
