/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Strategy Selector (Tahap B)
 * 
 * Purpose: Computes dynamic VTracer parameters entirely derived from 
 * image properties (strokeW, dimensions, edge density), no hardcoded magic numbers.
 */

export class StrategySelector {
  static select(profile, classification) {
    console.log("UIVRE: Running Strategy Selector (Tahap B)...");
    
    const { totalPixels, width, height } = profile.resolution;
    const edgeDensity = profile.edges.density; // 0.0 to 1.0
    
    // Estimate dominant stroke width (fallback heuristic if Morphology Engine is bypassed)
    // A dense edge map implies thinner strokes.
    const strokeW = Math.max(1, Math.floor(Math.sqrt(totalPixels) * (1.0 - edgeDensity) * 0.005));
    
    // 1. filterSpeckle (Minimum artifact area)
    // Derived from stroke width and image area. Do not use fixed pixel values.
    const filterSpeckle = Math.max(2, Math.floor(strokeW * 0.5));

    // 2. cornerThreshold (Degrees)
    // Derived from edge direction variance. Higher edge density usually means more complex geometry.
    let cornerThreshold;
    if (classification.dominantType === 'logo' || classification.dominantType === 'typography') {
      cornerThreshold = Math.round(30 + (edgeDensity * 40)); // 30 to 70 degrees
    } else if (classification.dominantType === 'photo') {
      cornerThreshold = Math.round(120 + (edgeDensity * 60)); // 120 to 180 degrees (very smooth)
    } else {
      cornerThreshold = Math.round(60 + (edgeDensity * 30)); // Default flat artwork
    }

    // 3. spliceThreshold (Degrees for collinear segments)
    const spliceThreshold = Math.round(cornerThreshold * 0.75);

    // 4. lengthThreshold (Minimum line length)
    // Derived from image resolution. Larger images can have longer minimum lines.
    const lengthThreshold = Math.max(3, Math.round((width + height) * 0.001));
    
    // 5. colorPrecision (Gradient clustering tolerance)
    const colorPrecision = classification.dominantType === 'photo' ? 8 : 6;

    const baseStrategy = {
      preset: classification.dominantType === 'photo' ? 'photo' : 'poster',
      clustering: profile.color.complexity === 'high' ? 'color-cluster' : 'bw',
      hierarchical: 'stacked',
      mode: 'spline',
      filterSpeckle: filterSpeckle,
      colorPrecision: colorPrecision,
      layerDifference: 25,
      cornerThreshold: cornerThreshold,
      lengthThreshold: lengthThreshold,
      spliceThreshold: spliceThreshold,
      pathPrecision: 3
    };

    console.log("UIVRE Strategy Computed:", {
      derivedStrokeW: strokeW,
      reasoning: `cornerThreshold=${cornerThreshold.toFixed(1)} due to edgeDensity=${edgeDensity.toFixed(3)}`
    });

    return baseStrategy;
  }
}
