/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Image Classifier
 * 
 * Purpose: Takes the ImageProfile from ImageAnalyzer and determines
 * the confidence levels for various image categories.
 */

export class ImageClassifier {
  /**
   * Classifies the image based on its forensic profile.
   * @param {Object} profile 
   * @returns {Object} Confidence scores for different types
   */
  static classify(profile) {
    let logoConfidence = 0.5;
    let photoConfidence = 0.5;
    let lineArtConfidence = 0.5;
    let flatArtworkConfidence = 0.5;

    // RULE: High colors + high gradients usually means PHOTO or 3D ARTWORK
    if (profile.color.complexity === "high" || profile.gradientDensity === "high") {
      photoConfidence += 0.4;
      logoConfidence -= 0.3;
      lineArtConfidence -= 0.4;
      flatArtworkConfidence -= 0.3;
    }

    // RULE: Low colors + transparency heavily implies LOGO or FLAT ARTWORK
    if (profile.color.complexity === "low" && profile.transparency.hasTransparency) {
      logoConfidence += 0.4;
      flatArtworkConfidence += 0.3;
      photoConfidence -= 0.4;
    }

    // RULE: Low colors + high edge density = LINE ART or TEXT
    if (profile.color.complexity === "low" && profile.edges.complexity === "high") {
      lineArtConfidence += 0.4;
      logoConfidence += 0.1;
      flatArtworkConfidence -= 0.2;
    }

    // Normalize and clamp between 0 and 1
    const clamp = (val) => Math.max(0, Math.min(1, val));

    const classification = {
      logo: clamp(logoConfidence),
      photo: clamp(photoConfidence),
      lineArt: clamp(lineArtConfidence),
      flatArtwork: clamp(flatArtworkConfidence)
    };

    // Determine the dominant classification
    let dominantType = "flatArtwork";
    let maxConf = -1;
    for (const [type, conf] of Object.entries(classification)) {
      if (conf > maxConf) {
        maxConf = conf;
        dominantType = type;
      }
    }

    return {
      scores: classification,
      dominantType: dominantType,
      confidence: maxConf
    };
  }
}
