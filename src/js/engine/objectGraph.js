/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Object Graph
 * 
 * Purpose: Defines the structural hierarchy of objects found in the image.
 * Separates intentional design geometry from raster/compression artifacts.
 */

export class ObjectNode {
  constructor(id) {
    this.id = id;
    this.type = "UNKNOWN"; // PRIMARY_OBJECT, SECONDARY_OBJECT, PARTIAL_OBJECT, POSSIBLE_ARTIFACT
    this.confidence = 1.0;
    
    // Geometric properties
    this.area = 0;
    this.boundingBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    this.colorProfile = null;
    
    // Relational properties
    this.children = [];
    this.artifactProbability = 0.0;
  }

  get width() { return this.boundingBox.maxX - this.boundingBox.minX; }
  get height() { return this.boundingBox.maxY - this.boundingBox.minY; }

  evaluateSemanticRelevance(globalArea) {
    // Basic heuristic: if an object occupies less than 0.05% of the total area,
    // and its bounding box is tiny, it's highly likely a noise artifact.
    const areaRatio = this.area / globalArea;
    
    if (areaRatio < 0.0005) {
      this.artifactProbability = 0.95;
      this.type = "POSSIBLE_ARTIFACT";
    } else if (areaRatio > 0.1) {
      this.artifactProbability = 0.01;
      this.type = "PRIMARY_OBJECT";
    } else {
      this.artifactProbability = 0.2;
      this.type = "SECONDARY_OBJECT";
    }
  }
}

export class ObjectGraph {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.totalArea = width * height;
    this.objects = [];
  }

  addObject(node) {
    this.objects.push(node);
  }

  analyzeGraph() {
    for (const obj of this.objects) {
      obj.evaluateSemanticRelevance(this.totalArea);
    }
  }

  getArtifacts() {
    return this.objects.filter(obj => obj.artifactProbability > 0.8);
  }

  getValidObjects() {
    return this.objects.filter(obj => obj.artifactProbability <= 0.8);
  }
}
