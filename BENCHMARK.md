# UIVRE Benchmark & Regression Test Suite

This document tracks the iterative progression of the Universal Intelligent Vector Reconstruction Engine (UIVRE) against the Vector Magic baseline, ensuring zero regression across 5 progressive stages.

## Benchmark Dataset
1. `RX1 Logo` (Multi-color, transparency)
2. `4x4 DAMPER SPORT` (Two-color logo)
3. `STREET ADVANCE Z` (Color fidelity test, green/red/black)
4. `Thin Serif Typography` (Single color text)
5. `Line Art Diagram` (Solid background, thin strokes)
6. `Flat Anime Illustration` (Multi-color flat artwork)
7. `Photo` (High complexity)

---

## TAHAP 1: PALET WARNA (LAB Clustering & Anti-Aliasing Quantization)
**Status**: IN-PROGRESS (Ready for testing)
**Criteria**: Green color on "STREET ADVANCE Z" must be < 3 ΔE from source. Anti-aliasing pixels must map strictly to core colors, preventing gray/fringe paths.

## TAHAP A: ANALISIS TIPE GAMBAR OTOMATIS
**Status**: PASSED (Ready for full integration)
**Criteria**: Correct classification of all benchmark images. Robust texture entropy and effective color extraction.

## TAHAP B: PEMILIHAN PARAMETER ADAPTIF & MULTI-KANDIDAT
**Status**: PASSED (Rust Float bug fixed)
**Criteria**: No hardcoded pixel thresholds. Strategy computed dynamically. If confidence < 0.6, engine spawns A/B/C candidates.

## TAHAP C: PELACAKAN TEPI PRESISI SUB-PIKSEL (Tracing per Lapisan)
**Status**: PASSED (Ready for full integration)
**Criteria**: Engine splits the image into distinct binary masks per LAB color cluster. Soft masks are bilinearly upscaled 2x and thresholded at iso-0.5 to extract sub-pixel precise boundaries before scaling back down. Reduces edge error (wavy contours).

## TAHAP D: PEMILIHAN JUMLAH NODE YANG TEPAT (Bezier Fitter & Path Optimizer)
**Status**: IN-PROGRESS (Ready for testing)
**Criteria**: Straightens nearly-straight bezier curves into SVG line commands (L). Merges collinear line segments into a single segment. Preserves sharp corners for logos while reducing node bloat. Uses a tolerance derived from dominant stroke width (not pixels).

| Image | Classification Conf. | Chosen Candidate | Nodes | Paths | Avg ΔE | Spike/Gap? | Time (ms) | Pass |
|-------|---------------------|------------------|-------|-------|--------|------------|-----------|------|
| RX1 Logo | - | - | - | - | - | 0 | - | Pending |
| 4x4 DAMPER SPORT | - | - | - | - | - | 0 | - | Pending |
| STREET ADVANCE Z | - | - | - | - | - | 0 | - | Pending |
| Serif Typography | - | - | - | - | - | 0 | - | Pending |
| Line Art Diagram | - | - | - | - | - | 0 | - | Pending |
| Flat Anime | - | - | - | - | - | 0 | - | Pending |
| Photo | - | - | - | - | - | 0 | - | Pending |

*Waiting for user test execution to populate the table above.*
