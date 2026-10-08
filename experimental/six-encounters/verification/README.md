# Verification evidence

`recorded/browser-report.json` lists the checks that actually passed, browser version, platform and viewports. PNG files capture the initial entrance, all six visits, final entrance, and three color conditions at desktop and narrow mobile widths. They are evidence of this new edition only.

State/timing suite: 11 Node tests, including exactly-once return in both event orders; restart generation invalidation; independent study sessions; layout memory preserved when visible traces are bounded; and the exact 3,000 + hidden interval + 1,999 millisecond boundary example. The final millisecond permits a return only on an eligible clock tick.

Browser suite: actual DOM count, ordering, placement, fixed color-study properties, remembered outline coordinates, resize, keyboard activation/focus, fit/detail, reset, six-entry completion in both modes, reread invariance, exit cancellation, pause/resume and reading suspension. Browser time is controlled by Playwright. Document visibility is simulated for wiring verification; actual browser-background throttling was not tested. The monotonic accumulator's hidden-time boundary is independently tested with an injected clock.

Environment: Linux, Chromium 138.0.7204.0, Playwright 1.62.1; desktop 1440×1000 and narrow mobile viewport 390×844, including a resize on revisit. Chromium was obtained from the verification-only `@sparticuz/chromium` 138.0.2 package because the normal browser CDN download in this environment returned HTML instead of a browser archive. The binary is not included in the repository or runtime. No managed preview or cloud-browser skill was used for the recorded run.

Limitations: no Safari/Firefox run, physical device test, assistive-technology audit, external reader observations, artist approval, or production routing verification. The separate owner-private experimental deployment succeeded; live phone rendering remains for artist review. Passing checks establish the stated mechanics in this environment; they do not establish a universal interpretation or attention measurement.

Rerun using the experimental README's instructions. New evidence goes to ignored `verification/rerun/` by default, preserving this recorded set.

## Full-screen revision 1.1.0

`fullscreen/` retains a separate current evidence set: desktop 1440×1000, narrow mobile 390×844, small phone 320×568, and landscape 844×390. Automated checks establish edge-to-edge viewport bounds, all six source field colors, white type, preferred Futura stack, source capitalization, eleven entrance rows, and unobstructed 44px controls including Pause on small/landscape screens. The full state/timing and browser suites remain required. The entrance controls were visually corrected to paint above the repeated field after screenshot inspection. These are Linux Chromium viewport tests, not physical iOS tests.
