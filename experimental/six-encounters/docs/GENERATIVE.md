# Word-routed generative loops · configuration 1.0.0

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

## Character cells — version 1.1.0

Artist direction: each character occupies a transparent cell and wraps across its
opposite boundary. Implemented in the generative loops only. A cell retains the
natural glyph advance and a 1.2em line height. Its clipped 3×3 periodic glyph tile
moves one whole cell per period: horizontal 2400ms, vertical 3100ms, diagonal
3700ms. Negative stagger offsets give each character a different position.
Copies use CSS generated content in an aria-hidden plane; the source character
remains once in DOM text. Words remain fixed selectable targets. Focus, pause and
hidden state stop movement; reduced motion presents stationary letters.

Assessment: the split fragments make recurrence visible at the scale of a letter.
This is an implementation assessment, awaiting artist review. No reader testing
or physical Safari verification is claimed. Browser checks verify clipping,
opposite tiles, midpoint movement and periodic endpoint continuity on desktop
and narrow mobile, alongside the existing score and timing checks.
