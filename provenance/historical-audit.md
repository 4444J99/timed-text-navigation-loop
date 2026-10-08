# Hole-loop historical extraction audit

Checked on 2026-10-07. This audit concerns the standalone extraction requested by the artist, before any proposed artistic expansion. Source files were read without changes and no remote writes were made.

## Historical anchor and identity verification

Use `7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0`, committed **2017-07-20T20:32:07Z**, with tree `c79e9526d77a728c669da20ee221749063e3f62d`. GitHub's master history filtered before 2017-10-08 returns it first. The recursive historical tree is complete, not truncated, and contains 1,647 entries. The final commit changed only `git-credential-manager`; the artwork's assets predate it.

Sources: [commit](https://github.com/unnamedplay-r/etceter4/commit/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0), [historical tree](https://api.github.com/repos/unnamedplay-r/etceter4/git/trees/c79e9526d77a728c669da20ee221749063e3f62d?recursive=1), [filtered history](https://api.github.com/repos/unnamedplay-r/etceter4/commits?sha=master&until=2017-10-08T00:00:00Z&per_page=5).

The twelve chamber HTML files, `loophole.html`, `css/styles_old.css`, and `js/loophole.js` in the earlier research snapshot were individually hashed as Git blobs and match the 2017 tree: **15 matches**. The earlier research's `js/main.js` does **not** match 2017. Its 2017 identity is `2fb9b554c3f5c277998add7a43c44e256839b96b`. Individual per-file checks are retained in `source-manifest.json` under `preserved_source_files` (Git blob SHA-1 and SHA-256 identities per source file). All twelve chambers and `styles_old.css` also have the same identities in the initial 2016-11-29 tree. The source filenames may encode earlier writing dates, but this is not evidence of those dates' actual website presentation.

## Entrance behavior and design

The document title is `FELL INTO A wHOLE`; its description is `this is where you go to get lost`. There are eleven identically worded `L O O P H O L E` anchors. Their classes follow black, cyan, magenta, yellow, black, cyan, magenta, yellow, cyan, magenta, yellow. Each has `href="#"` and invokes the same `randomlinks()` function. Their colors identify different appearances, not different destination pools.

The entrance uses nested Bootstrap rows/column markup, `#mainContainer`, `#pages`, and `#loop`. Historical `styles_old.css` gives `#loop` an opaque white background, height 100%, and vertical scrolling. Its paragraph rules specify Futura, normal weight, uppercase, justified alignment, baseline 10rem font size and 2rem line height, with a full-width generated inline block after each paragraph. The stylesheet includes multiple breakpoint overrides affecting paragraphs and anchors; preserve their original ordering. Bootstrap 3.3.5's root font scaling and grid/typography rules are active and must be reproduced by local assets rather than omitted.

Hovering cyan/magenta/yellow links changes their text to transparent and their background to the matching color; hovering the black class changes text to transparent against white. Visited colors remain the original class colors. Do not replace this with a conventional menu or navigation buttons. The extra closing paragraph tags should remain until rendered comparison proves normalization equivalent: the HTML parser can synthesize empty paragraphs and the generated paragraph content can affect spacing.

Source: [entrance](https://github.com/unnamedplay-r/etceter4/blob/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0/loophole.html), [original stylesheet](https://github.com/unnamedplay-r/etceter4/blob/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0/css/styles_old.css).

## Chamber timing and presentation

Every chamber schedules navigation to `../loophole.html` from the body's load handler. Exposure is elapsed time after load, not reading time or visibility-adjusted time. `040615` uses 10,000 ms, `072716` uses 2,000 ms, and the other ten use 5,000 ms. The historical experience includes no manual next controls, pause mode, visit memory, or chamber-to-chamber links. Its input is choosing another identical entrance link after every return.

The ten inline-styled chambers specify an 8px body font size and `"Futura", sans-serif`. Their key declarations are:

| Chamber | Background | Text and layout |
|---|---|---|
| 040615 | White | Black uppercase justified prose; absolute left 5%, width 90%, font 5.3em (42.4px from 8px body). |
| 040715 | #FF00AA | White uppercase centered h1, 9em (72px), 10px margin; three leading breaks. |
| 040815 | Red | White uppercase question at left and reply at right, both 5em (40px), separated by source breaks. |
| 040915 | Cyan | White uppercase centered h1, 8em (64px); ten intervening breaks. |
| 041015 | Black | White uppercase centered repeated field, 2.1em (16.8px); preserve all 378 instances. |
| 041315 | Black | White uppercase centered h1, 5em (40px), with five authored lines. |
| 041415 | Yellow | White uppercase justified text at top 30%, left 30%, width 650px, 3em (24px). |
| 041715 | White | Black justified text at top 25%, left 35%, width 450px, 3em (24px). |
| 042115 | #FF00AA | White text at top 50%, left 5%, width 90%, 7em (56px). |
| 042215 | Yellow | White text at left 5%, width 90%, baseline 2em (16px) with inline size changes. |
| 051815 | Browser defaults in tracked source | No inline style; all referenced local stylesheets are absent. Three paragraphs. |
| 072716 | Browser defaults in tracked source | No inline style; all referenced local stylesheets are absent. Two paragraphs. |

The two unstylized pages are particularly consequential. `styles_old.css` does contain `#o001bg { background-color: red; }` and white uppercase justified 3rem Futura rules for `#o001 p`. They are plausibly intended for these pages, whose IDs match. However, neither page loads that stylesheet. They instead request missing `labyrinth/css/normalize.css`, `labyrinth/css/skeleton.css`, and `labyrinth/css/style.css`. Applying the matching rules now is a reconstruction, not the exact rendering of the 2017 tracked source. For the requested faithful extraction, preserve their source-derived default presentation and record the alternate evidence in documentation.

Futura is not bundled in the historical tree, so exact glyph metrics depend on installed system fonts. A Google Raleway import exists, but the inspected artwork does not apply Raleway. Replacing Futura with Raleway would change the design. Keep the authored Futura declarations and fallback behavior, and acknowledge system-font variation if reporting pixel fidelity.

Source: [historical chamber directory](https://github.com/unnamedplay-r/etceter4/tree/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0/labyrinth).

## Which defects are historical

1. **Undefined navigation destination:** `Math.round(Math.random() * 12)` produces indices 0–12 while only 0–11 exist. Its undefined slot occurs for a nonzero high-end interval of random values, and the first defined destination receives half the probability of the interior values. The defect is present in the 2016-12-27/28 selector, not a 2025 regression. An in-bounds twelve-item selection is a necessary working-navigation repair. If made uniform, record that distribution correction explicitly.
2. **Absent chamber styles and scripts:** `labyrinth/css/*`, `labyrinth/js/main.js`, and `labyrinth/images/favicon.ico` are absent from the initial 2016, functioning 2016-12, and final 2017 trees. The histories of `labyrinth/css/` and `css/style.css` before the anchor are empty. Removing those failed dependency requests preserves source-derived rendering. Redirecting them to another stylesheet would change behavior and requires separate reconstruction attribution.
3. **Site shell dependency error:** the 2017 entrance loads `js/main.js`, which calls `Page.findPage` although no Page implementation is imported there. This shared site code has no functioning hole-loop purpose. Dropping it is an appropriate isolation repair. The chamber-relative main.js requests never resolve.
4. **Dormant background image request:** the 2017 selector calls `ChangeIt()` once on entrance load to request `bgimages/1.jpg` through `bgimages/99.jpg` as a repeating body background. No such root directory exists. The same 2017-04-21 commit that introduced this code placed 99 actual JPEGs at `img/photos/random/bgimages/`. Git history for the requested root `bgimages/` is empty. There is no tracked revision proving that the body image ever resolved.

Sources: [selector](https://github.com/unnamedplay-r/etceter4/blob/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0/js/loophole.js), [2016 functioning commit](https://github.com/unnamedplay-r/etceter4/commit/176b676f8f6d6a622383b54e943c316b79a7369c), [background addition](https://github.com/unnamedplay-r/etceter4/commit/b831f4c5e2338712a99be8c7fdb43f2010f23277), [2017 shared main](https://github.com/unnamedplay-r/etceter4/blob/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0/js/main.js). The API queries consulted are linked inline above; their retained results are recorded in `source-manifest.json` (`selection_basis`, per-file blob identities, and the `dormant_background_candidates` path inventory).

The functioning commit's entrance changes are narrowly evidenced: it changes `css/styles.css` to `css/styles_old.css` and adds the selector script. It did not fix chamber CSS, apply the red last-two styling, or contain the later background image collection.

## Smallest defensible standalone changes

- Preserve the thirteen artwork routes, source text, breaks, dates, titles, CSS colors, layout, hover behavior, and exact return delays.
- Add a root entry route that reaches the entrance and retain `loophole.html` for returns.
- Bundle active Bootstrap 3.3.5 CSS and local source styles. Remove unused Raleway and Javascript CDN imports after verifying the displayed experience and timers still work without them.
- Remove Google Analytics, failed assets, and unrelated shared-site initialization. These are dependencies on the parent site or external services rather than authored chamber operations.
- Correct destination selection so all entries always resolve to the twelve chambers. Document it as an original-defect repair.
- Leave dormant images and unreferenced red styling out of the active rendering. Preserve their existence in source evidence if useful.
- Validate matching computed styles and screenshots against the unchanged 2017 source under the same browser, viewport, and installed fonts, with remote CSS supplied locally. Test every timer and destination, no external requests, direct route access, and operation under a URL subdirectory.

The result may accurately be called a working, self-contained extraction of the 2017 source with minimal dependency and navigation repairs. It should not claim to reproduce an undocumented original live-server configuration or missing font files.
