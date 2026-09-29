/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Vector Candidate
 * 
 * Purpose: Spawns multiple parameter strategies when classification confidence is low.
 */

export class VectorCandidate {
  /**
   * Generates alternative parameter candidates based on base strategy.
   * @param {Object} baseStrategy 
   * @param {string} mode - 'safe', 'sharp', 'smooth'
   * @returns {Array<Object>} List of candidate configurations
   */
  static generateCandidates(baseStrategy) {
    const candidates = [];
    
    // Candidate A: The computed base strategy
    candidates.push({
      id: 'A_BASE',
      config: { ...baseStrategy }
    });

    // Candidate B: Sharp geometry (prioritizes straight lines and corners)
    candidates.push({
      id: 'B_SHARP',
      config: {
        ...baseStrategy,
        cornerThreshold: Math.max(15, Math.round(baseStrategy.cornerThreshold * 0.5)),
        spliceThreshold: Math.max(10, Math.round(baseStrategy.spliceThreshold * 0.5)),
        lengthThreshold: Math.max(2, Math.round(baseStrategy.lengthThreshold * 0.8))
      }
    });

    // Candidate C: Smooth organic (prioritizes continuous bezier curves, good for photos/illustrations)
    candidates.push({
      id: 'C_SMOOTH',
      config: {
        ...baseStrategy,
        cornerThreshold: Math.min(180, Math.round(baseStrategy.cornerThreshold * 2.0)),
        spliceThreshold: Math.min(180, Math.round(baseStrategy.spliceThreshold * 2.0)),
        filterSpeckle: baseStrategy.filterSpeckle + 2
      }
    });

    return candidates;
  }
}
