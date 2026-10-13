# Working on hole-loop

This repository currently preserves the 2017 edition as a working standalone artwork. The authoritative source reference and all decisions are in `provenance/source-manifest.json` and `README.md`.

## Boundaries

- Treat `provenance/original-2017/` as immutable source evidence. Preserve its bytes and names. New historical evidence belongs in a separately identified source record.
- The complete artwork runtime is `public/`. It must open through `file://`, HTTP at a domain root, and HTTP under a subdirectory without external network dependencies.
- Preserve the edition's text, titles, color treatments, typography declarations, spatial arrangements, and load-based timers unless the user requests artistic development.
- The project discussion's proposed visit memory, traces, new routing scores, sound, and transformations are future editions. Their development must not be mistaken for historical restoration.
- Keep all twelve chambers reachable. Every entrance link must work through native keyboard and pointer activation.
- Do not apply absent historical styles or activate dormant image candidates without identifying that change as a reconstruction or new artistic decision.
- Keep upstream vendor bytes and licenses intact. A dependency update needs explicit review of its effect on the preserved rendering.

## Verification

Run `python3 scripts/verify.py` for source integrity, dependency closure, routes, and preserved markup/timing. Follow `tests/README.md` for real-browser rendering and navigation verification. The browser tests compare against inert preserved originals served through a local reference adapter.

Keep verification claims tied to the actual browser and font environment tested. A same-environment pixel match does not prove identical behavior on an untested device or a recovered live 2017 deployment.

## Repository history

`source/2017-07-20` marks the source-preservation commit of this bounded extraction. It is not the full parent ETCETER4 repository. The upstream historical commit remains `7f4e5f9610701cd1cb7e398f0b66a6e26c8d35e0`.

The source repository is an upstream reference only. Do not modify it while working on this independent repository.
