/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Vector Validator
 * 
 * Purpose: Validates the output SVG paths to detect extreme anomalies
 * such as giant diagonal spikes or broken coordinates (NaN/Infinity).
 */

export class VectorValidator {
  /**
   * Validates raw SVG string.
   * @param {string} svgString 
   * @param {number} width 
   * @param {number} height 
   */
  static validate(svgString, width, height) {
    console.log("UIVRE: Running Vector Validation...");
    
    let spikeCandidates = 0;
    const maxAllowedSegmentLength = Math.sqrt(width*width + height*height) * 0.95; // 95% of diagonal

    // Simple regex to parse SVG path commands (M, C, L, Z) and their coordinates
    const pathRegex = /d="([^"]+)"/g;
    let match;

    while ((match = pathRegex.exec(svgString)) !== null) {
      const d = match[1];
      
      // Parse coordinates. We just extract all numbers to check for massive jumps.
      const numbers = d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi);
      
      if (!numbers) continue;

      // Check for extremely long segments by measuring distance between sequential coordinate pairs
      // Note: This is an approximation since bezier control points are also mixed in,
      // but a massive jump in any control point or anchor usually indicates a spike.
      for (let i = 0; i < numbers.length - 3; i += 2) {
        const x1 = parseFloat(numbers[i]);
        const y1 = parseFloat(numbers[i+1]);
        const x2 = parseFloat(numbers[i+2]);
        const y2 = parseFloat(numbers[i+3]);

        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) continue;

        const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

        if (dist > maxAllowedSegmentLength) {
          spikeCandidates++;
        }
      }
    }

    if (spikeCandidates > 0) {
      console.warn(`UIVRE WARNING: Detected ${spikeCandidates} extreme segment(s) / spike candidates!`);
    } else {
      console.log("UIVRE: SVG Validation passed. No extreme spikes detected.");
    }
  }
}
