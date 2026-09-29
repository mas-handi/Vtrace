/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Mathematical Morphology Engine
 * 
 * Purpose: Applies advanced morphological operations (Erosion, Dilation, Opening,
 * Distance Transform, and Geodesic Reconstruction) to clean up artifacts based on 
 * structural thickness analysis, without destroying valid sharp corners or serifs.
 */

export class MorphologyEngine {
  
  /**
   * Applies the adaptive morphological cleaning algorithm.
   * 1. Distance Transform -> Median Thickness
   * 2. Morphological Opening (relative radius)
   * 3. Geodesic Reconstruction
   * 
   * @param {Uint8Array} mask - Binary mask array (width * height) where 1 is foreground
   * @param {number} width 
   * @param {number} height 
   * @returns {Uint8Array} Cleaned binary mask
   */
  static cleanArtifacts(mask, width, height) {
    console.log("UIVRE: Running Morphological Artifact Cleaning...");

    // Step 1: Compute Distance Transform (Manhattan approximation for speed)
    const dt = this.distanceTransform(mask, width, height);
    
    // Step 2: Find typical stroke width (median of local maxima)
    const strokeW = this.estimateStrokeWidth(dt, width, height);
    console.log("UIVRE: Estimated Typical Stroke Width:", strokeW);

    // Step 3: Morphological Opening with relative radius
    // We use a minimum radius of 2 or 15% of the stroke width
    const r = Math.max(2, Math.round(strokeW * 0.15));
    
    // Opening = Dilation(Erosion(Mask))
    // This destroys thin random artifacts that are smaller than radius 'r'
    const eroded = this.erode(mask, width, height, r);
    const opened = this.dilate(eroded, width, height, r);

    // Step 4: Geodesic Reconstruction
    // Recovers valid sharp corners/serifs lost during the opening step.
    // We dilate the 'opened' image but constrain it strictly within the original 'mask'.
    const cleaned = this.reconstruct(opened, mask, width, height, 2);

    return cleaned;
  }

  static distanceTransform(mask, width, height) {
    const dt = new Float32Array(width * height);
    const INF = width + height;
    
    // Initialize
    for (let i = 0; i < dt.length; i++) {
      dt[i] = mask[i] === 1 ? INF : 0;
    }

    // Pass 1: Top-Left to Bottom-Right
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (dt[i] > 0) {
          dt[i] = Math.min(
            dt[i],
            dt[i - 1] + 1,           // Left
            dt[i - width] + 1        // Top
          );
        }
      }
    }

    // Pass 2: Bottom-Right to Top-Left
    for (let y = height - 2; y >= 0; y--) {
      for (let x = width - 2; x >= 0; x--) {
        const i = y * width + x;
        if (dt[i] > 0) {
          dt[i] = Math.min(
            dt[i],
            dt[i + 1] + 1,           // Right
            dt[i + width] + 1        // Bottom
          );
        }
      }
    }

    return dt;
  }

  static estimateStrokeWidth(dt, width, height) {
    const maxima = [];
    // Fast local maxima detection
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const i = y * width + x;
        const val = dt[i];
        if (val > 0 && 
            val >= dt[i - 1] && val >= dt[i + 1] &&
            val >= dt[i - width] && val >= dt[i + width]) {
          maxima.push(val);
        }
      }
    }
    
    if (maxima.length === 0) return 2;
    
    // Median of local maxima
    maxima.sort((a, b) => a - b);
    return maxima[Math.floor(maxima.length / 2)] * 2; // multiply by 2 for full diameter
  }

  static erode(mask, width, height, radius) {
    const output = new Uint8Array(width * height);
    // Simplified fast-box erosion
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let keep = true;
        // Check local neighborhood
        for (let dy = -radius; dy <= radius && keep; dy++) {
          for (let dx = -radius; dx <= radius && keep; dx++) {
            if (mask[(y + dy) * width + (x + dx)] === 0) {
              keep = false;
            }
          }
        }
        output[y * width + x] = keep ? 1 : 0;
      }
    }
    return output;
  }

  static dilate(mask, width, height, radius) {
    const output = new Uint8Array(width * height);
    // Simplified fast-box dilation
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        if (mask[y * width + x] === 1) {
          // Spread to neighborhood
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              output[(y + dy) * width + (x + dx)] = 1;
            }
          }
        }
      }
    }
    return output;
  }

  static reconstruct(marker, mask, width, height, iterations) {
    let current = new Uint8Array(marker);
    let next = new Uint8Array(width * height);
    
    for (let iter = 0; iter < iterations; iter++) {
      // Dilation step of the marker
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          if (current[i] === 1) {
            next[i] = 1;
            next[i - 1] = 1;
            next[i + 1] = 1;
            next[i - width] = 1;
            next[i + width] = 1;
          }
        }
      }
      
      // Point-wise minimum (constraint by original mask)
      let changed = false;
      for (let i = 0; i < current.length; i++) {
        const val = (next[i] === 1 && mask[i] === 1) ? 1 : 0;
        if (current[i] !== val) changed = true;
        current[i] = val;
      }
      
      if (!changed) break; // Convergence
    }
    
    return current;
  }
}
