/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Sub-Pixel Edge Tracking (Tahap C)
 * 
 * Purpose: Extracts ultra-precise edges by treating anti-aliasing as proportion maps 
 * (soft masks) and upscaling them before thresholding, resulting in sub-pixel boundary accuracy.
 */

export class SubpixelEdgeEngine {
  /**
   * Generates a sub-pixel precision soft mask for a target color.
   * Method: 
   * 1. Calculate color distance (ΔE approximation).
   * 2. Convert to membership probability (0.0 to 1.0).
   * 3. (Future/WASM) Perform Marching Squares at iso 0.5.
   * 4. Current JS Fallback: 2x-4x Virtual Upscaling + Thresholding.
   * 
   * @param {ImageData} imageData 
   * @param {Object} targetColor {r, g, b}
   * @param {number} scaleFactor (2 or 4)
   * @returns {ImageData} The upscaled binary mask
   */
  static extractSoftMask(imageData, targetColor, scaleFactor = 2) {
    console.log(`UIVRE Tahap C: Extracting Sub-Pixel Soft Mask for color rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b}) at ${scaleFactor}x scale`);
    
    const { width, height, data } = imageData;
    const upWidth = width * scaleFactor;
    const upHeight = height * scaleFactor;
    
    // We use a Float32Array to hold membership probabilities before thresholding
    const softMask = new Float32Array(width * height);
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] === 0) {
        softMask[i / 4] = 0.0;
        continue;
      }
      
      const r = data[i], g = data[i+1], b = data[i+2];
      
      // Fast Manhattan distance as a proxy for perceptual difference
      const dist = Math.abs(r - targetColor.r) + Math.abs(g - targetColor.g) + Math.abs(b - targetColor.b);
      
      // If color is exact, membership is 1.0.
      // If color is anti-aliased (e.g. 50% mixed), membership is proportional.
      // Maximum distance for a color to be considered part of this object's halo is ~60 (out of 765)
      if (dist === 0) {
        softMask[i / 4] = 1.0;
      } else if (dist < 60) {
        // Map distance to a 0.0 - 0.99 probability
        softMask[i / 4] = 1.0 - (dist / 60.0);
      } else {
        softMask[i / 4] = 0.0;
      }
    }

    // Allocate the upscaled high-resolution binary mask
    const upscaledData = new Uint8ClampedArray(upWidth * upHeight * 4);

    // Bilinear Interpolation Upscaling
    for (let y = 0; y < upHeight; y++) {
      for (let x = 0; x < upWidth; x++) {
        // Source coordinates (floating point)
        const srcX = x / scaleFactor;
        const srcY = y / scaleFactor;
        
        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        const x2 = Math.min(x1 + 1, width - 1);
        const y2 = Math.min(y1 + 1, height - 1);
        
        const dx = srcX - x1;
        const dy = srcY - y1;
        
        // Sample the 4 nearest neighbors in the soft mask
        const p11 = softMask[y1 * width + x1];
        const p21 = softMask[y1 * width + x2];
        const p12 = softMask[y2 * width + x1];
        const p22 = softMask[y2 * width + x2];
        
        // Bilinear interpolation
        const val = p11 * (1 - dx) * (1 - dy) + 
                    p21 * dx * (1 - dy) + 
                    p12 * (1 - dx) * dy + 
                    p22 * dx * dy;
                    
        const targetIdx = (y * upWidth + x) * 4;
        
        // Iso-level Thresholding (0.5)
        // VTracer bw mode expects WHITE background and BLACK foreground to trace.
        if (val >= 0.5) {
          upscaledData[targetIdx] = 0;                 // R (Black Foreground)
          upscaledData[targetIdx + 1] = 0;             // G
          upscaledData[targetIdx + 2] = 0;             // B
          upscaledData[targetIdx + 3] = 255;           // A
        } else {
          upscaledData[targetIdx] = 255;               // R (White Background)
          upscaledData[targetIdx + 1] = 255;           // G
          upscaledData[targetIdx + 2] = 255;           // B
          upscaledData[targetIdx + 3] = 255;           // A
        }
      }
    }

    return new ImageData(upscaledData, upWidth, upHeight);
  }
}
