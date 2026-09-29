# Universal Intelligent Vector Reconstruction Engine (UIVRE)
*Formerly SVGcode - VTracer Edition*

## 1. Core Philosophy
This engine does **NOT TRACE PIXELS**. It treats a raster image as an OBSERVATION and reconstructs the underlying visual structure. 
It asks: *What is this image? Which are edges? Which are anti-aliasing? What should become vector geometry?*

## 2. Universal Pipeline
The architecture moves away from a single-pass tracer to a multi-stage intelligent pipeline:

1. **IMAGE FORENSICS**: Analyzes resolution, alpha, color distribution, edge/texture/gradient density.
2. **IMAGE CLASSIFICATION**: Confidence-based classification (Logo, Typography, Illustration, Photo, etc.).
3. **REGION-LEVEL CLASSIFICATION**: Segments the image into regions (e.g., text, logo, shadow) and applies different vectorization strategies per region.
4. **INTELLIGENT ANALYSIS**: Includes Background, Color (Perceptual), Anti-aliasing (Sub-pixel boundary estimation), and Geometry understanding.
5. **MULTI-STRATEGY VECTORIZATION**: Routes specific regions to specific engines (VTracer, Line Fitter, Bézier Fitter, OCR-assisted Typography).
6. **SELF-CORRECTING LOOP**: Vectorize → Rasterize → Compare → Error Map → Refine.
7. **SVG GENERATION**: Outputs TRUE VECTOR (no embedded PNGs, precise nodes, valid topology).

## 3. Modular Architecture Blueprint
The monolithic pipeline will be refactored into the following modules:
- `imageAnalyzer.js` / `imageClassifier.js`
- `backgroundAnalyzer.js` / `colorAnalyzer.js`
- `edgeAnalyzer.js` / `subpixelEdge.js`
- `geometryDetector.js` / `regionSegmenter.js`
- `strategySelector.js`
- `vectorCandidate.js` / `vectorScorer.js`
- `lineFitter.js` / `bezierFitter.js` / `cornerDetector.js`
- `topologyEngine.js` / `gradientEngine.js`
- `pathOptimizer.js` / `svgOptimizer.js`
- `vectorValidator.js` / `errorAnalyzer.js` / `iterativeOptimizer.js`

## 4. Current State vs Target
**Current State (Base):**
- Unified VTracer WASM engine integrated (`src/js/orchestrate.js`, `src/js/vtracer.js`).
- Fixed camelCase config constraints and exact `Uint8Array` buffer allocations.
- UI runs on Vite dev server.

**Target State:**
- VTracer becomes just **ONE** of the initial vectorization strategies, not the final result.
- The UI will feature an `AUTO` mode that seamlessly orchestrates the Universal Pipeline.
- Introduction of an internal benchmark suite (including TEIN automotive logos, typography, photos, etc.) for regression testing.

## 6. Artifact Intelligence & Object Relevance
The engine must build an **Object Graph** to evaluate the semantic relevance of every connected component AND of every sub-structure inside a component.

- **Artifact Rejection**: Thin, geometrically inconsistent lines or compression noise must be classified as `POSSIBLE_ARTIFACT` and ignored. Artifacts are NOT required to be isolated: they may touch or overlap a primary object (e.g. streaks crossing letterforms), so detection must operate below the connected-component level.
- **Thickness-Based Detection**: Thin structures are identified relative to the dominant stroke width (`strokeW`, from the distance transform), never by fixed pixel values or by area alone. Area-based filters (e.g. filterSpeckle) cannot remove long, thin artifacts and must not be the only defense.
- **Thin-Structure Removal**: Before tracing, apply morphological opening with radius relative to `strokeW`, followed by limited reconstruction to preserve sharp corners and serifs. Remove only structures that are both elongated (high aspect ratio) and thin (max thickness << strokeW).
- **Intentional Detail vs Noise**: A thin structure is kept when it shows continuity, structural coherence, and consistency with the local design language (e.g. serifs, hairlines in typography, line art). Scale-invariance is required: a small logo with thin serifs must not be treated as noise.
- **Source Fidelity Check**: If a structure exists in the source raster with high contrast and coherent geometry, it may be intentional design (e.g. speed lines). Flag it as `AMBIGUOUS_STRUCTURE` and preserve it by default instead of deleting it.
- **Alpha Channel Awareness**: Semi-transparent pixels must be strictly used for sub-pixel boundary estimation, not rendered as checkerboard artifacts or solid blocks.
- **Partial Object Handling**: Elements cropped at the image boundaries must be treated as `PARTIAL_OBJECT`, not discarded as artifacts.

## 7. Development Rules
1. **Adaptive Engine**: No single algorithm fits all images.
2. **Do Not Trace Everything**: Understand everything first. Only vectorize meaningful visual structures.
3. **Node Optimization**: Minimum nodes for maximum accuracy.
4. **Regression Testing**: Every engine change must pass the benchmark suite.
