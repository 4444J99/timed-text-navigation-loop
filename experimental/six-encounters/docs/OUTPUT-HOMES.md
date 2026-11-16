# Rendition outputs and where they live

## Seed 45, four encounters (2026-11-16)

Produced with `node export-rendition.cjs --seed 45 --encounters 4 --out <dir>` and checked with `node verify-rendition.cjs --dir <dir>` on ffmpeg 9.0.2: every check passed (min luma PSNR 37.8 dB, min block 27.43 dB, min chroma 39.44 dB, tone ratio 0.941, 167 frames, 13.954 s).

- `rendition.mp4` SHA-256 `e4874e394c42c05e8d2e6225847baa67fb5bdbe380d1cebf5aa305b687fb5f9b`; raw frame stream SHA-256 `0d28d0b434a021c58440157b19b3ced6898f2472c23a9e1b5190c3595f2a9163` (reproducible for the seed).
- Durable home: Google Drive `gdrive:Projects/timed-text-navigation-loop/rendition-seed45-4enc-20261116/` (`rendition.mp4`, `cue-track.wav`, `captions.vtt`, `receipt.json`).
- It is the schematic rendition the README describes, not a capture of the browser artwork, and claims no artist, accessibility, device or audience acceptance.

## Browser-artwork capture, seed 45, four encounters (2026-11-16)

Produced with `node capture-rendition.cjs --seed 45 --encounters 4 --fps 12 --width 960 --height 540 --out <dir>` and checked with `node verify-capture.cjs --dir <dir> --recapture` on ffmpeg 9.0.2 and Chromium 143.0.7499.4 (headless shell): every check passed, including the recapture, which gave the same timeline, the same frames (PNG digest chain `f57ca1ec00ddbeaaaa4ab9584af40540e363581e24fadf27f5c34d0a6d15b8b2`), cue track and captions. 155 frames, 12.944 s, 960x540 at 12 fps.

- `capture.mp4` SHA-256 `73acca9b1204d291d8bcb8b70affb8d0e172f88d172fe72d4abb906058d15b6c` (this ffmpeg and libx264 build only); `cue-track.wav` `5283ef259d4b302db9a3dc343f2a5fc4eefcff022ee1f2b3ef44fb3dd73e2e5c`; `captions.vtt` `d3a6cc01f762954ecfdeecc51d90eebeab8ebcf87d5e197068aed6d920d983d2`; `receipt.json` `40899024059b1b0554691262b4dc9fcdc2bbecd8deb5d4ba58ef0673bf21e3cb`.
- Durable home: Google Drive `gdrive:Projects/timed-text-navigation-loop/capture-seed45-4enc-20261116/` (`capture.mp4`, `cue-track.wav`, `captions.vtt`, `receipt.json`), copied with `rclone copy` and checked with `rclone check` (4 matching files).
- It is the real artwork driven by a reader who always follows a word, with a plain-tone cue track, not a performance and not a composed score; it claims no artist, accessibility, device or audience acceptance. The artwork revision it filmed is named by the file digests in `receipt.json`.
