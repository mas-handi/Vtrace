/**
 * SVGcode—Convert raster images to SVG vector graphics
 * Copyright (C) 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import {
  preProcessMainCanvas,
  preProcessInputImage,
  supportsOffscreenCanvas,
} from './preprocess.js';
import { colorRadio, svgOutput } from './domrefs.js';
import { convertToMonochromeSVG } from './monochrome.js';
import { convertToColorSVG, intervalID } from './color.js';
import { showToast, MONOCHROME, COLOR } from './ui.js';
import { i18n } from './i18n.js';

import spinnerSVG from '/spinner.svg?raw';

const readableSize = (size) => {
  if (size === 0) return '0B';
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, i)).toFixed(2) * 1} ${['B', 'KB', 'MB'][i]}`;
};

const displayResult = (svg, className) => {
  if (!svg) {
    return;
  }
  // Remove `width` and `height` attributes to prevent browser clipping, relying on viewBox
  svg = svg
    .replace(/\s+width="\d+(?:\.\d+)?"/, '')
    .replace(/\s+height="\d+(?:\.\d+)?"/, '');
  svgOutput.classList.remove(COLOR);
  svgOutput.classList.remove(MONOCHROME);
  svgOutput.classList.add(className);
  svgOutput.innerHTML = svg;
  showToast(`${i18n.t('svgSize')}: ${readableSize(svg.length)}`, 3000);
};

import { initVTracer, vectorize_rgba } from './vtracer.js';
import { ImageAnalyzer } from './engine/imageAnalyzer.js';
import { ImageClassifier } from './engine/imageClassifier.js';
import { RegionSegmenter } from './engine/regionSegmenter.js';
import { VectorValidator } from './engine/vectorValidator.js';
import { ColorEngine } from './engine/colorEngine.js';
import { SubpixelEdgeEngine } from './engine/subpixelEdge.js';
import { StrategySelector } from './engine/strategySelector.js';
import { VectorCandidate } from './engine/vectorCandidate.js';
import { VectorScorer } from './engine/vectorScorer.js';
import { PathOptimizer } from './engine/pathOptimizer.js';

let vtracerReady = false;

const startProcessing = async () => {
  svgOutput.innerHTML = '';
  svgOutput.classList.remove(COLOR, MONOCHROME);
  if (intervalID.current) {
    clearInterval(intervalID.current);
    intervalID.current = null;
  }
  const transform = svgOutput.getAttribute('transform');
  svgOutput.innerHTML = spinnerSVG;
  if (transform) {
    svgOutput.dataset.transform = transform;
    svgOutput.setAttribute('transform', '');
  }
  
  // Ensure VTracer is loaded
  if (!vtracerReady) {
    await initVTracer();
    vtracerReady = true;
  }

  let imageData = supportsOffscreenCanvas
    ? await preProcessInputImage()
    : preProcessMainCanvas();

  // ---------------------------------------------------------
  // UIVRE (Universal Intelligent Vector Reconstruction Engine)
  // Tahap A: Analisis Tipe Gambar & Ekstraksi Fitur
  // ---------------------------------------------------------
  const profile = ImageAnalyzer.analyze(imageData);
  const classification = ImageClassifier.classify(profile);
  
  // Object Graph & Artifact Intelligence
  const objectGraph = RegionSegmenter.segment(imageData);
  const artifacts = objectGraph.getArtifacts();
  const validObjects = objectGraph.getValidObjects();
  
  console.log("=== UIVRE OBSERVATION ===");
  console.log("Profile:", profile);
  console.log("Classification:", classification);
  console.log("Object Graph:", {
    totalObjects: objectGraph.objects.length,
    validObjects: validObjects.length,
    artifactsDetected: artifacts.length
  });
  console.log("=========================");

  // Tahap B: Pemilihan Parameter (Adaptive Strategy Selection)
  // Dynamic parameters computed entirely from image properties, not hardcoded.
  let config = StrategySelector.select(profile, classification);

  // Fallback: If we detected a lot of noise artifacts, tell VTracer to be more aggressive
  if (artifacts.length > validObjects.length * 2) {
    config.filterSpeckle += 4;
    console.log("UIVRE Action: High artifact density detected. Increasing filterSpeckle to", config.filterSpeckle);
  }

  let palette = [];
  
  // Clone original image data to preserve anti-aliasing for Tahap C
  const originalImageData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  // Step 1.8: Color Palette Quantization (Tahap 1)
  // We quantize colors in LAB space for flat artworks/logos to eliminate anti-aliasing gray halos
  if (colorRadio.checked && classification.dominantType !== 'photo') {
    // Dynamic deltaE threshold: smaller for complex images, larger for simple logos
    const deltaE = classification.dominantType === 'logo' ? 12.0 : 6.0;
    const result = ColorEngine.extractAndQuantize(imageData, deltaE);
    imageData = result.quantizedImageData;
    palette = result.palette;
    console.log("UIVRE Action: Applied LAB Color Quantization. Final Palette:", palette);
  }



  try {
    let rawSvg;
    
    // Tahap C & Tahap 2: Tracing Per Lapisan (Sub-Pixel Edge Tracking)
    // If a palette exists (from Tahap 1), we trace each color as an isolated sub-pixel mask.
    if (typeof palette !== 'undefined' && palette.length > 0) {
      console.log("UIVRE: Executing Multi-Layer Sub-Pixel Tracing (Tahap C)...");
      let combinedPaths = '';
      const scaleF = 2; // 2x sub-pixel upscaling

      // Temporarily override VTracer config to trace solid binary masks.
      // We must scale the spatial thresholds because the mask is 2x larger!
      const layerConfig = { 
        ...config, 
        preset: 'bw', 
        clustering: 'bw',
        lengthThreshold: config.lengthThreshold * scaleF,
        filterSpeckle: config.filterSpeckle * (scaleF * scaleF) // Area scales quadratically
      };

      for (const color of palette) {
        const subPixelMask = SubpixelEdgeEngine.extractSoftMask(originalImageData, color, scaleF);
        
        const layerSvg = vectorize_rgba(
          new Uint8Array(subPixelMask.data), 
          subPixelMask.width, 
          subPixelMask.height, 
          layerConfig
        );
        
        // Extract the <path> elements from VTracer's output
        const pathsMatch = layerSvg.match(/<path[^>]+>/g);
        if (pathsMatch) {
          // TAHAP D: Path Optimization (Straighten Beziers & Merge Collinear Lines)
          const optimizedPaths = pathsMatch.map(p => {
             const dMatch = p.match(/d="([^"]+)"/);
             if (dMatch) {
               // Tolerance: scaleF * 1.5 (allows flattening bumps up to 1.5 pixels deep in the original space)
               const optD = PathOptimizer.optimize(dMatch[1], scaleF * 1.5); 
               return p.replace(`d="${dMatch[1]}"`, `d="${optD}"`);
             }
             return p;
          });

          // Wrap paths in a scaling group and color them
          const hex = `#${((1<<24) + (Math.round(color.r)<<16) + (Math.round(color.g)<<8) + Math.round(color.b)).toString(16).slice(1)}`;
          combinedPaths += `\n<g fill="${hex}" transform="scale(${1.0 / scaleF})">\n  ${optimizedPaths.join('\n  ')}\n</g>`;
        }
      }

      rawSvg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}">${combinedPaths}\n</svg>`;
      
    } else if (classification.confidence < 0.6) {
      console.log("UIVRE: Low classification confidence. Spawning multi-candidates...");
      const candidates = VectorCandidate.generateCandidates(config);
      let bestCandidate = null;
      let bestScore = Infinity;

      for (const cand of candidates) {
        const tempSvg = vectorize_rgba(
          new Uint8Array(imageData.data), 
          imageData.width, 
          imageData.height, 
          cand.config
        );
        const { score } = await VectorScorer.scoreCandidate(tempSvg, imageData);
        console.log(`Candidate ${cand.id} Score: ${score.toFixed(2)}`);
        if (score < bestScore) {
          bestScore = score;
          bestCandidate = cand;
          rawSvg = tempSvg;
        }
      }
      console.log("UIVRE: Selected candidate", bestCandidate.id);
    } else {
      rawSvg = vectorize_rgba(
        new Uint8Array(imageData.data), 
        imageData.width, 
        imageData.height, 
        config
      );
      
      // TAHAP D: Path Optimization (Fallback)
      const pathsMatch = rawSvg.match(/<path[^>]+>/g);
      if (pathsMatch) {
         pathsMatch.forEach(p => {
           const dMatch = p.match(/d="([^"]+)"/);
           if (dMatch) {
             const optD = PathOptimizer.optimize(dMatch[1], 1.5);
             rawSvg = rawSvg.replace(dMatch[1], optD);
           }
         });
      }
    }
    
    // Step 3: Self-Validation Engine
    VectorValidator.validate(rawSvg, imageData.width, imageData.height);

    // VTracer outputs <svg width="W" height="H"> but no viewBox.
    // SVGcode strips width/height, which causes the browser to default to 300x150 (cropping the image).
    // We must inject the viewBox attribute manually.
    rawSvg = rawSvg.replace(
      /<svg([^>]+)>/, 
      `<svg$1 viewBox="0 0 ${imageData.width} ${imageData.height}">`
    );
    
    if (transform) {
      svgOutput.setAttribute('transform', transform);
    }
    
    displayResult(rawSvg, colorRadio.checked ? COLOR : MONOCHROME);
  } catch (err) {
    console.error('VTracer error:', err);
    svgOutput.innerHTML = '<text x="10" y="20" fill="red">Error processing image</text>';
  }
};

export { startProcessing };
