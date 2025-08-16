import * as THREE from 'three';
import * as opentype from 'opentype.js';
import { TextStyle } from '../types/Style';

export class TextMeshGenerator {
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async generateTextMesh(
    text: string, 
    font: opentype.Font, 
    style: TextStyle
  ): Promise<{ textMesh: THREE.Group; backgroundMesh: THREE.Mesh }> {
    try {
      const group = new THREE.Group();
      
      // Calculate text dimensions and create geometry
      const lines = this.wrapText(text, font, style);
      const textMeshes: THREE.Mesh[] = [];
      
      lines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines
        
        const path = font.getPath(line, 0, 0, style.fontSize);
        const shapes = this.pathToShapes(path);
        
        if (shapes.length > 0) {
          const geometry = new THREE.ExtrudeGeometry(shapes, {
            depth: style.textHeight,
            bevelEnabled: false
          });
          
          const material = new THREE.MeshLambertMaterial({ 
            color: style.textColor 
          });
          
          const mesh = new THREE.Mesh(geometry, material);
          
          // Position line
          mesh.position.y = -index * style.fontSize * style.lineHeight;
          textMeshes.push(mesh);
          group.add(mesh);
        }
      });

      // Center and align text
      this.alignTextGroup(group, textMeshes, style);
      
      // Create background
      const backgroundMesh = this.createBackground(style);
      
      // Mark meshes for cleanup
      group.userData.isTextMesh = true;
      backgroundMesh.userData.isTextMesh = true;

      // Enable shadows
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      backgroundMesh.castShadow = true;
      backgroundMesh.receiveShadow = true;
      
      // Add to scene
      this.scene.add(backgroundMesh);
      this.scene.add(group);
      
      return { textMesh: group, backgroundMesh };
    } catch (error) {
      console.error('Error in generateTextMesh:', error);
      throw error;
    }
  }

  private wrapText(text: string, font: opentype.Font, style: TextStyle): string[] {
    const lines = text.split('\n');
    const wrappedLines: string[] = [];
    
    for (const line of lines) {
      if (!line.trim()) {
        wrappedLines.push(''); // Preserve empty lines
        continue;
      }
      
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = this.getTextWidth(testLine, font, style.fontSize);
        
        if (width <= style.boundingBox.width - style.padding * 2) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            wrappedLines.push(word);
          }
        }
      }
      
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }
    
    return wrappedLines.filter(line => line.trim()); // Remove empty lines at the end
  }

  private getTextWidth(text: string, font: opentype.Font, fontSize: number): number {
    try {
      return font.getAdvanceWidth(text, fontSize) * 0.1;
    } catch (error) {
      console.warn('Error calculating text width:', error);
      return text.length * fontSize * 0.6; // Fallback estimation
    }
  }

  private pathToShapes(path: opentype.Path): THREE.Shape[] {
    const shapes: THREE.Shape[] = [];
    
    if (!path.commands || path.commands.length === 0) {
      return shapes;
    }
    
    let currentShape = new THREE.Shape();
    let hasStarted = false;
    
    try {
      path.commands.forEach(cmd => {
        switch (cmd.type) {
          case 'M':
            if (hasStarted && currentShape.curves.length > 0) {
              shapes.push(currentShape);
              currentShape = new THREE.Shape();
            }
            currentShape.moveTo(cmd.x * 0.1, -cmd.y * 0.1);
            hasStarted = true;
            break;
          case 'L':
            if (hasStarted) {
              currentShape.lineTo(cmd.x * 0.1, -cmd.y * 0.1);
            }
            break;
          case 'Q':
            if (hasStarted) {
              currentShape.quadraticCurveTo(
                cmd.x1 * 0.1, -cmd.y1 * 0.1,
                cmd.x * 0.1, -cmd.y * 0.1
              );
            }
            break;
          case 'C':
            if (hasStarted) {
              currentShape.bezierCurveTo(
                cmd.x1 * 0.1, -cmd.y1 * 0.1,
                cmd.x2 * 0.1, -cmd.y2 * 0.1,
                cmd.x * 0.1, -cmd.y * 0.1
              );
            }
            break;
          case 'Z':
            // Shape automatically closes
            break;
        }
      });
      
      if (hasStarted && currentShape.curves.length > 0) {
        shapes.push(currentShape);
      }
    } catch (error) {
      console.warn('Error processing path commands:', error);
    }
    
    return shapes;
  }

  private alignTextGroup(group: THREE.Group, meshes: THREE.Mesh[], style: TextStyle): void {
    if (meshes.length === 0) return;

    try {
      // Calculate bounding box
      const box = new THREE.Box3();
      group.children.forEach(mesh => {
        const meshBox = new THREE.Box3().setFromObject(mesh);
        box.union(meshBox);
      });

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Scale to fit bounding box
      const scaleX = (style.boundingBox.width - style.padding * 2) / size.x;
      const scaleY = (style.boundingBox.height - style.padding * 2) / size.y;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
      
      if (scale > 0 && isFinite(scale)) {
        group.scale.setScalar(scale);
      }

      // Align based on style
      switch (style.textAlign) {
        case 'left':
          group.position.x = -style.boundingBox.width / 2 + style.padding;
          break;
        case 'center':
          group.position.x = -center.x * scale;
          break;
        case 'right':
          group.position.x = style.boundingBox.width / 2 - style.padding - size.x * scale;
          break;
      }

      group.position.y = center.y * scale;
      group.position.z = style.backgroundHeight;
    } catch (error) {
      console.warn('Error aligning text group:', error);
    }
  }

  private createBackground(style: TextStyle): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    
    try {
      switch (style.backgroundShape) {
        case 'circle':
          const radius = Math.min(style.boundingBox.width, style.boundingBox.height) / 2;
          geometry = new THREE.CylinderGeometry(radius, radius, style.backgroundHeight, 32);
          break;
        case 'pill':
          // Create pill shape using rounded rectangle
          const pillShape = new THREE.Shape();
          const w = style.boundingBox.width;
          const h = style.boundingBox.height;
          const r = Math.min(w, h) / 4;
          
          pillShape.moveTo(-w/2 + r, -h/2);
          pillShape.lineTo(w/2 - r, -h/2);
          pillShape.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
          pillShape.lineTo(w/2, h/2 - r);
          pillShape.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
          pillShape.lineTo(-w/2 + r, h/2);
          pillShape.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
          pillShape.lineTo(-w/2, -h/2 + r);
          pillShape.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
          
          geometry = new THREE.ExtrudeGeometry(pillShape, { depth: style.backgroundHeight, bevelEnabled: false });
          break;
        default: // rectangle
          geometry = new THREE.BoxGeometry(
            style.boundingBox.width,
            style.boundingBox.height,
            style.backgroundHeight
          );
          break;
      }
      
      const material = new THREE.MeshLambertMaterial({ color: style.backgroundColor });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = style.backgroundHeight / 2;
      
      return mesh;
    } catch (error) {
      console.error('Error creating background:', error);
      // Fallback to simple box
      const geometry = new THREE.BoxGeometry(
        style.boundingBox.width,
        style.boundingBox.height,
        style.backgroundHeight
      );
      const material = new THREE.MeshLambertMaterial({ color: style.backgroundColor });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = style.backgroundHeight / 2;
      return mesh;
    }
  }
}