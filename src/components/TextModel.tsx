import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Font } from 'opentype.js';

interface TextModelProps {
  text: string;
  font: Font;
  scale: number;
}

export function TextModel({ text, font, scale }: TextModelProps) {
  const { foregroundGeometry, backgroundGeometry } = useMemo(() => {
    try {
      // Create path from text
      const path = font.getPath(text, 0, 0, 72);
      
      // Create a canvas to render the font for hole detection
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 1024;
      canvas.height = 1024;
      
      // Clear and draw the text
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      ctx.font = '72px Arial'; // We'll use the actual font later
      ctx.fillText(text, 0, canvas.height / 2);
      
      // Get the image data for hole detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Create shapes array to store all shapes
      const shapes: THREE.Shape[] = [];
      let currentShape: THREE.Shape | null = null;
      let firstPoint: THREE.Vector2 | null = null;
      
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
        } else if (cmd.type === 'Z') {
          if (currentShape && firstPoint) {
            const shape = currentShape as THREE.Shape;
            const point = firstPoint as THREE.Vector2;
            shape.lineTo(point.x, point.y);
            shape.closePath();
            shapes.push(shape);
            currentShape = null;
            firstPoint = null;
          }
        }
      });
      
      // Handle any remaining shape
      if (currentShape && firstPoint) {
        const shape = currentShape as THREE.Shape;
        const point = firstPoint as THREE.Vector2;
        shape.lineTo(point.x, point.y);
        shape.closePath();
        shapes.push(shape);
      }
      
      // Sort shapes by area to determine which are holes
      const sortedShapes = shapes.map(shape => ({
        shape,
        area: calculateShapeArea(shape)
      })).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
      
      // Create main shape and add holes
      const mainShape = sortedShapes[0].shape;
      const holes = sortedShapes.slice(1).map(({ shape }) => shape);
      mainShape.holes = holes;
      
      // Create foreground geometry (1mm upward)
      const foregroundGeometry = new THREE.ExtrudeGeometry(mainShape, {
        depth: 1,
        bevelEnabled: false
      });
      
      // Create background geometry (2mm downward with outline)
      const backgroundShape = new THREE.Shape();
      const outlineOffset = 1.5; // mm
      
      // Create outline by offsetting the main shape
      const mainPoints = mainShape.getPoints(50);
      const outlinePoints = mainPoints.map((point, i) => {
        const nextPoint = mainPoints[(i + 1) % mainPoints.length];
        const normal = new THREE.Vector2();
        normal.set(nextPoint.y - point.y, point.x - nextPoint.x).normalize();
        return new THREE.Vector2(
          point.x + normal.x * outlineOffset,
          point.y + normal.y * outlineOffset
        );
      });
      
      // Create the background shape
      outlinePoints.forEach((point, i) => {
        if (i === 0) {
          backgroundShape.moveTo(point.x, point.y);
        } else {
          backgroundShape.lineTo(point.x, point.y);
        }
      });
      backgroundShape.closePath();
      
      // Add holes to background
      holes.forEach(hole => {
        const holePoints = hole.getPoints(50);
        const holeOutlinePoints = holePoints.map((point, i) => {
          const nextPoint = holePoints[(i + 1) % holePoints.length];
          const normal = new THREE.Vector2();
          normal.set(nextPoint.y - point.y, point.x - nextPoint.x).normalize();
          return new THREE.Vector2(
            point.x + normal.x * outlineOffset,
            point.y + normal.y * outlineOffset
          );
        });
        
        const holeShape = new THREE.Shape();
        holeOutlinePoints.forEach((point, i) => {
          if (i === 0) {
            holeShape.moveTo(point.x, point.y);
          } else {
            holeShape.lineTo(point.x, point.y);
          }
        });
        holeShape.closePath();
        backgroundShape.holes.push(holeShape);
      });
      
      const backgroundGeometry = new THREE.ExtrudeGeometry(backgroundShape, {
        depth: 2,
        bevelEnabled: false
      });
      
      // Center and scale the geometries
      [foregroundGeometry, backgroundGeometry].forEach(geo => {
        geo.computeBoundingBox();
        const center = new THREE.Vector3();
        geo.boundingBox!.getCenter(center);
        geo.translate(-center.x, -center.y, 0);
        geo.scale(scale, scale, scale);
      });
      
      return { foregroundGeometry, backgroundGeometry };
    } catch (error) {
      console.error('Error creating geometry:', error);
      return { foregroundGeometry: null, backgroundGeometry: null };
    }
  }, [text, font, scale]);
  
  if (!foregroundGeometry || !backgroundGeometry) {
    return null;
  }
  
  return (
    <group>
      {/* Background (black, 2mm downward) */}
      <mesh geometry={backgroundGeometry} position={[0, 0, -2]}>
        <meshStandardMaterial color="black" />
      </mesh>
      
      {/* Foreground (blue, 1mm upward) */}
      <mesh geometry={foregroundGeometry} position={[0, 0, 1]}>
        <meshStandardMaterial color="#2196F3" />
      </mesh>
    </group>
  );
}

// Helper function to calculate shape area
function calculateShapeArea(shape: THREE.Shape): number {
  const points = shape.getPoints(50);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}