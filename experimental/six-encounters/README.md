# hole-loop · experimental edition 01

A complete, no-build browser artwork and four independent formal studies. The score is **040915 → 041015 → 042115 → 040915 → 041015 → 042115**. Every departure returns to the entrance; entering again always needs another action.

## Experience it

Open `index.html` directly, or serve this directory:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory experimental/six-encounters
```

From the repository root, then open `http://127.0.0.1:8080/`. A static server at any subdirectory also works. There are no runtime dependencies, remote fonts, API calls, accounts, persistent storage, or analytics.

Choose **Reader-paced** (default) or explicitly choose **Timed**, then **Begin**. **Return** takes you to the entrance. **Enter next chamber** is a separate action. Timed chambers return after 5,000 eligible milliseconds; the entrance never runs a progression timer. Pause, hidden pages, and Reading view suspend exposure. The clock measures display duration, not attention or comprehension.

After six returns, use **Reread**, **Restart**, or **Exit**. During a run, mode changes require **Restart to change mode** at the entrance. Restart clears all session consequences and waits for Begin. Early exit preserves a partial diagnostic record without fabricating a return or cycle.

The initial entrance offers **Explore four studies**. Each study has a baseline, variants, Reset study, a visible configuration record, and optional JSON download. Time conditions require separate entry actions. Memory's second encounter becomes available only after the first layout is measured. Study visits never affect the composition. Optional observations remain in memory until reset; the app does not submit them anywhere.

**Fit whole field** preserves the entire arrangement. **Scroll detail** keeps full-size text and allows panning; the focusable viewport supports keyboard scrolling. **Reading view** exposes both Moment clauses, all 42 I/you rows of nine occurrences, and Forced progress. Controls have native keyboard activation and visible focus. No animation is needed to distinguish state.

## Files and decisions

| File | Responsibility |
| --- | --- |
| `content.js` | Immutable, versioned wording and composition configuration |
| `engine.js` | Session transitions, unique identities, memory, monotonic exposure accumulation |
| `render.js` | Actual layout capture and coordinate-based rendering |
| `app.js` | Reader actions, independent studies, ready/visibility/pause wiring |
| `style.css` | Page frame, controls, responsive fit and scroll surfaces |
| `docs/source-census.json` | Inspected chamber paths, exact revision, SHA-256 and read-only source text nodes |
| `docs/PROVENANCE.md` | Source authority, normalization and research reference |
| `docs/EVALUATION.md` | Working methods and assessment, separated from reader observations |
| `docs/PLAN.md`, `docs/issues.json` | Linked concentric plan and complete issue bodies |
| `verification/recorded/` | Browser evidence captured for this edition |

Moment's second visit draws static rectangles from first-visit rendered bounds, expanded by eight logical pixels to make the perimeter visible. Both text and trace use the same stage transform on resize. I/you uses the actual rendered phrase advance as its cell width: nine adjacent cells per row, then one empty cell after column four on revisit. Both variants retain row-major identity. No prior-arrangement outline is added to I/you.

The return strip uses symbolic geometry and shows at most three returned encounters, oldest to newest. It is separate from the six-entry history and first-layout records. Cycle markers appear only after returns three and six. All memory is local to the current page session.

## Verification

From this directory:

```sh
npm test
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm run test:browser
```

State tests use Node's built-in runner, so `npm test` needs no installation. Playwright is a pinned, verification-only dependency. Browser tests serve the files themselves, use real DOM/layout assertions, control browser time, and write new evidence to ignored `verification/rerun/`. They also open `file://` and a nested HTTP path.

An existing Chromium can be selected with `HL_CHROMIUM_PATH=/absolute/path/to/chromium npm run test:browser`. `HL_EVIDENCE_DIR` selects a different evidence directory. The recorded run used Chromium 138.0.7204.0 on Linux with Playwright 1.62.1, at 1440×1000 and 390×844. This is viewport emulation, not a physical iPhone or Safari result. See `verification/README.md` for scope and limitations.

## Delivery boundary

This branch starts at `main` revision `ee25e7a50019fd75ef1fae790d1e0f80b6b436e4`. It adds only this experimental directory and its dedicated verification workflow. It does not rely on the restoration PR, modify its sources, change production routing, or deploy an older edition. No existing suitable preview service was configured on the inspected default branch; this delivery does not claim a hosted preview.

Original artwork and language: Anthony James Padavano / ETCETER4. This edition asserts no new license over the source artwork or third-party quotations. Proposed research methods are not claims about the original artwork's influences.
