import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Font } from 'opentype.js';

interface TextModelProps {
  text: string;
  font: Font;
  scale: number;
  foregroundDepth: number;
  backgroundDepth: number;
  onDimensionsChange?: (dimensions: { width: number; height: number; depth: number }) => void;
}

export function TextModel({ text, font, scale, foregroundDepth, backgroundDepth, onDimensionsChange }: TextModelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referenceTexture, setReferenceTexture] = useState<THREE.Texture | null>(null);

  // Create reference texture
  useEffect(() => {
    const canvas = document.createElement('canvas');
    // Make canvas dimensions match the target text size ratio
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = 'black';
    // Start with a large font size
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

  const { foregroundGeometry, backgroundGeometry } = useMemo(() => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Create path from text with proper centering
      const fontSize = 72;
      const textWidth = font.getAdvanceWidth(text, fontSize);
      const baseline = (font.ascender + font.descender) / 2;
      const path = font.getPath(text, -textWidth / 2, baseline / 2, fontSize);
      
      // First pass: collect all paths and determine their types
      interface Point2D {
        x: number;
        y: number;
      }
      
      let currentContour: Point2D[] = [];
      let allContours: Point2D[][] = [];
      
      path.commands.forEach((cmd: any) => {
        const y = -cmd.y; // Flip Y coordinates
        
        switch (cmd.type) {
          case 'M':
            if (currentContour.length > 0) {
              allContours.push([...currentContour]);
              currentContour = [];
            }
            currentContour.push({ x: cmd.x, y });
            break;
            
          case 'L':
            currentContour.push({ x: cmd.x, y });
            break;
            
          case 'C':
            // For cubic curves, we'll approximate with multiple line segments
            const steps = 8;
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const t2 = t * t;
              const t3 = t2 * t;
              const mt = 1 - t;
              const mt2 = mt * mt;
              const mt3 = mt2 * mt;
              
              const x = (mt3 * currentContour[currentContour.length - 1].x) +
                       (3 * mt2 * t * cmd.x1) +
                       (3 * mt * t2 * cmd.x2) +
                       (t3 * cmd.x);
                       
              const y = (mt3 * currentContour[currentContour.length - 1].y) +
                       (3 * mt2 * t * -cmd.y1) +
                       (3 * mt * t2 * -cmd.y2) +
                       (t3 * -cmd.y);
                       
              currentContour.push({ x, y });
            }
            break;
            
          case 'Q':
            // For quadratic curves, we'll approximate with multiple line segments
            const qSteps = 6;
            for (let i = 1; i <= qSteps; i++) {
              const t = i / qSteps;
              const t2 = t * t;
              const mt = 1 - t;
              const mt2 = mt * mt;
              
              const x = (mt2 * currentContour[currentContour.length - 1].x) +
                       (2 * mt * t * cmd.x1) +
                       (t2 * cmd.x);
                       
              const y = (mt2 * currentContour[currentContour.length - 1].y) +
                       (2 * mt * t * -cmd.y1) +
                       (t2 * -cmd.y);
                       
              currentContour.push({ x, y });
            }
            break;
            
          case 'Z':
            if (currentContour.length > 0) {
              // Close the contour by connecting back to the first point
              currentContour.push({ ...currentContour[0] });
              allContours.push([...currentContour]);
              currentContour = [];
            }
            break;
        }
      });
      
      // Add any remaining contour
      if (currentContour.length > 0) {
        currentContour.push({ ...currentContour[0] });
        allContours.push([...currentContour]);
      }
      
      // Create shapes from contours
      const shapes = allContours.map(contour => {
        const shape = new THREE.Shape();
        contour.forEach((point, i) => {
          if (i === 0) {
            shape.moveTo(point.x, point.y);
          } else {
            shape.lineTo(point.x, point.y);
          }
        });
        return shape;
      });
      
      // Sort shapes by area and identify holes
      const shapesWithArea = shapes.map(shape => {
        const area = calculateShapeArea(shape);
        const bbox = new THREE.Box2();
        shape.getPoints(32).forEach(p => bbox.expandByPoint(p));
        return {
          shape,
          area: Math.abs(area),
          isHole: area > 0,  // In OpenType.js, positive area means it's a hole
          bbox
        };
      }).sort((a, b) => b.area - a.area);
      
      // Group shapes by containment
      const mainShapes: THREE.Shape[] = [];
      const remainingSholes = shapesWithArea.filter(s => s.isHole);
      
      shapesWithArea.filter(s => !s.isHole).forEach(mainShapeInfo => {
        const shape = mainShapeInfo.shape;
        const holes: THREE.Shape[] = [];
        
        // Find holes that are contained within this shape
        for (let i = remainingSholes.length - 1; i >= 0; i--) {
          const holeInfo = remainingSholes[i];
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
              remainingSholes.splice(i, 1);
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
        curveSegments: 16
      } as THREE.ExtrudeGeometryOptions);
      
      // Create background by scaling the shapes slightly
      const backgroundShapes = mainShapes.map(shape => {
        const bgShape = new THREE.Shape();
        const points = shape.getPoints(32);
        const center = new THREE.Vector2();
        points.forEach(p => center.add(p));
        center.divideScalar(points.length);
        
        // Scale points outward from center
        const scaledPoints = points.map(p => {
          const dir = new THREE.Vector2().subVectors(p, center).normalize();
          return new THREE.Vector2().addVectors(p, dir.multiplyScalar(0.75));
        });
        
        scaledPoints.forEach((p, i) => {
          if (i === 0) {
            bgShape.moveTo(p.x, p.y);
          } else {
            bgShape.lineTo(p.x, p.y);
          }
        });
        bgShape.closePath();
        
        // Handle holes - scale them inward
        bgShape.holes = shape.holes.map(hole => {
          const holeShape = new THREE.Shape();
          const holePoints = hole.getPoints(32);
          const holeCenter = new THREE.Vector2();
          holePoints.forEach(p => holeCenter.add(p));
          holeCenter.divideScalar(holePoints.length);
          
          const scaledHolePoints = holePoints.map(p => {
            const dir = new THREE.Vector2().subVectors(p, holeCenter).normalize();
            return new THREE.Vector2().addVectors(p, dir.multiplyScalar(-0.75));
          });
          
          scaledHolePoints.forEach((p, i) => {
            if (i === 0) {
              holeShape.moveTo(p.x, p.y);
            } else {
              holeShape.lineTo(p.x, p.y);
            }
          });
          holeShape.closePath();
          return holeShape;
        });
        
        return bgShape;
      });
      
      const backgroundGeometry = new THREE.ExtrudeGeometry(backgroundShapes, {
        depth: backgroundDepth,
        bevelEnabled: false,
        curveSegments: 16
      } as THREE.ExtrudeGeometryOptions);
      
      // Scale to target size (roughly 30mm x 60mm)
      const targetWidth = 60; // mm
      const boundingBox = new THREE.Box3().setFromObject(new THREE.Mesh(textGeometry));
      const currentWidth = boundingBox.max.x - boundingBox.min.x;
      const scaleFactor = (targetWidth / currentWidth) * scale;
      
      [textGeometry, backgroundGeometry].forEach(geo => {
        geo.scale(scaleFactor, scaleFactor, 1);
        
        // Center the geometry
        geo.computeBoundingBox();
        const center = new THREE.Vector3();
        geo.boundingBox!.getCenter(center);
        geo.translate(-center.x, -center.y, 0);
      });
      
      // Calculate dimensions in mm
      const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(textGeometry));
      const dimensions = {
        width: (bbox.max.x - bbox.min.x),
        height: (bbox.max.y - bbox.min.y),
        depth: foregroundDepth + backgroundDepth  // Total depth is sum of both depths
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
  }, [text, font, scale, foregroundDepth, backgroundDepth, onDimensionsChange]);
  
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
  
  if (error) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[10, 10, 1]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  }
  
  if (!foregroundGeometry || !backgroundGeometry || !referenceTexture) {
    return null;
  }
  
  // Calculate plane size to match geometry scale
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(foregroundGeometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const aspectRatio = width / height;
  
  return (
    <group>
      {/* Reference plane */}
      <mesh position={[0, height + 5, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[width * 1.2, (width * 1.2) / aspectRatio]} />
        <meshBasicMaterial map={referenceTexture} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Background (black, extends in -z direction) */}
      <mesh geometry={backgroundGeometry} position={[0, 0, -backgroundDepth]}>
        <meshStandardMaterial 
          color="black" 
          side={THREE.DoubleSide} 
          roughness={0.5}
          metalness={0.5}
        />
      </mesh>
      
      {/* Foreground (blue, extends in +z direction) */}
      <mesh geometry={foregroundGeometry} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#2196F3" 
          side={THREE.DoubleSide} 
          roughness={0.3}
          metalness={0.7}
        />
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