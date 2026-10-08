# hole-loop — architecture and concentric roadmap

Updated 7 October 2026 (America/New_York). Canonical GitHub master: [#2](https://github.com/4444J99/timed-text-navigation-loop/issues/2). The plan covers the new experimental edition; historical restoration remains separately tracked in [#11](https://github.com/4444J99/timed-text-navigation-loop/issues/11).

## Current implementation and ownership

Artistic/content/edition authority: the artist. Technical component and future service/process maintainers must be named before an extraction or new operating obligation is activated; this record does not invent a company or staffed team. The hosted preview has separate hosting access; it does not introduce participant accounts into the artwork.

| Component / concern | Capability and owned boundary | Current repository path | Deployable / runtime resource | Current evidence / activation |
| --- | --- | --- | --- | --- |
| Source / creative edition | Exact selected language, source/derivative identities and rights ledger | `experimental/six-encounters/content.js`; `docs/PROVENANCE.md`; `docs/source-census.json` inside that package | Static content loaded locally in browser | Read-only source revision pinned; broader custody/references #12/#22 remain open |
| Score / encounter engine | Sequence, successful visits, timing, return queue and reset | `experimental/six-encounters/engine.js` | Browser session; no server persistence | Fixed composition technically verified; #15/#16/#18 |
| Reader / renderer | Text/type/geometry, remembered bounds, reading and controls | `experimental/six-encounters/index.html`, `app.js`, `render.js`, `style.css` | Static browser package | Three chambers implemented; artist/access review #17/#19/#20 |
| Formal instruments | Independent controlled comparisons and configuration records | Existing experimental reader/runtime | Same static package; independent study sessions | Four instruments verified; #56/#57 closed bounded mechanics |
| Assurance / evaluation | Meaningful state/browser fixtures and separate creative decisions | Package `tests/`, `verification/recorded/`, `docs/EVALUATION.md`; dedicated verification workflow | CI runner, records and captures | Exact-head CI passed; physical Safari/assistive/artist review uncollected |
| Documentation / composition policy | Reader/author/operator explanation, source/version contracts and ADRs | Existing package `README.md` / `docs/`; this `docs/ROADMAP.md` | Versioned documentation | Documentation exists; maintained ownership/runbooks and selected release evidence remain open |
| Delivery / review deployment | Exact artifact, host/access configuration, recovery | Source remains in this repo on `experiment/six-encounters`; hosted source receipt in PR #59 | [Owner-review preview](https://hole-loop-experimental.ajpadavano.chatgpt.site) | Deployment exists; authenticated journey/device/recovery evidence #20 |
| Future library / services | Shared engine/interfaces, hosted data/identity/runtime only if required | No extra GitHub repositories created | None required for current edition | #40–#46 select a real consumer/service path |
| Company / institutional operation | Offers, support, agreements/vendors and finance | Public issues describe requirements; private records stay in appropriate systems of record | No finance/legal backend assumed | #47–#54 activate for actual demand/obligations |

Paths describe the experimental branch at `687bd3e83c668cfe5620f558f74d3388cc0bf0f5`; the runtime PR is open. Inner `docs/` and `tests/` entries are relative to `experimental/six-encounters`. Historical source paths are evidence inputs, not files to mutate in this planning task.

## Composition contracts

| Provider → consumer | Required contract | Verification / growth rule |
| --- | --- | --- |
| Source ledger → edition / score | String source IDs, revision/hash, exact language/normalization, rights, derivative lineage | Source/wording comparison; no silent substitution |
| Score → engine | Versioned chamber order, entry/return semantics, permitted changes, duration eligibility and completion | Exact sequence/counts/clock/state fixtures |
| Engine → reader / renderer | Current chamber/visit, trace bounds/transform, controls, source-reading suspension | Layout/bounds/input/resize/browser fixtures; renderer never changes source identity |
| Study instrument → evaluation | Fixed/variable properties, reset, configuration, captures and optional labeled observations | Study session does not change composition visits; structural checks ≠ artist approval |
| Edition / software → deployable | Source/score/software identifiers, runtime asset identities and build/configuration | Exact payload and live route evidence; deployment ≠ merge or acceptance |
| Shared component → sibling consumer | Named provider/consumer, stable versioned API/schema/time/asset semantics | At least two real consumers for a new shared library; compatibility and rollback |
| Commercial offer → access capability | Fulfillment/license terms plus a separately tested entitlement policy | Paid status does not substitute for authorization; process uses suitable systems of record |

## Repository decisions

| Candidate unit | Keep in current project until | Evidence required before extraction |
| --- | --- | --- |
| Core | Engine can be maintained with the artwork | Independent reusable lifecycle, two real consumers for a shared engine/library, versioned state/score API and maintainer |
| Web / rendition | One static browser surface is sufficient | Independently deployed application/rendition, actual audience workflow, access/ownership or release boundary |
| API / integrations / SDK | Internal functions/local file contracts meet need | Named external consumers, provider/consumer tests, compatibility and real integration lifecycle |
| Data | Source ledger and local session data meet need | Persistence/custody/permission boundary, actual schemas/migrations, lineage, retention/deletion/recovery and owner |
| Admin | Artwork requires no participant account plane | Actual author/customer/tenant authority and configuration requirement; separate IAM and enterprise configuration |
| Infra | Static package and existing host are adequate | Independent service/resource/permission lifecycle, reproducible selected runtime and rollback |
| Evals / docs / developer tooling | Co-located fixtures and docs serve one edition | Independently maintained/reused artifact, consumers, versions and compatibility/release expectations |
| Ops | Existing systems of record can run the practice | A real independently maintained automation/deployment boundary; company category alone is insufficient |
| Dedicated organization | One maintained project is sufficient | Sustained independent operating ownership, actual governance/access needs, maintenance capacity and cost/migration plan |

Every extraction also needs a named owner, concrete boundary/consumer, versioned contract, release/checks, migration and rollback. A stateless service need not introduce persistence/accounts. A local shared library need not introduce a hosted gateway or SRE stack. Current preview delivery is one deployable of this work, not another product.

## Company process map

| Function | Process / accountable role to assign when activated | Automation boundary | System of record |
| --- | --- | --- | --- |
| Offer / licensing | Artist/product owner validates commission, edition, education or hosted offer (#47/#49) | Discovery → agreement → fulfillment → rights/access receipt | Existing offer/contact/agreement record; chosen by process owner |
| Billing / entitlements | Finance handles invoicing/reconciliation; product authority handles feature/license permission (#47/#52) | Approved payment events feed independently governed entitlement rules only if needed | Suitable billing/accounting service plus authoritative entitlement policy |
| Support / success | Named edition or institutional operator owns onboarding, known limits and response obligations (#50/#54) | Intake → triage → release/knowledge update | Existing support tracker / documentation |
| Legal / vendors / people | Named responsible owner resolves applicable agreements, rights, procurement and roles (#51) | Renewal/review/exit reminders only when useful | Private agreement/vendor/people records; public issue holds requirements |
| Finance / sustainability | Budget owner records actual costs, estimates, funding and capacity (#52) | Cost collection, approved reports and reconciliation | Existing accounting/budget/procurement records |
| Portfolio / governance | Artist and named maintainers review boundary, reuse, graduation and maintenance (#13/#14/#53) | Evidence collection and compatibility/release checks | Source canon, ADRs, GitHub issues and relevant private decisions |

Systems of record are selection decisions, not invented current integrations. Commercial processes and engineering components intersect through explicit contracts; they do not share a mandatory repository tree.

## Canonical GitHub roadmap

Hole-loop is an independent work of electronic literature within Persona / Visual Form Canon. Its central proposition is: **the same words acquire another meaning because something has happened between encounters**. Entry, interruption, absence, recurrence and bounded memory are compositional material.

This roadmap applies the enterprise model to the new experimental edition. Historical restoration/import/publication in [#11](https://github.com/4444J99/timed-text-navigation-loop/issues/11) and [PR #1](https://github.com/4444J99/timed-text-navigation-loop/pull/1) are a separate track. The selected chamber language is read-only source input; historical release completion is never a prerequisite for experimental development or deployment.

## Current delivery

Implemented on [PR #59](https://github.com/4444J99/timed-text-navigation-loop/pull/59), branch `experiment/six-encounters`, commit `687bd3e83c668cfe5620f558f74d3388cc0bf0f5`. The recorded 11 Node tests and 19 Chromium browser checks cover desktop 1440×1000 and mobile 390×844 viewports. [GitHub CI](https://github.com/4444J99/timed-text-navigation-loop/actions/runs/37705691477) completed successfully for that exact head.

[Hosted experimental edition](https://hole-loop-experimental.ajpadavano.chatgpt.site) is deployed for owner review; hosting status and private access were checked. The deployment receipt in PR #59 records runtime payload equality. Physical iPhone/Safari, real hidden-tab behavior, screen-reader testing, artist review and external reader observations remain uncollected. Merge into main remains pending. Deployment and technical verification do not establish artistic acceptance.

The score is 040915 → 041015 → 042115 twice, with a reader-initiated entrance between all six encounters. Exact supplied wording, all 378 I/you instances, at most three entrance traces and optional five-second eligible-display return are implemented. Manual reading is the default. The four studies compare color, space, time and remembered geometry without changing composition visits.

## Canonical concentric circles

| Circle | Epic | Outcome | Activation / current state |
| --- | --- | --- | --- |
| C0 | [#3](https://github.com/4444J99/timed-text-navigation-loop/issues/3) | Constitution, source custody, and composition boundaries | Active foundation; read-only source input is available. |
| C1 | [#4](https://github.com/4444J99/timed-text-navigation-loop/issues/4) | Playable six encounters and four controlled formal studies | Implemented, tested and privately deployed; artist/device review remains. |
| C2 | [#5](https://github.com/4444J99/timed-text-navigation-loop/issues/5) | Full authored edition and dependable public release | Selected study findings and chamber-specific review justify each addition. |
| C3 | [#6](https://github.com/4444J99/timed-text-navigation-loop/issues/6) | Composition grammar, authoring, new writing and AI proposals | A demonstrated compositional or authoring need; artist approves promotion. |
| C4 | [#7](https://github.com/4444J99/timed-text-navigation-loop/issues/7) | Sound, performance, spatial and collective participation | Accepted score and a concrete rendition/performance context. |
| C5 | [#8](https://github.com/4444J99/timed-text-navigation-loop/issues/8) | Reusable components or operated services | A second actual consumer or a specific service requirement. |
| C6 | [#9](https://github.com/4444J99/timed-text-navigation-loop/issues/9) | Sustainable commercial and institutional operation | Actual demand, commission, institution or operating obligation. |

C1 includes the completed study sub-epic [#56](https://github.com/4444J99/timed-text-navigation-loop/issues/56) and memory instrument [#57](https://github.com/4444J99/timed-text-navigation-loop/issues/57). Legacy assignment “Circle 1” and “Circle 2” both map to canonical C1; assignment “Circle 3” maps to C2. Assignment “Circle 4” spans routes at C2 ([#24](https://github.com/4444J99/timed-text-navigation-loop/issues/24)), writing/AI at C3 ([#58](https://github.com/4444J99/timed-text-navigation-loop/issues/58), [#32](https://github.com/4444J99/timed-text-navigation-loop/issues/32)) and sound at C4 ([#34](https://github.com/4444J99/timed-text-navigation-loop/issues/34)). The old four-circle titles are aliases in the immutable implementation record, not another roadmap. [#55](https://github.com/4444J99/timed-text-navigation-loop/issues/55) remains a closed duplicate.

These are expanding capability envelopes. A projection, commission or educational rendition can use an accepted score without first building a studio, hosting accounts or extracting an engine. Dependencies name required evidence for the chosen path; an optional issue's mere existence does not make its full closure a prerequisite. Source custody, accessibility, rights, tests, delivery, documentation and recovery start at the center and deepen as requirements arise.

## Responsibility systems

| System | Hole-loop responsibility | Representative issues |
| --- | --- | --- |
| Product | Reader artwork, score/corpus, study instruments, authoring and selected renditions | [#15](https://github.com/4444J99/timed-text-navigation-loop/issues/15), [#16](https://github.com/4444J99/timed-text-navigation-loop/issues/16), [#17](https://github.com/4444J99/timed-text-navigation-loop/issues/17), [#21](https://github.com/4444J99/timed-text-navigation-loop/issues/21), [#28](https://github.com/4444J99/timed-text-navigation-loop/issues/28), [#31](https://github.com/4444J99/timed-text-navigation-loop/issues/31), [#39](https://github.com/4444J99/timed-text-navigation-loop/issues/39) |
| Platform | Static/service delivery, shared tooling, identity, health and recovery | [#26](https://github.com/4444J99/timed-text-navigation-loop/issues/26), [#27](https://github.com/4444J99/timed-text-navigation-loop/issues/27), [#43](https://github.com/4444J99/timed-text-navigation-loop/issues/43), [#44](https://github.com/4444J99/timed-text-navigation-loop/issues/44), [#45](https://github.com/4444J99/timed-text-navigation-loop/issues/45), [#46](https://github.com/4444J99/timed-text-navigation-loop/issues/46) |
| Assurance | Source/rights custody, accessibility, technical and artistic acceptance, AI/privacy checks | [#12](https://github.com/4444J99/timed-text-navigation-loop/issues/12), [#19](https://github.com/4444J99/timed-text-navigation-loop/issues/19), [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20), [#22](https://github.com/4444J99/timed-text-navigation-loop/issues/22), [#25](https://github.com/4444J99/timed-text-navigation-loop/issues/25), [#32](https://github.com/4444J99/timed-text-navigation-loop/issues/32), [#42](https://github.com/4444J99/timed-text-navigation-loop/issues/42) |
| Commercial | Audience/offer validation, payments/entitlements, onboarding and support | [#47](https://github.com/4444J99/timed-text-navigation-loop/issues/47), [#48](https://github.com/4444J99/timed-text-navigation-loop/issues/48), [#49](https://github.com/4444J99/timed-text-navigation-loop/issues/49), [#50](https://github.com/4444J99/timed-text-navigation-loop/issues/50), [#54](https://github.com/4444J99/timed-text-navigation-loop/issues/54) |
| Corporate | Strategy, finance, agreements/vendors, people and independent governance | [#10](https://github.com/4444J99/timed-text-navigation-loop/issues/10), [#51](https://github.com/4444J99/timed-text-navigation-loop/issues/51), [#52](https://github.com/4444J99/timed-text-navigation-loop/issues/52), [#53](https://github.com/4444J99/timed-text-navigation-loop/issues/53) |

These classify responsibility, not five mandatory repositories. Company functions have process owners and systems of record; a product capability has an acceptance artifact; a repository has an independent maintained boundary.

## Seventeen-category coverage

| Capability / concern | Responsibility | Concrete artifact | GitHub work | Activation |
| --- | --- | --- | --- | --- |
| 00 Product Constitution & Governance | Product / Assurance / Corporate | Constitution, edition policy, decision record | [#10](https://github.com/4444J99/timed-text-navigation-loop/issues/10), [#13](https://github.com/4444J99/timed-text-navigation-loop/issues/13), [#53](https://github.com/4444J99/timed-text-navigation-loop/issues/53) | C0; independent governance deepens at C6 |
| 01 Core Domain / Proprietary Engine | Product | Corpus, score, encounter state, return/trace grammar | [#15](https://github.com/4444J99/timed-text-navigation-loop/issues/15), [#16](https://github.com/4444J99/timed-text-navigation-loop/issues/16), [#17](https://github.com/4444J99/timed-text-navigation-loop/issues/17), [#18](https://github.com/4444J99/timed-text-navigation-loop/issues/18), [#21](https://github.com/4444J99/timed-text-navigation-loop/issues/21), [#28](https://github.com/4444J99/timed-text-navigation-loop/issues/28), [#40](https://github.com/4444J99/timed-text-navigation-loop/issues/40) | C1 now; full edition C2; reusable engine C5 |
| 02 Product Applications & Interfaces | Product | Reader, formal studies, authoring and selected rendition surfaces | [#19](https://github.com/4444J99/timed-text-navigation-loop/issues/19), [#23](https://github.com/4444J99/timed-text-navigation-loop/issues/23), [#31](https://github.com/4444J99/timed-text-navigation-loop/issues/31), [#36](https://github.com/4444J99/timed-text-navigation-loop/issues/36), [#39](https://github.com/4444J99/timed-text-navigation-loop/issues/39), [#56](https://github.com/4444J99/timed-text-navigation-loop/issues/56) | Browser now; each further surface needs an actual use case |
| 03 APIs, SDKs & Integrations | Product / Platform | Versioned local contracts; consumer-tested adapters and SDKs | [#13](https://github.com/4444J99/timed-text-navigation-loop/issues/13), [#14](https://github.com/4444J99/timed-text-navigation-loop/issues/14), [#28](https://github.com/4444J99/timed-text-navigation-loop/issues/28), [#41](https://github.com/4444J99/timed-text-navigation-loop/issues/41) | Internal contracts now; published API/SDK at C5 demand |
| 04 Data Platform | Product / Assurance | Source IDs/provenance, session state; later persistence/schema/migrations | [#12](https://github.com/4444J99/timed-text-navigation-loop/issues/12), [#16](https://github.com/4444J99/timed-text-navigation-loop/issues/16), [#33](https://github.com/4444J99/timed-text-navigation-loop/issues/33), [#42](https://github.com/4444J99/timed-text-navigation-loop/issues/42) | Local data now; hosted custody only if state must persist |
| 05 Identity, Security & Trust | Platform / Assurance | Input/asset trust, release permissions; later identity and administration | [#25](https://github.com/4444J99/timed-text-navigation-loop/issues/25), [#43](https://github.com/4444J99/timed-text-navigation-loop/issues/43) | Trust checks early; accounts/admin only if required |
| 06 Infrastructure & Runtime | Platform | Static artifact, delivery configuration, releases and rollback | [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20), [#26](https://github.com/4444J99/timed-text-navigation-loop/issues/26), [#44](https://github.com/4444J99/timed-text-navigation-loop/issues/44) | Static browser now; service IaC when a service exists |
| 07 Reliability, Observability & Operations | Platform | Synthetic traversal, route/asset health, runbooks; later SLO/incident recovery | [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20), [#27](https://github.com/4444J99/timed-text-navigation-loop/issues/27), [#45](https://github.com/4444J99/timed-text-navigation-loop/issues/45) | Release health now; telemetry follows an operated obligation |
| 08 Quality, Testing & Evaluation | Assurance | State/browser/contracts/performance/access tests; artistic and AI evaluation | [#19](https://github.com/4444J99/timed-text-navigation-loop/issues/19), [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20), [#25](https://github.com/4444J99/timed-text-navigation-loop/issues/25), [#32](https://github.com/4444J99/timed-text-navigation-loop/issues/32), [#46](https://github.com/4444J99/timed-text-navigation-loop/issues/46), [#56](https://github.com/4444J99/timed-text-navigation-loop/issues/56) | Exact-head mechanical evidence now; deepen for changed risks |
| 09 Developer Platform & Tooling | Platform | Local setup, schemas, fixtures, release/CI standards and compatible libraries | [#13](https://github.com/4444J99/timed-text-navigation-loop/issues/13), [#28](https://github.com/4444J99/timed-text-navigation-loop/issues/28), [#31](https://github.com/4444J99/timed-text-navigation-loop/issues/31), [#46](https://github.com/4444J99/timed-text-navigation-loop/issues/46) | Project tooling now; shared tooling when consumers exist |
| 10 Billing, Entitlements & Monetization | Commercial / Product | Validated offer, pricing and fulfillment; independent entitlement policy | [#47](https://github.com/4444J99/timed-text-navigation-loop/issues/47), [#52](https://github.com/4444J99/timed-text-navigation-loop/issues/52) | C6 demand; payment does not establish authorization |
| 11 Documentation & Knowledge | Product / Platform / Commercial | Reader/author/operator guides, ADRs, API reference and release notes | [#12](https://github.com/4444J99/timed-text-navigation-loop/issues/12), [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20), [#27](https://github.com/4444J99/timed-text-navigation-loop/issues/27), [#33](https://github.com/4444J99/timed-text-navigation-loop/issues/33), [#46](https://github.com/4444J99/timed-text-navigation-loop/issues/46) | Documentation alongside code now; portal only if justified |
| 12 Growth, Analytics & Experimentation | Product / Commercial / Assurance | Decision-specific qualitative comparisons; later minimal events and experiments | [#29](https://github.com/4444J99/timed-text-navigation-loop/issues/29), [#48](https://github.com/4444J99/timed-text-navigation-loop/issues/48), [#49](https://github.com/4444J99/timed-text-navigation-loop/issues/49) | Formal studies now; instrumentation only for a real decision |
| 13 GTM / Commercial Operations | Commercial | Exhibition/education discovery, offer and delivery processes | [#38](https://github.com/4444J99/timed-text-navigation-loop/issues/38), [#47](https://github.com/4444J99/timed-text-navigation-loop/issues/47), [#49](https://github.com/4444J99/timed-text-navigation-loop/issues/49), [#54](https://github.com/4444J99/timed-text-navigation-loop/issues/54) | C6 actual audience/offer; existing systems of record |
| 14 Customer Success & Support | Commercial / Platform | Reader help; commissioned/institutional onboarding and support | [#27](https://github.com/4444J99/timed-text-navigation-loop/issues/27), [#45](https://github.com/4444J99/timed-text-navigation-loop/issues/45), [#50](https://github.com/4444J99/timed-text-navigation-loop/issues/50), [#54](https://github.com/4444J99/timed-text-navigation-loop/issues/54) | Light reader support now; obligations follow the offer |
| 15 Legal, Compliance & Corporate | Assurance / Corporate | Rights/credits now; applicable agreements/vendor/finance responsibilities | [#12](https://github.com/4444J99/timed-text-navigation-loop/issues/12), [#22](https://github.com/4444J99/timed-text-navigation-loop/issues/22), [#42](https://github.com/4444J99/timed-text-navigation-loop/issues/42), [#51](https://github.com/4444J99/timed-text-navigation-loop/issues/51), [#52](https://github.com/4444J99/timed-text-navigation-loop/issues/52) | Source/asset rights early; broader processes when applicable |
| 16 Meta / Portfolio Orchestration | Corporate / Platform | Persona boundary map, reuse contracts and repository/org decisions | [#13](https://github.com/4444J99/timed-text-navigation-loop/issues/13), [#14](https://github.com/4444J99/timed-text-navigation-loop/issues/14), [#40](https://github.com/4444J99/timed-text-navigation-loop/issues/40), [#53](https://github.com/4444J99/timed-text-navigation-loop/issues/53) | Work identity now; extraction and graduation require evidence |

## Composition and repository decisions

Enterprise → Product → Systems → Components → Repositories → Deployables → Runtime resources.

Separately: Enterprise → Commercial functions → Processes → Automation → Systems of record.

Current components—corpus/edition, score/state, renderer/reader, studies, verification and docs—remain in `timed-text-navigation-loop`. The experimental source is on `experiment/six-encounters`; its separately hosted static deployment is a deployable, not evidence that another GitHub repository or product organization is needed. Source/score/software versions and deployment identity remain separately recorded.

Prospective core/web/api/data/integrations/sdk/admin/infra/evals/docs/ops repositories are reviewed in [#13](https://github.com/4444J99/timed-text-navigation-loop/issues/13), [#40](https://github.com/4444J99/timed-text-navigation-loop/issues/40) and [#53](https://github.com/4444J99/timed-text-navigation-loop/issues/53). Extract only with a real independent lifecycle, deployment, permission, ownership, reusable artifact or distinct maintained concern, plus a named maintainer, actual consumer, versioned contract, compatible releases, checks, migration and rollback. A shared library needs at least two real consumers. Accounts, persistence and distributed telemetry are conditional, and reusable local libraries can ship without them. Organization graduation additionally needs sustained independent operating ownership, governance/access requirements and maintenance capacity.

## Creative research and Persona boundaries

The supplied *Text, Color, Type, and Geometry* genealogy supplies methods: spatial syntax, relational color, attention through type, restricted geometry, transparency/legibility, instructions, public address and bodily participation. Each adopted method requires a working mechanism, controlled comparison, recorded configuration and artist decision. The existing color study has no selected winner; inferred meanings are hypotheses, not observed reader responses. [#12](https://github.com/4444J99/timed-text-navigation-loop/issues/12) and [#22](https://github.com/4444J99/timed-text-navigation-loop/issues/22) reconcile selected report citation markers with stable primary/artist/institutional records before independent scholarly claims.

Hole-loop owns its corpus, chamber semantics, return/trace grammar and editions. SIMVLTANEA owns simultaneous independent video loops; PORTVS connects/incubates distinct leaves. Glyph Cascade rendering, Media Ark custody, audio production and time/calibration capabilities are candidates for bounded reuse through [#14](https://github.com/4444J99/timed-text-navigation-loop/issues/14), subject to actual build/contract checks. Sibling identity or similar naming does not establish an integration or runtime owner. Research output, source custody, exhibition gateway and artwork stay separately governed.

## Evidence, priority and completion

Immediate work is [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20) preview/artist/real-device review, [#19](https://github.com/4444J99/timed-text-navigation-loop/issues/19) accessibility evidence and [#13](https://github.com/4444J99/timed-text-navigation-loop/issues/13) maintained composition ownership. Source-specific experiments and typography follow at [#21](https://github.com/4444J99/timed-text-navigation-loop/issues/21) / [#23](https://github.com/4444J99/timed-text-navigation-loop/issues/23); broader platform/company work activates only when its trigger is demonstrated.

Planned, implemented, technically verified, deployed, merged and artist-reviewed are independent states. The C1 implementation and study mechanics are verified and privately deployed; the wider C1 artistic/accessibility/recovery gate is still open. [#56](https://github.com/4444J99/timed-text-navigation-loop/issues/56) / [#57](https://github.com/4444J99/timed-text-navigation-loop/issues/57) closed only their bounded mechanical deliverables. Checkbox completion requires linked evidence at a specific edition/commit. Ordinary GitHub issues with linked task lists provide the hierarchy; native sub-issue/type/milestone metadata is not claimed.

\n