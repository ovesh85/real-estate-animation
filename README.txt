ELEVARA — Sky Residences (real-estate scroll website, static)
==============================================================
Open index.html through any web server (e.g. `npx http-server .`). No build step.

SECTIONS
1. Preloader – blueprint tower draws, level counter 00→62, elevator doors open.
2. THE RISE – 306-frame scroll film: empty plot → foundation → frame → facade → complete → blue hour.
   Live altimeter, level counter, phase copy, construction ledger, milestone timeline,
   blueprint overlay drawn on canvas + a brass "current level" line.
3. Manifesto – words fill in on scroll, animated stats.
4. THE TOUR – 245-frame film: drone fly-in to Level 52 → through the glass → living → dining → master suite,
   with a live floor plan and a moving position dot.
5. Residences – pinned horizontal scroll, 5 types, floor plans draw themselves, sq ft / m² toggle.
6. Choose your view – floor slider (L12–61) changes the panorama, altitude, horizon distance and price.
7. The Club – stacking sticky cards. 8. Location – animated route map. 9. EMI calculator.
10. Enquiry form (demo toast) + footer wordmark fill.

EDITING
- assets/js/app.js top: PHASES, ROOMS, RESIDENCES, RATE (price per sq ft by level).
- data-vh on #rise / #tour sets scroll length (higher = slower film).
- Frames: assets/seq/{rise,tour}/d (1440w WebP, desktop) and /m (1080h centre crop, under 860px).

PERFORMANCE
- Image-sequence canvas (no video seeking), coarse-to-fine loading, lazy films, pre-decode around the playhead,
  DPR capped at 1.5, data-saver loads half the frames. Only ~23 frames block the preloader.

WOOCOMMERCE / WORDPRESS
- Page template + enqueue style.css/app.js; copy assets into the theme.
- RESIDENCES can come from a CPT or WC products; enquiry form → CF7/WPForms/Gravity endpoint.

Elevara is a fictional demo brand; imagery is AI-generated artist's impression.
