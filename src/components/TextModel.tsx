import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Font } from 'opentype.js';

interface TextModelProps {
  text: string;
  font: Font;
  scale: number;
  foregroundDepth: number;
  backgroundDepth: number;
  outerOffset: number;
  innerOffset: number;
  xOffset: number;
  yOffset: number;
  onDimensionsChange?: (dimensions: { width: number; height: number; depth: number }) => void;
}

export function TextModel({ text, font, scale, foregroundDepth, backgroundDepth, outerOffset, innerOffset, xOffset, yOffset, onDimensionsChange }: TextModelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referenceTexture, setReferenceTexture] = useState<THREE.Texture | null>(null);

  // Create reference texture
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = 'white';
    const fontSize = canvas.height * 0.8;
    ctx.font = `${fontSize}px ${font.names.fontFamily.en}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Measure and scale text to match canvas width
    const textMetrics = ctx.measureText(text);
    const scale = (canvas.width * 0.8) / textMetrics.width;
    const finalFontSize = fontSize * scale;

    // Redraw with correct size
    ctx.font = `${finalFontSize}px ${font.names.fontFamily.en}`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    setReferenceTexture(texture);
  }, [text, font]);

  // Create geometries for the text
  const { foregroundGeometry, backgroundGeometry } = useMemo(() => {
    try {
      // Create shapes from font paths
      const shapes: THREE.Shape[] = [];
      const fontScale = 72; // Convert font units to pixels
      
      // Calculate text width for positioning
      const textWidth = font.getAdvanceWidth(text, fontScale);
      const baseline = (font.ascender + font.descender) / 2;
      
      // Create path with proper positioning
      const path = font.getPath(text, -textWidth / 2, baseline / 2, fontScale);
      path.commands.forEach(cmd => {
        if (cmd.type === 'M') {
          shapes.push(new THREE.Shape());
          shapes[shapes.length - 1].moveTo(cmd.x, -cmd.y);
        } else if (cmd.type === 'L') {
          shapes[shapes.length - 1].lineTo(cmd.x, -cmd.y);
        } else if (cmd.type === 'Q') {
          shapes[shapes.length - 1].quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y);
        } else if (cmd.type === 'C') {
          shapes[shapes.length - 1].bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y);
        } else if (cmd.type === 'Z') {
          shapes[shapes.length - 1].closePath();
        }
      });
      
      // Sort shapes by area and identify holes
      const shapesWithArea = shapes.map(shape => {
        const area = calculateShapeArea(shape);
        const bbox = new THREE.Box2();
        shape.getPoints(16).forEach(p => bbox.expandByPoint(p)); // Reduced from 32 to 16 points
        return {
          shape,
          area: Math.abs(area),
          isHole: area > 0,  // Positive area means it's a hole in OpenType.js
          bbox
        };
      }).sort((a, b) => b.area - a.area);
      
      // Group shapes by containment
      const mainShapes: THREE.Shape[] = [];
      const remainingHoles = shapesWithArea.filter(s => s.isHole);
      
      shapesWithArea.filter(s => !s.isHole).forEach(mainShapeInfo => {
        const shape = mainShapeInfo.shape;
        const holes: THREE.Shape[] = [];
        
        // Find holes that are contained within this shape
        for (let i = remainingHoles.length - 1; i >= 0; i--) {
          const holeInfo = remainingHoles[i];
          const holeBBox = holeInfo.bbox;
          const shapeBBox = mainShapeInfo.bbox;
          
          // Check if hole's bounding box is contained within shape's bounding box
          if (holeBBox.min.x >= shapeBBox.min.x && 
              holeBBox.max.x <= shapeBBox.max.x &&
              holeBBox.min.y >= shapeBBox.min.y &&
              holeBBox.max.y <= shapeBBox.max.y) {
            // Check if any point of the hole is inside the shape
            const holePoint = holeInfo.shape.getPoints(1)[0];
            if (isPointInShape(shape, holePoint)) {
              holes.push(holeInfo.shape);
              remainingHoles.splice(i, 1);
            }
          }
        }
        
        shape.holes = holes;
        mainShapes.push(shape);
      });
      
      // Create foreground geometry
      const textGeometry = new THREE.ExtrudeGeometry(mainShapes, {
        depth: foregroundDepth,
        bevelEnabled: false,
        curveSegments: 16 // Reduced from 32 to 16
      } as THREE.ExtrudeGeometryOptions);
      
      // Create background using parallel offset
      const backgroundShapes = mainShapes.map(shape => {
        const bgShape = new THREE.Shape();
        const points = shape.getPoints(128); // Reduced from 256 to 128
        
        // Create offset using parallel offset method for outer shape
        const offsetPoints = createParallelOffset(points, outerOffset, false);
        
        offsetPoints.forEach((p, i) => {
          if (i === 0) {
            bgShape.moveTo(p.x, p.y);
          } else {
            bgShape.lineTo(p.x, p.y);
          }
        });
        
        // Handle holes using parallel offset
        bgShape.holes = shape.holes.map(hole => {
          const holeShape = new THREE.Shape();
          const holePoints = hole.getPoints(128); // Reduced from 256 to 128
          const offsetHolePoints = createParallelOffset(holePoints, innerOffset, true);
          
          offsetHolePoints.forEach((p, i) => {
            if (i === 0) {
              holeShape.moveTo(p.x, p.y);
            } else {
              holeShape.lineTo(p.x, p.y);
            }
          });
          
          return holeShape;
        });
        
        return bgShape;
      });
      
      const backgroundGeometry = new THREE.ExtrudeGeometry(backgroundShapes, {
        depth: backgroundDepth,
        bevelEnabled: false,
        curveSegments: 16 // Reduced from 32 to 16
      } as THREE.ExtrudeGeometryOptions);
      
      // Apply scale and position the geometries
      [textGeometry, backgroundGeometry].forEach(geo => {
        geo.scale(scale, scale, 1);
        
        // Center the geometry and apply offsets
        geo.computeBoundingBox();
        const center = new THREE.Vector3();
        geo.boundingBox!.getCenter(center);
        geo.translate(-center.x + xOffset, -center.y + yOffset, 0);
      });
      
      // Calculate dimensions in mm
      const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(textGeometry));
      const dimensions = {
        width: (bbox.max.x - bbox.min.x),
        height: (bbox.max.y - bbox.min.y),
        depth: foregroundDepth + backgroundDepth
      };
      onDimensionsChange?.(dimensions);
      
      setIsLoading(false);
      return { foregroundGeometry: textGeometry, backgroundGeometry };
    } catch (error) {
      console.error('Error creating geometry:', error);
      setError(error instanceof Error ? error.message : 'Failed to create geometry');
      setIsLoading(false);
      return { foregroundGeometry: null, backgroundGeometry: null };
    }
  }, [text, font, scale, foregroundDepth, backgroundDepth, outerOffset, innerOffset, xOffset, yOffset, onDimensionsChange]);
  
  if (isLoading) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[10, 10, 1]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      </group>
    );
  }
  
  if (error || !foregroundGeometry || !backgroundGeometry || !referenceTexture) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[10, 10, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  }
  
  // Calculate plane size to match geometry scale
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(foregroundGeometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const aspectRatio = width / height;
  
  return (
    <group>
      {/* Background */}
      <mesh geometry={backgroundGeometry} position={[0, 0, -backgroundDepth]}>
        <meshStandardMaterial color="#666" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Foreground */}
      <mesh geometry={foregroundGeometry}>
        <meshStandardMaterial color="#fff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Helper function to calculate shape area
function calculateShapeArea(shape: THREE.Shape): number {
  const points = shape.getPoints(24);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

// Helper function to group shapes by their position (for handling multiple letters)
function groupShapesByPosition(shapes: { shape: THREE.Shape; area: number; isExterior: boolean }[]) {
  const groups: typeof shapes[] = [];
  const tolerance = 10; // Distance threshold for grouping

  shapes.forEach(shapeInfo => {
    const bbox = new THREE.Box2();
    shapeInfo.shape.getPoints(16).forEach(point => bbox.expandByPoint(point));  // Reduced from 24 to 16
    
    // Find a group that this shape belongs to
    let foundGroup = false;
    for (const group of groups) {
      const groupBBox = new THREE.Box2();
      group[0].shape.getPoints(16).forEach(point => groupBBox.expandByPoint(point));  // Reduced from 24 to 16
      
      if (bbox.intersectsBox(groupBBox) || 
          Math.abs(bbox.min.x - groupBBox.max.x) < tolerance ||
          Math.abs(bbox.max.x - groupBBox.min.x) < tolerance) {
        group.push(shapeInfo);
        foundGroup = true;
        break;
      }
    }
    
    // If no group found, create a new one
    if (!foundGroup) {
      groups.push([shapeInfo]);
    }
  });

  return groups;
}

// Add this helper function at the bottom of the file
function isPointInShape(shape: THREE.Shape, point: THREE.Vector2): boolean {
  const points = shape.getPoints(32);
  let inside = false;
  
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Helper function to calculate rolling ball offset
function createParallelOffset(points: THREE.Vector2[], offset: number, isHole: boolean = false): THREE.Vector2[] {
  // For holes, we need to reverse both points and offset direction
  const workingPoints = isHole ? [...points].reverse() : points;
  const radius = isHole ? -Math.abs(offset) : Math.abs(offset);
  
  // Ensure the shape is closed
  if (!workingPoints[workingPoints.length - 1].equals(workingPoints[0])) {
    workingPoints.push(workingPoints[0].clone());
  }
  
  // Calculate segment vectors and normals
  const segments: Array<{
    start: THREE.Vector2;
    end: THREE.Vector2;
    dir: THREE.Vector2;
    normal: THREE.Vector2;
  }> = [];
  
  for (let i = 0; i < workingPoints.length - 1; i++) {
    const start = workingPoints[i];
    const end = workingPoints[i + 1];
    const dir = new THREE.Vector2().subVectors(end, start).normalize();
    const normal = new THREE.Vector2(-dir.y, dir.x);
    segments.push({ start, end, dir, normal });
  }
  
  // Create the offset path by following the ball's outer envelope
  const offsetPoints: THREE.Vector2[] = [];
  
  for (let i = 0; i < segments.length - 1; i++) {
    const curr = segments[i];
    const next = segments[i + 1];
    
    // Calculate angle between segments
    const angle = Math.acos(Math.min(1, Math.max(-1, curr.dir.dot(next.dir))));
    const cross = curr.dir.x * next.dir.y - curr.dir.y * next.dir.x;
    const clockwise = cross < 0; // Simplified: always use cross product sign
    
    // Add offset point at start of segment
    const startOffset = curr.normal.clone().multiplyScalar(radius);
    offsetPoints.push(new THREE.Vector2().addVectors(curr.start, startOffset));
    
    // If there's a significant angle between segments, add circular arc
    if (angle > 0.01) {
      const center = curr.end.clone();
      const numSteps = Math.max(1, Math.ceil(angle * 16)); // More points for sharper angles
      
      // Calculate start and end angles for the arc
      const startAngle = Math.atan2(curr.normal.y, curr.normal.x);
      let endAngle = Math.atan2(next.normal.y, next.normal.x);
      
      // Ensure we take the shorter path around the circle
      if (clockwise) {
        if (endAngle > startAngle) endAngle -= 2 * Math.PI;
      } else {
        if (endAngle < startAngle) endAngle += 2 * Math.PI;
      }
      
      // Add points along the arc
      for (let j = 1; j <= numSteps; j++) {
        const t = j / numSteps;
        const angle = startAngle * (1 - t) + endAngle * t;
        offsetPoints.push(new THREE.Vector2(
          center.x + radius * Math.cos(angle),
          center.y + radius * Math.sin(angle)
        ));
      }
    }
  }
  
  // Add final offset point
  const lastSegment = segments[segments.length - 1];
  const finalOffset = lastSegment.normal.clone().multiplyScalar(radius);
  offsetPoints.push(new THREE.Vector2().addVectors(lastSegment.end, finalOffset));
  
  // Close the shape if needed
  if (!offsetPoints[0].equals(offsetPoints[offsetPoints.length - 1])) {
    offsetPoints.push(offsetPoints[0].clone());
  }
  
  // Smooth the path to remove any sharp corners
  const smoothedPoints: THREE.Vector2[] = [];
  const smoothingWindow = 2;
  
  for (let i = 0; i < offsetPoints.length; i++) {
    const windowPoints: THREE.Vector2[] = [];
    for (let j = -smoothingWindow; j <= smoothingWindow; j++) {
      const idx = (i + j + offsetPoints.length) % offsetPoints.length;
      windowPoints.push(offsetPoints[idx]);
    }
    
    const smoothed = new THREE.Vector2();
    windowPoints.forEach(p => smoothed.add(p));
    smoothed.divideScalar(windowPoints.length);
    smoothedPoints.push(smoothed);
  }
  
  // Ensure the smoothed path is closed
  if (!smoothedPoints[0].equals(smoothedPoints[smoothedPoints.length - 1])) {
    smoothedPoints.push(smoothedPoints[0].clone());
  }
  
  return smoothedPoints;
}

// Helper function to create a proper outline from a cloud of points
function createOutlineFromPoints(points: THREE.Vector2[], radius: number): THREE.Vector2[] {
  // First, find the leftmost point as our starting point
  let startIdx = 0;
  let leftmost = points[0].x;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < leftmost) {
      leftmost = points[i].x;
      startIdx = i;
    }
  }

  // Initialize outline with the leftmost point
  const outline: THREE.Vector2[] = [points[startIdx].clone()];
  const used = new Set<number>([startIdx]);
  let current = points[startIdx];
  let currentAngle = Math.PI; // Start looking right

  // Keep finding next points until we get back to start
  while (outline.length < 2 || !outline[0].equals(outline[outline.length - 1])) {
    let bestIdx = -1;
    let bestAngle = Infinity;
    let minAngleDiff = Infinity;

    // Look for the next point in a counterclockwise sweep
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;

      const point = points[i];
      const dist = current.distanceTo(point);
      
      // Only consider points within reasonable distance
      if (dist > radius * 2) continue;

      // Calculate angle to this point
      const angle = Math.atan2(point.y - current.y, point.x - current.x);
      let angleDiff = angle - currentAngle;
      
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      // We want the smallest positive angle difference
      if (angleDiff > -Math.PI/4 && angleDiff < minAngleDiff) {
        minAngleDiff = angleDiff;
        bestAngle = angle;
        bestIdx = i;
      }
    }

    // If we can't find a next point, try to close the shape
    if (bestIdx === -1) {
      if (outline.length > 2 && current.distanceTo(outline[0]) < radius * 0.5) {
        outline.push(outline[0].clone());
        break;
      } else {
        // If we can't close the shape, something went wrong
        // Try to find any unused point that's close enough
        let nearestUnused = -1;
        let minDist = radius * 2;
        for (let i = 0; i < points.length; i++) {
          if (!used.has(i)) {
            const dist = current.distanceTo(points[i]);
            if (dist < minDist) {
              minDist = dist;
              nearestUnused = i;
            }
          }
        }
        if (nearestUnused === -1) break; // No more points to add
        bestIdx = nearestUnused;
        bestAngle = Math.atan2(
          points[bestIdx].y - current.y,
          points[bestIdx].x - current.x
        );
      }
    }

    // Add the best point to our outline
    current = points[bestIdx].clone();
    outline.push(current);
    used.add(bestIdx);
    currentAngle = bestAngle;
  }

  // Ensure the shape is closed
  if (outline.length > 0 && !outline[0].equals(outline[outline.length - 1])) {
    outline.push(outline[0].clone());
  }

  // Smooth the outline by averaging nearby points
  const smoothedOutline: THREE.Vector2[] = [];
  const smoothingRadius = radius * 0.25;
  
  for (let i = 0; i < outline.length; i++) {
    const point = outline[i];
    const nearbyPoints: THREE.Vector2[] = [];
    
    // Find nearby points
    for (let j = Math.max(0, i - 2); j <= Math.min(outline.length - 1, i + 2); j++) {
      if (point.distanceTo(outline[j]) < smoothingRadius) {
        nearbyPoints.push(outline[j]);
      }
    }
    
    // Average the positions
    if (nearbyPoints.length > 0) {
      const avg = new THREE.Vector2();
      nearbyPoints.forEach(p => avg.add(p));
      avg.divideScalar(nearbyPoints.length);
      smoothedOutline.push(avg);
    } else {
      smoothedOutline.push(point.clone());
    }
  }

  return smoothedOutline;
}