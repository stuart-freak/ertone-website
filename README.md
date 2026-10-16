# Ertone website

The website for Ertone Plastics Ltd, built by Freak from Alexandra's V3 design.

- `src/content/*.json` holds all copy, services, sectors, articles and site settings
- `src/templates/` holds the Jinja page templates
- `src/assets/` holds the stylesheet, the site script and the upload helper
- `src/img-src/` holds source images, converted to WebP at several sizes by the build
- `api/` holds the Vercel functions for the forms (`enquiry`, `upload`, `file`)
- `public/` is the built site that Vercel serves

```
pip install jinja2 markdown pillow
npm install
python3 src/build.py           # build public/
python3 src/build.py --preview # build preview/ with relative links
npm test
python3 tools/check.py public
```

## Motion

All animation lives in the Motion block at the end of `src/assets/site.css` and the motion section of `src/assets/site.js`. A small script in the page head adds a `motion` class to `<html>` unless the visitor's device asks for reduced motion. It takes the class off again if `site.js` has not started within three seconds, so every page always renders in full without animation. The reveal selector list appears in both files and the two must match.

- Scroll reveals, odometer figures, image fade in, hover states, smooth accordions
- Page transitions with the browser's View Transitions, where a card photo grows into the next page's hero
- Process flow, closed loop diagram (`loop` in `services.json`) and the mould cycle on the injection moulding page (`cycle` in `services.json`)

See `docs/DYLAN.md` for hosting and the CRM connection, `docs/CRM-INTAKE.md` for the webhook format and `docs/LAUNCH.md` for what is still to confirm.
