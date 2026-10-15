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

See `docs/DYLAN.md` for hosting and the CRM connection, `docs/CRM-INTAKE.md` for the webhook format and `docs/LAUNCH.md` for what is still to confirm.
