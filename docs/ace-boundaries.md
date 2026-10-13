# ACE identities and timed navigation

`ace-manifest.json` is this implementation's typed descriptor. The coordinating system is `audiovisual-composition-system`; this software's functional identity is `timed-text-navigation-loop`, tied to GitHub repository ID `1409411055`. Repository slugs and artwork titles can change without replacing that identity.

| Entity | Current authority | Responsibility |
| --- | --- | --- |
| Software | `ace-manifest.json:software` | Configured text encounter navigation and eligible exposure timing |
| Capability | `timed-navigation` | Session transitions, bounded traces and exposure clock |
| Module | `experimental/six-encounters/engine.js` | `ACETimedNavigation.Session` and `ACETimedNavigation.ExposureClock` |
| Composition | `experimental/six-encounters/` | Authored content, layout, routing, character cells, effects, studies and score |
| Artwork | `g-p-6ab7e5f7ede88191903fcf8149f1b11e` | Artistic title `hole-loop`, with retained LOOPHOLE/labyrinth aliases |
| Source evidence | Existing `experimental/six-encounters/docs/PROVENANCE.md` and source census | Existing source references and observations retain their own authority |

The scheduler already takes a score and injected clock. Its new functional browser name is `ACETimedNavigation`; the original `HLEngine` remains an exact alias to the same object. `require('./engine.js')` still exports the same constructors. The application uses the functional name. A second score can use arbitrary encounter identifiers without loading `HLContent`, `HLScore`, the renderer, or the artwork's authored language.

The canonical module entry remains `engine.js`: its filename already describes its function and existing browser, CommonJS and preview paths remain valid. This is a single implementation, not a copied engine. `content.js`, `generation.js`, `render.js` and `app.js` remain composition adapters: their chamber identities, colors, geometry and artistic rules must not be advertised as generic capabilities. The containing `experimental/six-encounters` directory describes the composition and remains the established standalone serving boundary. Artwork titles remain appropriate in that composition's page title, download names and private verification-only package metadata.

No new footage identity, source location, edition or publication claim is created. Empty `source_media`, `editions` and `archives` arrays mean this descriptor has not registered those entity types; they do not assert their absence from other repository branches. Existing provenance remains in place. The experimental review preview is not treated as evidence of a published edition.

## Migration and rollback

The six-encounter implementation merged in PR #59 (`b1eeb913d0bf2678f54204cb5b49d014027ed6e8`), followed by the ACE functional identity integration in PR #61 (`dedb87e586f4dc62913d353f58177ffb12a00b19`). Both preserve the historical restoration and the active character-cell studies. The experimental experience remains separate from the restored historical runtime.

| Before | After | Compatibility |
| --- | --- | --- |
| `HLEngine.Session` | `ACETimedNavigation.Session` | `HLEngine` is an exact alias |
| `HLEngine.ExposureClock` | `ACETimedNavigation.ExposureClock` | `HLEngine` is an exact alias |
| `require('./engine.js')` | Same entry | Same exported constructors |
| Artistic repository/readme naming | Typed software and artwork identities | Title and stable artwork ID retained |

No physical source, media, composition or archive moves occur. To roll back, revert the naming-boundary commit. The caller change and alias are reverted together, while all existing artistic interfaces and pathnames continue working. Do not reset or rewrite PR #59's history.

Run `node scripts/validate-ace-manifest.mjs`, `node --test tests/ace-*.test.mjs`, and the existing pure tests with `cd experimental/six-encounters && npm test`. The new regression fixture executes a different sequence using a 250 ms eligible clock and verifies pause behavior, completion, bounded traces and the legacy alias without artwork globals. Browser and physical-device acceptance remains with the existing composition verification; metadata validation is not visual acceptance.
