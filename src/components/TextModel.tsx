import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Font } from 'opentype.js';

interface TextModelProps {
  text: string;
  font: Font;
  scale: number;
}

export function TextModel({ text, font, scale }: TextModelProps) {
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
      
      // Create shapes array to store all shapes
      const shapes: THREE.Shape[] = [];
      let currentShape: THREE.Shape | null = null;
      let firstPoint: THREE.Vector2 | null = null;
      let startX = 0, startY = 0;
      
      // Process each path command
      path.commands.forEach((cmd: any) => {
        // Flip Y coordinates to match Three.js coordinate system
        const flippedY = -cmd.y;
        
        if (cmd.type === 'M') {
          if (currentShape) {
            currentShape.closePath();
            shapes.push(currentShape);
          }
          
          currentShape = new THREE.Shape();
          firstPoint = new THREE.Vector2(cmd.x, flippedY);
          startX = cmd.x;
          startY = flippedY;
          currentShape.moveTo(cmd.x, flippedY);
        } else if (cmd.type === 'L') {
          currentShape!.lineTo(cmd.x, flippedY);
        } else if (cmd.type === 'C') {
          currentShape!.bezierCurveTo(
            cmd.x1, -cmd.y1,
            cmd.x2, -cmd.y2,
            cmd.x, flippedY
          );
        } else if (cmd.type === 'Q') {
          currentShape!.quadraticCurveTo(
            cmd.x1, -cmd.y1,
            cmd.x, flippedY
          );
        }
      });
      
      // Handle any remaining shape
      if (currentShape && firstPoint) {
        const shape = currentShape as THREE.Shape;
        shape.lineTo(startX, startY);
        shape.closePath();
        shapes.push(shape);
      }
      
      if (shapes.length === 0) {
        throw new Error('No shapes were created from the text');
      }
      
      // Sort shapes by area and ensure correct winding
      const shapesWithInfo = shapes.map(shape => {
        const area = calculateShapeArea(shape);
        const points = shape.getPoints(32);  // Reduced from 96 to 32
        // In OpenType.js, clockwise (positive area) paths are the exterior
        if (area < 0) {
          points.reverse();
          const newShape = new THREE.Shape(points);
          return { shape: newShape, area: Math.abs(area), isExterior: true };
        }
        return { shape, area: Math.abs(area), isExterior: true };
      }).sort((a, b) => b.area - a.area);
      
      // Group shapes by their bounding boxes to handle multiple letters
      const letterGroups = groupShapesByPosition(shapesWithInfo);
      
      // Process each letter group
      const allShapes = letterGroups.map(group => {
        // Find the largest shape in the group
        const mainShape = group.reduce((largest, current) => {
          return current.area > largest.area ? current : largest;
        }).shape;
        
        // All other shapes in the group become holes
        const holes = group
          .filter(info => info.shape !== mainShape)
          .map(info => {
            const points = info.shape.getPoints(32);  // Reduced from 96 to 32
            points.reverse(); // Reverse hole winding
            return new THREE.Shape(points);
          });
        
        mainShape.holes = holes;
        return mainShape;
      });
      
      // Create foreground geometry
      const textGeometry = new THREE.ExtrudeGeometry(allShapes, {
        depth: 1,
        bevelEnabled: false,
        curveSegments: 16  // Reduced from 32 to 16
      } as THREE.ExtrudeGeometryOptions);
      
      // Create background shapes by expanding the foreground shapes
      const backgroundShapes = allShapes.map(shape => {
        const bgShape = new THREE.Shape();
        const outlineOffset = 0.75; // mm
        
        // Get the outer contour points with high resolution
        const outerPoints = shape.getPoints(32);  // Reduced from 96 to 32
        
        // Create the expanded outline
        outerPoints.forEach((point, i) => {
          const prev = outerPoints[(i - 1 + outerPoints.length) % outerPoints.length];
          const next = outerPoints[(i + 1) % outerPoints.length];
          
          // Calculate direction vectors
          const v1 = new THREE.Vector2().subVectors(point, prev).normalize();
          const v2 = new THREE.Vector2().subVectors(next, point).normalize();
          
          // Calculate the normal vector (perpendicular to the curve)
          const normal = new THREE.Vector2(-(v1.y + v2.y), v1.x + v2.x).normalize();
          
          // Create offset point
          const offsetPoint = new THREE.Vector2(
            point.x + normal.x * outlineOffset,
            point.y + normal.y * outlineOffset
          );
          
          if (i === 0) {
            bgShape.moveTo(offsetPoint.x, offsetPoint.y);
          } else {
            bgShape.lineTo(offsetPoint.x, offsetPoint.y);
          }
        });
        
        bgShape.closePath();
        
        // Handle holes
        shape.holes.forEach(hole => {
          const offsetHole = new THREE.Shape();
          const holePoints = hole.getPoints(32);  // Reduced from 96 to 32
          
          holePoints.forEach((point, i) => {
            const prev = holePoints[(i - 1 + holePoints.length) % holePoints.length];
            const next = holePoints[(i + 1) % holePoints.length];
            
            const v1 = new THREE.Vector2().subVectors(point, prev).normalize();
            const v2 = new THREE.Vector2().subVectors(next, point).normalize();
            const normal = new THREE.Vector2(-(v1.y + v2.y), v1.x + v2.x).normalize();
            
            const offsetPoint = new THREE.Vector2(
              point.x - normal.x * outlineOffset,
              point.y - normal.y * outlineOffset
            );
            
            if (i === 0) {
              offsetHole.moveTo(offsetPoint.x, offsetPoint.y);
            } else {
              offsetHole.lineTo(offsetPoint.x, offsetPoint.y);
            }
          });
          
          offsetHole.closePath();
          bgShape.holes.push(offsetHole);
        });
        
        return bgShape;
      });
      
      const backgroundGeometry = new THREE.ExtrudeGeometry(backgroundShapes, {
        depth: 2,
        bevelEnabled: false,
        curveSegments: 16  // Reduced from 32 to 16
      } as THREE.ExtrudeGeometryOptions);
      
      // Scale to target size (roughly 30mm x 60mm)
      const targetWidth = 60; // mm
      const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(textGeometry));
      const currentWidth = bbox.max.x - bbox.min.x;
      const scaleFactor = (targetWidth / currentWidth) * scale;
      
      [textGeometry, backgroundGeometry].forEach(geo => {
        geo.scale(scaleFactor, scaleFactor, 1);
        
        // Center the geometry
        geo.computeBoundingBox();
        const center = new THREE.Vector3();
        geo.boundingBox!.getCenter(center);
        geo.translate(-center.x, -center.y, 0);
      });
      
      setIsLoading(false);
      return { foregroundGeometry: textGeometry, backgroundGeometry };
    } catch (error) {
      console.error('Error creating geometry:', error);
      setError(error instanceof Error ? error.message : 'Failed to create geometry');
      setIsLoading(false);
      return { foregroundGeometry: null, backgroundGeometry: null };
    }
  }, [text, font, scale]);
  
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
      
      {/* Background (black, 2mm downward) */}
      <mesh geometry={backgroundGeometry} position={[0, 0, -2]}>
        <meshStandardMaterial 
          color="black" 
          side={THREE.DoubleSide} 
          roughness={0.5}
          metalness={0.5}
        />
      </mesh>
      
      {/* Foreground (blue, at z=0) */}
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