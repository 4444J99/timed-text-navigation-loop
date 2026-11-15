# hole-loop · experimental edition 01

A complete, no-build browser artwork with word-routed generative loops, the protected six-encounter composition, and four independent formal studies. The score is **040915 → 041015 → 042115 → 040915 → 041015 → 042115**. Every departure returns to the entrance; entering again always needs another action.

## Experience it

Open `index.html` directly, or serve this directory:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory experimental/six-encounters
```

From the repository root, then open `http://127.0.0.1:8080/`. A static server at any subdirectory also works. There are no runtime dependencies, remote fonts, API calls, accounts, persistent storage, or analytics.

On the landing page, select a colored LOOPHOLE row for the generative experience. Underlined words lead directly to another loop after an exit animation; without a selection, five eligible seconds return to a newly spaced entrance. The row color becomes the chamber field, with seeded colored text and motion. Pause and Reading view remain available; stationary **Words / routes** supplies accessible route equivalents. See `docs/GENERATIVE.md` for exact rules and recorded configuration.

For the deterministic score, open **Score & studies**, choose **Reader-paced** (default) or explicitly choose **Timed**, then **Begin**. **Return** takes you to the entrance. **Enter next chamber** is a separate action. Timed chambers return after 5,000 eligible milliseconds; the entrance never runs a progression timer. Pause, hidden pages, and Reading view suspend exposure. The clock measures display duration, not attention or comprehension.

After six returns, use **Reread**, **Restart**, or **Exit**. During a run, mode changes require **Restart to change mode** at the entrance. Restart clears all session consequences and waits for Begin. Early exit preserves a partial diagnostic record without fabricating a return or cycle.

The **Score & studies** panel offers **Explore four studies**. Each study has a baseline, variants, Reset study, a visible configuration record, and optional JSON download. Time conditions require separate entry actions. Memory's second encounter becomes available only after the first layout is measured. Study visits never affect the composition. Optional observations remain in memory until reset; the app does not submit them anywhere.

**Fit whole field** preserves the entire arrangement. **Scroll detail** keeps full-size text and allows panning; the focusable viewport supports keyboard scrolling. **Reading view** exposes both Moment clauses, all 42 I/you rows of nine occurrences, and Forced progress. Controls have native keyboard activation and visible focus. No animation is needed to distinguish state.

## Files and decisions

| File | Responsibility |
| --- | --- |
| `content.js` | Immutable, versioned wording and composition configuration |
| `generation.js` | Independent seeded spacing, color, motion and word-route state |
| `engine.js` | Session transitions, unique identities, memory, monotonic exposure accumulation |
| `render.js` | Actual layout capture and coordinate-based rendering |
| `app.js` | Reader actions, independent studies, ready/visibility/pause wiring |
| `style.css` | Edge-to-edge score, control overlays, independent study pages |
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

This branch starts at `main` revision `ee25e7a50019fd75ef1fae790d1e0f80b6b436e4`. It adds only this experimental directory and its dedicated verification workflow. It does not rely on the restoration PR, modify its sources, change production routing, or deploy an older edition. No existing suitable preview service was configured on the inspected default branch; a separate owner-private experimental deployment is now available at https://hole-loop-experimental.ajpadavano.chatgpt.site. This is independent of production routing and the historical edition.

Original artwork and language: Anthony James Padavano / ETCETER4. This edition asserts no new license over the source artwork or third-party quotations. Proposed research methods are not claims about the original artwork's influences.

## Presentation 1.1.0

Scored chambers fill the browser viewport with their source cyan/black/pink fields and white type. Moment and I/you are rendered uppercase through CSS without changing the source strings. Futura is preferred where installed; Century Gothic, Trebuchet MS, Arial, and generic sans-serif are local fallbacks. Compact controls overlay the field, and the entrance’s eleven colored LOOPHOLE rows retain a small history/control overlay. Study explanations and configuration records stay on their independent pages. Full-screen here means the browser content area; Safari’s address/status bars remain under Safari’s control. `verification/fullscreen/` contains evidence of this revision.

Generative verification: `tests/generation.test.cjs` and `tests/generation-browser.cjs` run with the main npm scripts; `verification/generative/` records this edition’s evidence. Runtime now includes `generation.js` (no added runtime dependency).


## Character movement 1.2.0

Generative glyphs move inside stable transparent cells with continuous signed
horizontal, vertical or combined wraparound. The encounter seed reproduces every
glyph's axis, phase, sign and period. Wave/drift/stretch now select distinct speed
profiles. Word targets, route semantics and protected scored artwork remain fixed.
See `docs/GENERATIVE.md` for renderer configuration and known limits.

`tests/character-browser.cjs` runs with `npm run test:browser` and checks all
axes/families at four viewport sizes, signed positions, fractional tile dimensions,
pixel wrap endpoints, seeded replay, reduced motion and early Return.
`HL_CHARACTER_EVIDENCE_DIR` selects its capture destination; default output is
ignored `verification/rerun/character-cells/`. Committed evidence is in
`verification/character-cells/`. Physical iPhone/Safari testing remains outstanding.

## Audiovisual rendition export

`rendition.js` and `export-rendition.cjs` turn a seeded word-routed run into a real file. A reader who always follows a word is driven through the actual `RouteSession` at the configured 450 ms entry, 1.0 to 4.5 s of eligible exposure and 350 ms exit; every next chamber is the followed word's target. Frames show only the route words, in the field and foreground colours, motion family, entry direction and glyph-cell wraparound the encounter seed produces, drawn with a built-in 5x7 bitmap font. The cue track marks entry (chamber pitch) and exit (octave below) with plain tones. It is a timing aid, not a composed score (sound composition stays with the artist, issue 34).

```sh
node export-rendition.cjs --seed 45 --encounters 4 --out /absolute/dir
```

Needs `ffmpeg` and `ffprobe`. It writes `rendition.mp4` (H.264/AAC), `cue-track.wav` and `receipt.json`. The receipt holds SHA-256 of the raw frame stream and the cue track, which are independent of the encoder and identical on every run for the same seed, plus what `ffprobe` reads back. This is a schematic rendition, not a capture of the browser artwork, and asserts no artist, accessibility, device or audience acceptance. `tests/rendition.test.cjs` covers legal routing, byte-reproducible frames, palette contrast, WAV structure and an end-to-end decode.

### Replay verification

`verify-rendition.cjs` re-derives a rendition directory's claims from the receipt's own seed, encounter count, fps and size, without trusting any digest the receipt carries:

```sh
node verify-rendition.cjs --dir /absolute/dir [--min-psnr 30]
```

It replays the route through `RouteSession` and compares the timeline, recomputes the raw frame-stream SHA-256 and the cue track (list, digest and byte-for-byte against `cue-track.wav`), reads the MP4 back with `ffprobe`, decodes every video frame and compares its luma to the frame re-rendered from the seed (PSNR, default floor 30 dB; the exact seed measured 36.7 dB worst frame and a different seed 5.5 dB), and decodes the AAC track to check tones sit in the cue windows with silence outside them. Exit 0 means every check passed, 1 means a check failed (each is named on stderr, JSON verdict on stdout), 2 means bad arguments or a tool failure. Chroma is not compared because 4:2:0 subsampling smears one-pixel coloured edges in every conforming encoder. It decodes audio and video to memory only; nothing is played. Mechanical evidence only; no acceptance is asserted. `tests/verify-rendition.test.cjs` covers a clean replay and each tamper: a changed seed, an edited word, forged frame and cue digests, a flipped WAV byte, another seed's MP4, a truncated MP4, missing files, bad JSON and out-of-range parameters.

Cold-review hardening (PR 75 review): each decoded cue window must carry the cue's own pitch (Goertzel share of window energy at least 0.8; a real encode measures 0.94, a second tone at 0.7 of the cue amplitude 0.63), anything above 100 of 32767 outside the windows fails (was 1500), every 16x16 luma block must stay within 20 dB (a real encode worst 27.4 dB, a 4x4 edit fails while whole-frame PSNR still passes), the MP4 must hold exactly one video and one audio stream, the receipt must carry exactly the exporter's fields with its fixed `kind` and `claims` text, and frame sizes are capped at 7680x4320 in both exporter and verifier. Fresh cold review of PR 80: the audio stream must be mono at the cue track's own sample rate (the decoder folds to mono at that rate, so a side-channel voice or a tone above half that rate used to vanish before any check), `receipt.json` must be byte-identical to the exporter's canonical serialisation of its own content (duplicate keys and whitespace changes fail), `file.ffmpeg` must be an `ffmpeg version ... Copyright (c) ... the FFmpeg developers` line, the seed must lie in 0..2^32-1, and `cue-track.wav` must be a regular file. Known residual: the MP4 bytes themselves are not hashed (encoder output is not reproducible), so trailing bytes and container metadata pass; an edit of one or two pixels, or sound below 100 outside the windows, is below the thresholds.
