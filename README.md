# hole-loop

The original **LOOPHOLE / labyrinth** artwork, extracted from ETCETER4 as an independent, self-contained static site.

The reference is [ETCETER4 commit `7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0`](https://github.com/unnamedplay-r/etceter4/commit/7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0), committed **July 20, 2017**. It is the last ancestor of the inspected `master` before October 8, 2017. This extraction implements that edition's existing experience.

## Open it

Open **`public/index.html`** in a browser. All runtime files are local; the artwork needs no installation, build step, API key, account, or network connection. `public/loophole.html` remains the original entrance URL.

For a local HTTP preview, run this from the repository directory:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory public
```

Then open `http://127.0.0.1:8080/`.

To host it anywhere, serve the contents of `public/` as static files. A domain root and a subdirectory both work. Every chamber can be opened directly.

## The preserved experience

The entrance presents eleven identically worded LOOPHOLE links, with their original black, cyan, magenta, and yellow treatments and hover behavior. Every link chooses among the same twelve chambers.

Each chamber retains the original text, title, body markup, inline styles, line breaks, and exposure interval. The browser automatically returns to the entrance after the document loads:

| Chamber | Return interval |
| --- | ---: |
| `040615` | 10 seconds |
| `040715` | 5 seconds |
| `040815` | 5 seconds |
| `040915` | 5 seconds |
| `041015` | 5 seconds |
| `041315` | 5 seconds |
| `041415` | 5 seconds |
| `041715` | 5 seconds |
| `042115` | 5 seconds |
| `042215` | 5 seconds |
| `051815` | 5 seconds |
| `072716` | 2 seconds |

Navigation has no visit memory or fixed sequence. The entrance waits for a click. Each new chamber visit starts its original load-based timer.

## Necessary extraction repairs

The original HTML body markup and inline CSS are unchanged. The original entrance stylesheets are preserved byte for byte. [The exact patch](provenance/extraction-diff.patch) records every change to the historical HTML and artwork script.

1. **Correct the selector.** The old `Math.round(Math.random() * 12)` could address an undefined thirteenth entry. Selection now uses the actual twelve-item array length and gives each chamber equal probability.
2. **Bundle active dependencies.** The exact Bootstrap **3.3.5** CSS and theme used by the original pages are local, together with all five referenced font formats and the original MIT license. The bundled CSS was compared byte for byte with the original CDN responses and verified against the release's Git blobs.
3. **Remove parent-site and unused scripts.** The parent site's `main.js`, jQuery, Bootstrap JS, Velocity, and analytics supplied no functioning hole-loop behavior. Removing them makes the work independent and removes unnecessary external requests. The artwork's own navigation and inline return timers remain.
4. **Remove requests that did not affect the historical rendering.** Raleway was requested but not used. Several local CSS, script, and favicon URLs never existed at the requested paths. Removing these requests preserves their absence from the original rendered design.
5. **Provide the new root entrance.** `index.html` is a byte-identical copy of the extracted `loophole.html`, allowing the work to start at the new site's root.

### Historical decisions

The two final chambers, `051815` and `072716`, retain **browser-default styling**. Their source refers to missing stylesheets. Similar red-background rules elsewhere in the parent site do not prove those pages used them, so this extraction does not introduce them.

The source's background loader requests a nonexistent `bgimages/` directory. Ninety-nine numbered photographs existed at a different path. Their identities are recorded in the source manifest, but activating them would add visual material absent from this commit's source-derived rendering. The failed background request is removed.

Futura remains the requested system typeface where the original declares it. The original did not bundle a Futura font file. Devices that have it can use it; other devices retain the original browser fallback behavior. Raleway is not substituted. Pixel comparisons are meaningful within the same browser, font environment, and viewport; this package does not claim to recreate an independently captured 2017 live-site session.

## Repository structure

| Location | Contents |
| --- | --- |
| `public/` | Complete, deployable artwork; no build required |
| `provenance/original-2017/` | Nineteen original source files, preserved with Git blob and SHA-256 identities; text files use an inert `.txt` suffix |
| `provenance/source-manifest.json` | Reference commit, path mapping, source identities, timings, and historical decisions |
| `provenance/bootstrap-provenance.json` | Exact release/CDN dependency identities |
| `provenance/extraction-diff.patch` | Reviewable changes from original HTML and navigation script |
| `scripts/verify.py` | Dependency, markup, timing, and source-integrity verification using Python's standard library |
| `tests/` | Browser fidelity and standalone behavior verification |
| `verification/` | Recorded verification results |

Original files are evidence, not another live edition: the `.txt` suffix prevents their historical analytics and scripts from executing when casually opened. The entire serving boundary is `public/`.

## Verify

```sh
python3 scripts/verify.py
```

This validates source hashes, exact body/inline-style preservation, return intervals, the root alias, vendored files, and local dependency resolution. Browser verification instructions and coverage are in `tests/README.md` and `verification/README.md`.

## Git history and publication

The repository contains a source-preservation commit tagged `source/2017-07-20`, followed by the working extraction on `main`. The source tag identifies this bounded extraction; the upstream historical SHA above remains the authority for the original repository.

The Git bundle supplied with this package can reconstruct the repository and its history. Run this from the folder containing the bundle; the new directory is separate from the supplied plain working files:

```sh
git clone hole-loop.bundle hole-loop-repository
```

GitHub publication can use the complete prepared repository. With an authenticated GitHub CLI and a new, unoccupied destination, the creation command is:

```sh
gh repo create 4444J99/hole-loop --private --source . --remote origin --push
git push origin source/2017-07-20
```

These commands describe the remaining publication operation when no GitHub remote has been created. Do not run them against an existing unrelated repository. No hosted deployment is needed to run the artwork locally.

## Credits and rights

Original artwork and source: **ET CETER4 / Anthony James Padavano**, as retained from the source and its repository history. This extraction introduces no project-wide license grant. Original creative materials retain their existing rights. Bootstrap and Normalize.css retain their accompanying upstream license notices. See [COPYRIGHT.md](COPYRIGHT.md).
