# Rendition outputs and where they live

## Seed 45, four encounters (2026-11-16)

Produced with `node export-rendition.cjs --seed 45 --encounters 4 --out <dir>` and checked with `node verify-rendition.cjs --dir <dir>` on ffmpeg 9.0.2: every check passed (min luma PSNR 37.8 dB, min block 27.43 dB, min chroma 39.44 dB, tone ratio 0.941, 167 frames, 13.954 s).

- `rendition.mp4` SHA-256 `e4874e394c42c05e8d2e6225847baa67fb5bdbe380d1cebf5aa305b687fb5f9b`; raw frame stream SHA-256 `0d28d0b434a021c58440157b19b3ced6898f2472c23a9e1b5190c3595f2a9163` (reproducible for the seed).
- Durable home: Google Drive `gdrive:Projects/timed-text-navigation-loop/rendition-seed45-4enc-20261116/` (`rendition.mp4`, `cue-track.wav`, `captions.vtt`, `receipt.json`).
- It is the schematic rendition the README describes, not a capture of the browser artwork, and claims no artist, accessibility, device or audience acceptance.
