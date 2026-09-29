/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Image Forensics & Analyzer
 * 
 * Purpose: Treat the raster image as an OBSERVATION. 
 * Compute fundamental metrics (edge density, color complexity, transparency, etc.)
 * before deciding how to vectorize.
 */

export class ImageAnalyzer {
  /**
   * Performs full forensic analysis on the image data.
   * @param {ImageData} imageData 
   * @returns {Object} ImageProfile
   */
  static analyze(imageData) {
    const { width, height, data } = imageData;
    const totalPixels = width * height;

    let transparentPixels = 0;
    const colorSet = new Set();
    let edgePixelCount = 0;

    // Fast pass: analyze colors, transparency, and simple gradients
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];

      if (a < 255) {
        transparentPixels++;
      }

      // Quantize colors slightly to avoid counting anti-aliasing as infinite colors
      // Quantize by 8 (5 bits per channel)
      if (a > 0) {
        const qR = r & 0xF8;
        const qG = g & 0xF8;
        const qB = b & 0xF8;
        colorSet.add(`${qR},${qG},${qB}`);
      }
    }

    // Edge Density Pass (Adaptive Sobel/Laplacian approximation)
    // First pass: compute average intensity to derive dynamic threshold
    let totalIntensity = 0;
    let sampledPixels = 0;
    const stride = width * 4;
    
    for (let y = 1; y < height - 1; y += 4) {
      for (let x = 1; x < width - 1; x += 4) {
        const idx = (y * width + x) * 4;
        totalIntensity += (data[idx] + data[idx+1] + data[idx+2]) / 3;
        sampledPixels++;
      }
    }
    const avgIntensity = totalIntensity / sampledPixels;
    // Dynamic edge threshold based on average brightness (darker images need lower threshold)
    const edgeThreshold = Math.max(15, avgIntensity * 0.25);

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const current = (data[idx] + data[idx+1] + data[idx+2]) / 3;
        const right = (data[idx+4] + data[idx+5] + data[idx+6]) / 3;
        const bottom = (data[idx+stride] + data[idx+stride+1] + data[idx+stride+2]) / 3;

        const diffX = Math.abs(current - right);
        const diffY = Math.abs(current - bottom);

        if (diffX > edgeThreshold || diffY > edgeThreshold) {
          edgePixelCount++;
        }
      }
    }

    const transparencyRatio = transparentPixels / totalPixels;

    // Texture Entropy Pass (Shannon Entropy on grayscale)
    const histogramGray = new Array(256).fill(0);
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        const gray = Math.floor((data[idx] + data[idx+1] + data[idx+2]) / 3);
        histogramGray[gray]++;
      }
    }
    let entropy = 0;
    const sampleSize = (width/2) * (height/2);
    for (let i = 0; i < 256; i++) {
      const p = histogramGray[i] / sampleSize;
      if (p > 0) entropy -= p * Math.log2(p);
    }

    // Effective colors (merged AA)
    // We assume the ColorEngine will crush anti-aliasing, so effective colors is roughly log2 of unique quantized colors
    const effectiveColors = Math.max(1, Math.floor(Math.log2(colorSet.size + 1)));

    const profile = {
      resolution: { width, height, totalPixels },
      transparency: {
        hasTransparency: transparencyRatio > 0.01,
        ratio: transparencyRatio
      },
      color: {
        uniqueColorsQuantized: colorSet.size,
        effectiveColors: effectiveColors,
        complexity: effectiveColors > 10 ? "high" : "low"
      },
      edges: {
        density: edgePixelCount / (totalPixels / 4),
      },
      texture: {
        entropy: entropy // 0.0 to ~8.0
      },
      geometryDensity: edgePixelCount / (totalPixels / 4) > 0.1 ? "high" : "low",
      gradientDensity: entropy > 5.0 ? "high" : "low"
    };

    console.log("UIVRE Tahap A: Image Profile Extracted", profile);
    return profile;
  }
}
