# LocalAll (LocalTools)

Free local file tools, private by design. 100% client-side — your files never leave your device.

PDF (`/category/pdf/`):
- `tools/` — Merge PDFs (drag & drop, reorder, preview, via vendored `pdf-lib`)
- `compress/` — Compress PDF, quality slider 10–90% (re-render pages as JPEG via vendored `pdf.js` + `pdf-lib`)
- `to-images/` — PDF → PNG/JPEG per page (vendored `pdf.js`)

Image converter (`/category/image/`):
- `convert/` — any readable image → PNG/JPEG/WebP
- `compress/` — quality + longest-side cap
- `resize/` — width / height / percent, aspect locked
- `crop/` — drag rectangle, free / 1:1 / 4:3 / 16:9
- `remove-background/` — instant auto-erase for solid backdrops (edge flood-fill + tolerance). Complex photo backgrounds need an AI model, intentionally not included.
- `to-pdf/` — images → PDF (fit or A4, reorder via vendored `pdf-lib`)

Video / Audio: placeholders.

Stack: static HTML + 1 CSS + vanilla JS. No build. `pdf-lib` + `pdf.js` vendored in `assets/js/vendor/` so tools work offline.
