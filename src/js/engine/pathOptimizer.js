/**
 * Universal Intelligent Vector Reconstruction Engine (UIVRE)
 * Module: Path Optimizer (Tahap D)
 * 
 * Purpose: Post-tracing optimization to fix wavy contours, enforce geometric 
 * primitives (straight lines), and reduce nodes without increasing error.
 */

export class PathOptimizer {
  /**
   * Optimizes an SVG path string by straightening wavy curves and merging collinear lines.
   * @param {string} d - SVG path data string
   * @param {number} strokeW - Dominant stroke width (used for relative tolerance)
   * @returns {string} Optimized SVG path data
   */
  static optimize(d, tolerance = 1.5) {

    // VTracer outputs standard paths, usually: M x y C x1 y1 x2 y2 x y Z, or L x y, or Q
    // We will parse the basic commands. Since parsing robustly in JS is tricky, 
    // we use a regex to chunk commands and their coordinates.
    const commands = [];
    const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match;
    
    while ((match = regex.exec(d)) !== null) {
      const type = match[1];
      const argStr = match[2];
      
      // Robust number extraction: handles negative signs without spaces (e.g. M10-20 -> 10, -20)
      const numMatches = argStr.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
      const args = numMatches ? numMatches.map(parseFloat) : [];
      
      // Handle implicit multiple commands (e.g. L x1 y1 x2 y2)
      if (type === 'M' || type === 'm' || type === 'L' || type === 'l') {
        for (let i = 0; i < args.length; i += 2) {
          commands.push({ type: (i === 0 ? type : (type === 'M' ? 'L' : type === 'm' ? 'l' : type)), args: [args[i], args[i+1]] });
        }
      } else if (type === 'C' || type === 'c') {
        for (let i = 0; i < args.length; i += 6) {
          commands.push({ type, args: args.slice(i, i+6) });
        }
      } else if (type === 'Q' || type === 'q') {
        for (let i = 0; i < args.length; i += 4) {
          commands.push({ type, args: args.slice(i, i+4) });
        }
      } else {
        commands.push({ type, args });
      }
    }

    // Pass 1: Convert Nearly Straight Beziers to Lines
    let currentX = 0, currentY = 0;
    let startX = 0, startY = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      
      if (cmd.type === 'M') {
        currentX = cmd.args[0]; currentY = cmd.args[1];
        startX = currentX; startY = currentY;
      } else if (cmd.type === 'Z' || cmd.type === 'z') {
        currentX = startX; currentY = startY;
      } else if (cmd.type === 'L') {
        currentX = cmd.args[0]; currentY = cmd.args[1];
      } else if (cmd.type === 'C') {
        const [x1, y1, x2, y2, x, y] = cmd.args;
        // Check if control points are collinear with the start and end points
        const d1 = this.pointLineDistance(x1, y1, currentX, currentY, x, y);
        const d2 = this.pointLineDistance(x2, y2, currentX, currentY, x, y);
        
        if (d1 < tolerance && d2 < tolerance) {
          // Nearly straight! Convert to Line
          cmd.type = 'L';
          cmd.args = [x, y];
        }
        currentX = x; currentY = y;
      } else if (cmd.type === 'Q') {
        const [x1, y1, x, y] = cmd.args;
        const d1 = this.pointLineDistance(x1, y1, currentX, currentY, x, y);
        if (d1 < tolerance) {
          cmd.type = 'L';
          cmd.args = [x, y];
        }
        currentX = x; currentY = y;
      } else if (cmd.type === 'H' || cmd.type === 'h') {
        currentX = cmd.args[0];
      } else if (cmd.type === 'V' || cmd.type === 'v') {
        currentY = cmd.args[0];
      } else if (cmd.type === 'A' || cmd.type === 'a') {
        currentX = cmd.args[5]; currentY = cmd.args[6];
      }
    }

    // Pass 2: Merge Collinear Lines
    const optimizedCommands = [];
    currentX = 0; currentY = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      if (cmd.type === 'L' && optimizedCommands.length > 0) {
        const prevCmd = optimizedCommands[optimizedCommands.length - 1];
        if (prevCmd.type === 'L' || prevCmd.type === 'M') {
          let prevX, prevY, pPrevX, pPrevY;
          
          if (prevCmd.type === 'L') {
            prevX = prevCmd.args[0]; prevY = prevCmd.args[1];
            // Find the point before prevCmd
            if (optimizedCommands.length > 1) {
               const pPrevCmd = optimizedCommands[optimizedCommands.length - 2];
               if (pPrevCmd.type === 'L' || pPrevCmd.type === 'M') {
                 pPrevX = pPrevCmd.args[0]; pPrevY = pPrevCmd.args[1];
               } else if (pPrevCmd.type === 'C') {
                 pPrevX = pPrevCmd.args[4]; pPrevY = pPrevCmd.args[5];
               } else if (pPrevCmd.type === 'Q') {
                 pPrevX = pPrevCmd.args[2]; pPrevY = pPrevCmd.args[3];
               }
            }
          } else if (prevCmd.type === 'M') {
            // Can't merge into M, but we can check if L is zero-length
            prevX = prevCmd.args[0]; prevY = prevCmd.args[1];
          }

          if (pPrevX !== undefined && pPrevY !== undefined) {
             const dist = this.pointLineDistance(prevX, prevY, pPrevX, pPrevY, cmd.args[0], cmd.args[1]);
             if (dist < tolerance) {
                // The intermediate point (prevX, prevY) is collinear!
                // We can remove it by updating prevCmd to point to the new end
                prevCmd.args = cmd.args;
                currentX = cmd.args[0]; currentY = cmd.args[1];
                continue; // Skip adding the current cmd
             }
          }
        }
      }
      
      optimizedCommands.push(cmd);
      
      if (cmd.type === 'L' || cmd.type === 'M') {
        currentX = cmd.args[0]; currentY = cmd.args[1];
      } else if (cmd.type === 'C') {
        currentX = cmd.args[4]; currentY = cmd.args[5];
      } else if (cmd.type === 'Q') {
        currentX = cmd.args[2]; currentY = cmd.args[3];
      } else if (cmd.type === 'H' || cmd.type === 'h') {
        currentX = cmd.args[0];
      } else if (cmd.type === 'V' || cmd.type === 'v') {
        currentY = cmd.args[0];
      } else if (cmd.type === 'A' || cmd.type === 'a') {
        currentX = cmd.args[5]; currentY = cmd.args[6];
      }
    }

    // Reconstruct SVG path string
    return optimizedCommands.map(cmd => {
      return cmd.type + (cmd.args.length > 0 ? ' ' + cmd.args.map(n => n.toFixed(2).replace(/\.00$/, '')).join(' ') : '');
    }).join(' ');
  }

  // Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
  static pointLineDistance(px, py, x1, y1, x2, y2) {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    
    return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
  }
}
