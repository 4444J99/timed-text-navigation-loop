# Recorded verification

The standalone 2017 extraction passed both source-integrity checks and real-browser comparison on October 7, 2026.

## Source and dependency integrity

See `static-integrity.json`.

| Check | Result |
| --- | ---: |
| Original files verified against Git blob and SHA-256 identities | 19 |
| Vendored release files verified | 8 |
| Historical pages with exact body markup and inline CSS | 13 |
| Served HTML routes, including root alias | 14 |
| Local dependency/navigation references resolved | 60 |
| Repeated I/you instances preserved | 378 |
| External runtime dependencies | 0 |

## Browser comparison and execution

See `browser/report.json`, its 68 original/restored PNGs, and its 34 DOM records.

| Check | Result |
| --- | ---: |
| Page comparisons: 13 routes × 2 viewports | 26/26 passed |
| Hover comparisons: 4 treatments × 2 viewports | 8/8 passed |
| Differing screenshot pixels | 0 in every pair |
| Entrance URL checks | 8/8 passed |
| Native link activations and destination boundaries | 42/42 passed |
| Return timers across three hosting modes | 36/36 passed |
| Same-chamber re-entry | 6/6 passed |
| Total behavior checks | 92/92 passed |
| External requests, resource failures, and script/console errors | 0 |

Behavior runs used HTTP at the root, HTTP under `/nested/project/`, and direct `file://` access. Timer checks used a controlled browser clock and verified both the instant before departure and the declared deadline.

The viewports were 1440 × 1000 and 390 × 844. The browser was Chromium 153.0.8010.0 on Linux, driven by Playwright 1.62.1 under Node v24.19.0; pngjs 7.0.0 compared decoded pixels.

These comparisons render the preserved source and the extraction in the same present-day environment. They are not recovered 2017 screenshots. Futura availability remains device-dependent as in the source. Safari and a physical iPhone were not tested.

## Publication status

These are completed local checks. The prepared GitHub workflow has not run on GitHub, and this package does not establish a hosted deployment. Consult the handoff for the actual repository-publication state.
