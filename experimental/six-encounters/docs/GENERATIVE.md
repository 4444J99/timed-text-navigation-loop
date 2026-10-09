# Word-routed generative loops · configuration 1.2.0

Implemented from the artist's request: one random omitted space on each entrance row per generation; row colors as chamber fields; varying colored words; animated text and entrances/exits; words lead onward; no selection returns to the beginning.

## Executable rules

- Every entrance render obtains a fresh browser crypto seed. Each of its eleven LOOPHOLE rows joins exactly one adjacent letter pair, chosen from the seven spaces. Seven groups remain, with six gaps justified across the row; no letter is deleted. This applies to score returns as well as generative returns. Random choices may repeat by chance.
- Clicking a row enters one of the three selected source chambers, on that row's exact color: black `#000000`, cyan `#00ffff`, magenta `#ff00ff`, or yellow `#ffff00`. The eleven-row source color order remains fixed. The row's chamber is `(row index mod 3)` in Moment, I/you, Progress order.
- A new 32-bit seed selects three distinct RGB foregrounds with calculated contrast >= 4.5:1 against the field, a motion family (wave, drift, stretch), one of four entry/exit directions, and the next route's field/seed. Contrast calculations concern the opaque configured colors, not a full accessibility certification or moving/fading frames. Word colors cycle across the source words/instances. No color is assigned a universal emotional meaning.
- Moment's **before** leads to I/you; **again** leads to Progress. Progress's **forced** leads to Moment; **progress** leads to I/you. All 378 I/you instances remain in 42 rows of nine, with alternating Moment/Progress links by column. Two representative art links are in its keyboard tab sequence, and the stationary **Words / routes** menu provides both routes with full-size 44px-minimum targets. Source wording and order are unchanged.
- Entry lasts 450 eligible milliseconds; active exposure lasts 5,000; departure lasts 350. Text animates while active. A word selection accepts exactly one route and exits before entering that selected destination. If no word is selected, expiry exits to a newly generated entrance. The entrance has no timer. Eligibility uses the existing monotonic accumulator: ready/rendered, visible, unpaused. Visibility/resume setters do not navigate; only eligible foreground ticks finish a phase. Reading view suspends exposure and remounts the same encounter/seed without scoring another visit.
- Return permits an early departure to the entrance. Exit cancels the active clock and pending route, opens the neutral index, and adds no fabricated return. Competing word/timeout events cannot accept two destinations. Reduced-motion preference removes the animation while retaining the same routing and duration rules. Pause stops clock and CSS motion.

## Independence and records

The word-routed experience is a separate `RouteSession`, not a modification of the six-encounter `Session`. **Score & studies** exposes the existing deterministic composition and four independent instruments. That composition still defaults to reader-paced and requires an entrance return followed by a separate entry action. Its three first-visit layouts, six-entry history, visits and cycle markers are not incremented by generative routes. The shared entrance's row spacing regenerates without changing the scored chamber definitions.

Generative visits, unique identities, colors, seeds, motion, links, eligible exposure and accepted routes are session-local. Only the latest 32 completed events and three displayed traces are retained; visit totals stay separate. **Download variation record** exports configuration, current entrance and the bounded route session for reproduction. The pure rules in `generation.js` reproduce a given seed's groups, palette, routes and motion. There is no analytics, account-based memory or cross-device persistence.

“Infinite variation” is implemented as open-ended navigation and regenerating combinations, not a mathematical guarantee that finite RGB/32-bit outputs never repeat. No new writing or remaining-chamber content is invented.

## Assessment and actual evidence

My visual inspection: removing one gap creates visibly fused pairs and uneven intervals without breaking the word. The row-to-field relation makes the entrance function as a color selector. Underlined words now act as authored branches, while no selection preserves the recurring return. Movement and multiple text colors can complicate reading of the dense field; Pause, Scroll detail, Reading view and stationary routes are therefore retained. No additional artist approval or external reader observations are claimed.

Verification: eight additional pure-rule/state tests plus the existing eleven state/timing tests. Seven new browser groups cover desktop 1440×1000, mobile 390×844 and keyboard/reduced-motion controls at 320×568. Screenshots in `verification/generative/` include generated entrances, entry/active/exit frames, routed Moment, and all 378 I/you instances. The existing 23 browser groups also pass for the protected composition and studies. Environment: Linux Chromium 138.0.7204.0, Playwright 1.62.1. Hidden-page wiring is simulated; physical Safari/phone testing and artist approval remain outstanding.

Relevant existing roadmap issues: #24 seeded routes, #29 relational color, #23 typography/device evidence, #18 clocks. This implements a bounded three-chamber slice of those broader issues; it does not close their other deliverables or gates.

## Character cells — version 1.2.0

The current implementation builds on the character renderer already added at
`4f586a5`; the earlier `c5add03` inspection describes a superseded renderer.
Only generative loops receive this movement. Protected scored artwork is unchanged.

Each glyph has a stable transparent territory: natural glyph advance × 1.2em.
An invisible, accessible source glyph sizes it; an aria-hidden plane paints the
same glyph with eight neighboring shadow copies. Overflow clips the 3×3 tile.
Both positive and negative crossings re-enter progressively, including simultaneous
corner crossings; the image at one complete period matches the initial image.
Words remain stationary buttons with the same route and accessible name.

`HLGeneration.character(seed, glyphIndex, options)` deterministically chooses
axis, sign and initial phase from an independent seed stream. This preserves
existing palette/route randomness. Default axes are horizontal, vertical and
combined (`diagonal`); their periods are 2400, 3100 and 3700ms. The renderer's
`characterMotion` option accepts matching `axes` and positive `periods` arrays;
a single axis constrains every glyph, or a mixed set produces independent motion.
The encounter seed and configuration version in downloaded records reproduce
all glyph plans. No control panel is added to the artwork.

The recorded motion family now selects visible CSS keyframes: drift has constant
velocity; wave uses a sampled cycloidal speed profile; stretch spends the first
half-period covering one quarter-cell, then accelerates through the remaining
three quarters. All profiles complete exactly one cell per period without
scaling, moving or resizing the territory. `characterPosition` reproduces these
profiles in normalized coordinates for regression tests.

Pause, hidden state and focused route buttons freeze motion; reduced motion
removes animation while keeping static glyphs, timing and routes. Reading view
suspends exposure, and remounting reproduces the same seed's initial phases.
Continuous animation phase across a reading-view remount is not persisted.
Source glyphs use opacity rather than visibility hiding so non-route words remain
available to assistive technology. Actual screen-reader behavior requires review.

The early Return race is also fixed: delayed mount readiness cannot replace an
already-running exit clock. Boundary tests check all axes, signs and families;
Chromium tests compare visible positions against the pure model, stable cell
bounds, pixel-identical period endpoints, deterministic DOM replay, reduced
motion, early Return, and edge-to-edge 1440×1000, 390×844, 844×390 and 320×568
viewports. `verification/generative/` is recaptured for this renderer;
`verification/character-cells/` holds its separate report and viewport captures.

Physical iPhone/Safari verification remains necessary for safe-area behavior,
font fallback and rasterization, dynamic address-bar/full-screen transitions,
touch routing, reduced-motion preferences and dense-field animation performance.
No physical-device, external-reader or artist approval is claimed.
