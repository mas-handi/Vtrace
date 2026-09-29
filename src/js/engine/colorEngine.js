/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Color Engine (Tahap 1: Palet Warna)
 * 
 * Purpose: Advanced LAB-space color clustering and anti-aliasing quantization.
 */

export class ColorEngine {
  /**
   * Quantizes the image data into strict dominant color clusters in LAB space,
   * assigning anti-aliasing pixels to their dominant neighbors.
   * 
   * @param {ImageData} imageData 
   * @param {number} deltaEThreshold - Dynamic threshold for merging colors
   * @returns {Object} { quantizedData, palette }
   */
  static extractAndQuantize(imageData, deltaEThreshold = 5.0) {
    console.log("UIVRE: Starting LAB Color Clustering (Tahap 1)...");
    const { width, height, data } = imageData;
    const totalPixels = width * height;

    // Output array
    const qData = new Uint8ClampedArray(data.length);
    
    // We will use a fast 16-bit quantization to build an initial histogram
    // then merge in LAB space.
    const histogram = new Map();
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] === 0) continue; // Skip fully transparent
      
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Quantize to 5 bits per channel for initial grouping (fast histogram)
      const key = ((r & 0xF8) << 16) | ((g & 0xF8) << 8) | (b & 0xF8);
      const count = histogram.get(key) || { r:0, g:0, b:0, count:0 };
      count.r += r;
      count.g += g;
      count.b += b;
      count.count += 1;
      histogram.set(key, count);
    }

    // Compute average color for each initial bin and convert to LAB
    let clusters = [];
    for (const [key, val] of histogram.entries()) {
      // Filter out tiny noise bins (anti-aliasing) to find TRUE DOMINANT cores
      // Minimum core size: 0.05% of non-transparent pixels (adaptive)
      if (val.count > (totalPixels * 0.0005)) {
        const avgR = val.r / val.count;
        const avgG = val.g / val.count;
        const avgB = val.b / val.count;
        const lab = this.rgbToLab(avgR, avgG, avgB);
        clusters.push({ r: avgR, g: avgG, b: avgB, lab: lab, count: val.count });
      }
    }

    // Sort clusters by prominence
    clusters.sort((a, b) => b.count - a.count);

    // Merge similar clusters using Delta E (CIE76 for speed)
    const finalClusters = [];
    for (const cluster of clusters) {
      let merged = false;
      for (const fc of finalClusters) {
        const dE = this.deltaE(cluster.lab, fc.lab);
        if (dE < deltaEThreshold) {
          // Merge into existing cluster (weighted average)
          const total = fc.count + cluster.count;
          fc.r = (fc.r * fc.count + cluster.r * cluster.count) / total;
          fc.g = (fc.g * fc.count + cluster.g * cluster.count) / total;
          fc.b = (fc.b * fc.count + cluster.b * cluster.count) / total;
          fc.lab = this.rgbToLab(fc.r, fc.g, fc.b);
          fc.count = total;
          merged = true;
          break;
        }
      }
      if (!merged) finalClusters.push(cluster);
    }

    console.log(`UIVRE: Extracted ${finalClusters.length} dominant colors.`);

    // 2nd Pass: Assign EVERY pixel to the nearest Final Cluster using LAB distance
    // This forcibly snaps anti-aliasing halos to the nearest solid dominant color
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] === 0) {
        qData[i] = 0; qData[i+1] = 0; qData[i+2] = 0; qData[i+3] = 0;
        continue;
      }
      
      const r = data[i], g = data[i+1], b = data[i+2];
      const pLab = this.rgbToLab(r, g, b);
      
      let bestCluster = finalClusters[0];
      let minDE = Infinity;
      
      for (const fc of finalClusters) {
        const dE = this.deltaE(pLab, fc.lab);
        if (dE < minDE) {
          minDE = dE;
          bestCluster = fc;
        }
      }
      
      // Assign strictly
      qData[i] = bestCluster.r;
      qData[i+1] = bestCluster.g;
      qData[i+2] = bestCluster.b;
      qData[i+3] = data[i+3]; // Preserve original alpha (for now)
    }

    return {
      quantizedImageData: new ImageData(qData, width, height),
      palette: finalClusters
    };
  }

  // --- Fast Color Space Math ---
  static rgbToLab(r, g, b) {
    let r_ = r / 255, g_ = g / 255, b_ = b / 255;
    r_ = (r_ > 0.04045) ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
    g_ = (g_ > 0.04045) ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
    b_ = (b_ > 0.04045) ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;
    const x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) * 100;
    const y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) * 100;
    const z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) * 100;
    let x_ = x / 95.047, y_ = y / 100.000, z_ = z / 108.883;
    x_ = (x_ > 0.008856) ? Math.pow(x_, 1/3) : (7.787 * x_) + (16 / 116);
    y_ = (y_ > 0.008856) ? Math.pow(y_, 1/3) : (7.787 * y_) + (16 / 116);
    z_ = (z_ > 0.008856) ? Math.pow(z_, 1/3) : (7.787 * z_) + (16 / 116);
    return {
      L: (116 * y_) - 16,
      a: 500 * (x_ - y_),
      b: 200 * (y_ - z_)
    };
  }

  // Fast CIE76 delta E (Euclidean distance in LAB space)
  static deltaE(lab1, lab2) {
    return Math.sqrt(
      Math.pow(lab1.L - lab2.L, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2)
    );
  }
}
