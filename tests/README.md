# Browser verification

The artwork itself needs no dependencies. The following installation is only for its development checks.

From the repository directory:

```sh
npm ci
npx playwright install chromium
npm test
```

On a Linux machine missing browser system libraries, use `npx playwright install --with-deps chromium`. Python 3 and Node 20 or later are required for the verification tools; the recorded run used Node 24.

`npm test` first verifies source and dependency identities with Python's standard library, then runs `tests/verify-browser.cjs`. The browser script uses Playwright 1.62.1 and pngjs 7.0.0, pinned in the lockfile.

The script starts and closes its own loopback HTTP server. It reads original source from `provenance/original-2017/`, resolving the archive's inert `.txt` suffix internally while returning the original content type. Missing historical paths remain missing. Only the two original Bootstrap CDN stylesheet URLs are fulfilled from the exact local vendor files. All other external requests are blocked.

## Scope

- Thirteen historical routes at desktop 1440 × 1000 and mobile 390 × 844 viewports.
- Four entrance hover treatments at both sizes.
- Exact decoded screenshot pixels and artwork DOM, text whitespace, styles, geometry, and scroll dimensions.
- The entrance's eleven native links, all twelve random destinations, and random-boundary values.
- Every 2-, 5-, and 10-second return timer before and at its deadline.
- Same-chamber re-entry with a fresh timer.
- HTTP at a domain root, HTTP in a nested subdirectory, and direct `file://` access.
- No external runtime requests, missing active resources, JavaScript errors, or console errors.

Visual capture disables JavaScript on both original and restored pages so timers do not interrupt static comparison. Separate behavior checks use JavaScript and native browser clicks. Timer deadlines use Playwright's controlled browser clock.

The suite requires all 34 visual cases and 92 behavior checks to complete; it cannot report a complete pass after skipping a route, viewport, or hosting mode.

## Options

```sh
node tests/verify-browser.cjs \
  --original provenance/original-2017 \
  --public public \
  --vendor public/vendor/bootstrap-3.3.5 \
  --output test-results/browser
```

An already installed compatible Chromium can be supplied with `--executable /absolute/path/to/chromium`. This is useful where the Playwright download endpoint is unavailable.

The recorded extraction run used Chromium 153.0.8010.0 supplied by the optional `@sparticuz/chromium` 153.0.0 package in a restricted Linux environment. That supplier is not part of the artwork or the normal test installation. The GitHub workflow uses Playwright's standard Chromium installation.

## Interpreting results

Fresh test output defaults to `test-results/browser/` and is ignored by Git. The extraction's recorded results are in `verification/browser/`. Both contain a report, original/restored screenshot pairs, and DOM comparison records.

A matching pair establishes fidelity within the same browser, font environment, and viewport. It does not establish the exact output of an unobserved 2017 server, an unavailable original font, or an untested browser. The mobile run is Chromium emulation, not physical iPhone or Safari verification.

The included GitHub Actions workflow runs these checks on pushes and pull requests. Its presence is configuration; a successful GitHub-hosted run must be verified after repository publication.
