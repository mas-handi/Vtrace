/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Region Segmenter
 * 
 * Purpose: Performs Connected Component Labeling (CCL) to group pixels into distinct objects.
 */

import { ObjectGraph, ObjectNode } from './objectGraph.js';

export class RegionSegmenter {
  /**
   * Identifies connected regions in the image.
   * Note: This is a fast-pass heuristic bounding segmenter designed for JS.
   * For ultra-high resolution, a WASM segmenter or downscaled proxy is recommended.
   * @param {ImageData} imageData 
   * @returns {ObjectGraph}
   */
  static segment(imageData) {
    const { width, height, data } = imageData;
    const graph = new ObjectGraph(width, height);
    
    // Create a visited array to keep track of processed pixels
    const visited = new Uint8Array(width * height);
    let objectIdCounter = 1;

    // Adaptive Background Detection: Sample the 4 corners of the image
    const corners = [
      0, // Top-left
      (width - 1) * 4, // Top-right
      ((height - 1) * width) * 4, // Bottom-left
      ((height - 1) * width + width - 1) * 4 // Bottom-right
    ];
    
    const bgCandidates = [];
    for (const c of corners) {
      if (data[c+3] > 0) bgCandidates.push({r: data[c], g: data[c+1], b: data[c+2]});
    }
    
    // Assume the most consistent corner color is the background
    let bgR = -1, bgG = -1, bgB = -1;
    if (bgCandidates.length > 0) {
      bgR = bgCandidates[0].r;
      bgG = bgCandidates[0].g;
      bgB = bgCandidates[0].b;
    }

    // Helper to check if a pixel is considered "foreground"
    const colorDist = (r1, g1, b1, r2, g2, b2) => Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
    
    const isForeground = (idx) => {
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const a = data[idx+3];
      
      if (a === 0) return false; // Fully transparent is background
      
      // If we detected a solid background color, check if this pixel is very close to it
      if (bgR !== -1 && a > 250) {
        if (colorDist(r, g, b, bgR, bgG, bgB) < 15) return false;
      }
      return true;
    };

    // Dynamic noise floor based on image resolution (e.g. 0.001% of area or min 2 pixels)
    const minObjectArea = Math.max(2, Math.floor(graph.totalArea * 0.00001));

    // Fast linear scan to find unvisited foreground pixels
    for (let y = 0; y < height; y += 4) { // Step by 4 for performance in large images (subsampling)
      for (let x = 0; x < width; x += 4) {
        const pixelPos = y * width + x;
        
        if (visited[pixelPos] === 0 && isForeground(pixelPos * 4)) {
          // Found a new object, start BFS/Flood-fill
          const node = new ObjectNode(objectIdCounter++);
          
          // Iterative BFS queue
          const queue = [pixelPos];
          visited[pixelPos] = 1;

          while (queue.length > 0) {
            const currentPos = queue.pop();
            const cx = currentPos % width;
            const cy = Math.floor(currentPos / width);

            // Update node stats
            node.area++;
            if (cx < node.boundingBox.minX) node.boundingBox.minX = cx;
            if (cx > node.boundingBox.maxX) node.boundingBox.maxX = cx;
            if (cy < node.boundingBox.minY) node.boundingBox.minY = cy;
            if (cy > node.boundingBox.maxY) node.boundingBox.maxY = cy;

            // Check 4-way neighbors (stepping by subsample rate for speed)
            const neighbors = [
              { nx: cx + 2, ny: cy },
              { nx: cx - 2, ny: cy },
              { nx: cx, ny: cy + 2 },
              { nx: cx, ny: cy - 2 }
            ];

            for (const {nx, ny} of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nPos = ny * width + nx;
                if (visited[nPos] === 0) {
                  visited[nPos] = 1; // Mark as visited immediately to avoid duplicate queueing
                  if (isForeground(nPos * 4)) {
                    queue.push(nPos);
                  }
                }
              }
            }
          }
          
          if (node.area > minObjectArea) {
            graph.addObject(node);
          }
        }
      }
    }

    // Evaluate semantic relevance (artifact vs primary geometry)
    graph.analyzeGraph();
    
    return graph;
  }
}
