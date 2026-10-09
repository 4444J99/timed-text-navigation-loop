# Concentric assignment plan and tracker reconciliation

Governing roadmap: [#2](https://github.com/4444J99/timed-text-navigation-loop/issues/2). Its wider C0–C6 numbering differs from this assignment's four circles. The table maps the bounded assignment onto existing work; it does not relabel or discard the wider roadmap.

The initial inspection found no issues. During implementation, the broader roadmap and issues #2–#54 were created. The final tracker inventory caught them. Existing matching issues were reused and augmented with clearly bounded assignment sections. The overlapping governing issue #55 was closed as a duplicate. Only #56 (four-study epic), #57 (independent return-memory study), and #58 (new-writing gate) were added. No parallel implementation backlog was created.

| Assignment circle | Linked epic / grouping | Deliverables and dependencies | Current assignment status |
| --- | --- | --- | --- |
| 1 · Playable core | [#4](https://github.com/4444J99/timed-text-navigation-loop/issues/4), wider C1 | Versioned six-entry score; state/history [#16](https://github.com/4444J99/timed-text-navigation-loop/issues/16); clock [#18](https://github.com/4444J99/timed-text-navigation-loop/issues/18); layout/access/reading [#19](https://github.com/4444J99/timed-text-navigation-loop/issues/19). Rendering/config evidence also supports existing #15/#17. No historical merge/deployment dependency. | Implemented and locally verified |
| 2 · Studies and evaluation | [#56](https://github.com/4444J99/timed-text-navigation-loop/issues/56) | Color [#29](https://github.com/4444J99/timed-text-navigation-loop/issues/29); space [#30](https://github.com/4444J99/timed-text-navigation-loop/issues/30); time [#18](https://github.com/4444J99/timed-text-navigation-loop/issues/18); return memory [#57](https://github.com/4444J99/timed-text-navigation-loop/issues/57); evidence/evaluation [#20](https://github.com/4444J99/timed-text-navigation-loop/issues/20). Depends on bounded Circle 1 mechanics. | Implemented and locally verified; artist review awaits |
| 3 · Language and chamber behavior | [#5](https://github.com/4444J99/timed-text-navigation-loop/issues/5), wider full-edition C2 | Color adoption #29; typography/voice [#23](https://github.com/4444J99/timed-text-navigation-loop/issues/23); nine source-specific chamber proposals [#21](https://github.com/4444J99/timed-text-navigation-loop/issues/21). Depends on formal evaluation and artist/reader decisions, not a universal color claim. | Planned |
| 4 · Richer composition | [#6](https://github.com/4444J99/timed-text-navigation-loop/issues/6), with sound linked to [#7](https://github.com/4444J99/timed-text-navigation-loop/issues/7) | Writing [#58](https://github.com/4444J99/timed-text-navigation-loop/issues/58); sound [#34](https://github.com/4444J99/timed-text-navigation-loop/issues/34); richer routes [#24](https://github.com/4444J99/timed-text-navigation-loop/issues/24); optional computation/AI [#32](https://github.com/4444J99/timed-text-navigation-loop/issues/32). Each requires an earlier observed compositional need and provenance. | Planned, evidence-gated |

The complete scoped specifications and dependency keys are in `issues.json`, with actual tracker numbers and URLs. Each body identifies experience/problem, concrete deliverable, dependencies, scope, acceptance, expected evidence, priority and completion state. Multiple scoped deliverables can map to one existing issue; this is intentional reuse. A completed bounded assignment deliverable does not close a broader issue that also requires full-corpus rendering, artist acceptance, WCAG audit, public release or other assurance work.

All existing source-custody and release requirements remain represented in the wider plan. For this assignment, the supplied exact texts and inspected read-only census are sufficient input; historical extraction, import, repair, publication and old-edition approval are excluded. No new edition task depends on #1 or completion of the historical release issue #11.

## Circle 3 chamber questions

The full source/path/revision table, nine proposed behaviors and individual questions are in the scoped **remaining** item in `issues.json`, and appended to #21. Source text nodes and hashes are in `source-census.json`. Dialogue, refusal, interruption, confinement and release are proposed distinct functions. Their prototypes are not implemented in this edition.

## Circle 4 evidence gates

| Addition | Earlier evidence required |
| --- | --- |
| New writing | Artist review identifies a function existing language cannot perform. |
| Sound | A timing/history relationship remains insufficiently perceptible through current text and geometry. Define a specific function and a silent equivalent. |
| Route relationships | Chamber comparisons identify particular language relationships the deterministic route fails to express. |
| Computation / AI | An artist-reviewed question requires a transformation that a fixed score or simpler deterministic rule cannot adequately test. Record inputs, constraints, versions, output provenance and failure limits. |

No capability automatically becomes a repository. Split only with demonstrated independent ownership, reuse or deployment, a real consumer, a compatibility contract and maintenance responsibility.

## Evidence and states

Runtime, four instruments and local verification are complete for Circles 1 and 2. The evaluation changed baseline phrase-cell sizing to eliminate a font-dependent gutter. Color adoption has no winner. Artist-reviewed: **no**. Deployed: **no**. Merge: **not claimed by this plan**. Optional external observations: **not collected**. Desktop/mobile refers to Linux Chromium viewport runs, not physical-device certification. GitHub CI is prepared separately from the passing local evidence.
