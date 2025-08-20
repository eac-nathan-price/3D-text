import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { themes, type Theme } from './themes';
import { type Product } from './products';

interface ThemeGridProps {
  onThemeSelect: (theme: Theme) => void;
  selectedTheme: Theme | null;
  selectedProduct: Product | null;
  userText: string;
}

interface ThemePreview {
  theme: Theme;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  textMesh: THREE.Mesh | null;
  pillMesh: THREE.Mesh | null;
}

export const ThemeGrid: React.FC<ThemeGridProps> = ({
  onThemeSelect,
  selectedTheme,
  selectedProduct,
  userText
}) => {
  const [previews, setPreviews] = useState<ThemePreview[]>([]);
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  // Initialize previews for all themes
  useEffect(() => {
    if (!selectedProduct) return;

    const newPreviews = themes.map(theme => ({
      theme,
      canvasRef: React.createRef<HTMLCanvasElement>(),
      scene: null,
      camera: null,
      renderer: null,
      textMesh: null,
      pillMesh: null
    }));

    setPreviews(newPreviews);
  }, [selectedProduct]);

  // Initialize 3D scenes for each preview
  useEffect(() => {
    if (!selectedProduct || previews.length === 0) return;

    previews.forEach((preview) => {
      if (!preview.canvasRef.current) return;

      const canvas = preview.canvasRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true, 
        alpha: true 
      });

      // Set renderer size
      renderer.setSize(200, 150);
      renderer.setClearColor(0x000000, 0);

      // Position camera
      camera.position.set(0, 0, 100);
      camera.lookAt(0, 0, 0);

      // Add lighting
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(50, 100, 50);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));

      // Store references
      preview.scene = scene;
      preview.camera = camera;
      preview.renderer = renderer;

      // Load font and create preview
      const loader = new FontLoader();
      loader.load(`/fonts/${preview.theme.font}`, (font: any) => {
        createPreviewMesh(preview, font);
      });
    });
  }, [previews, selectedProduct]);

  // Update previews when text or product changes
  useEffect(() => {
    if (!selectedProduct || previews.length === 0) return;

    previews.forEach((preview) => {
      if (preview.scene && preview.theme) {
        const loader = new FontLoader();
        loader.load(`/fonts/${preview.theme.font}`, (font: any) => {
          createPreviewMesh(preview, font);
        });
      }
    });
  }, [userText, selectedProduct]);

  const createPreviewMesh = (preview: ThemePreview, font: any) => {
    if (!preview.scene || !selectedProduct) return;

    // Clear existing meshes
    if (preview.textMesh) preview.scene.remove(preview.textMesh);
    if (preview.pillMesh) preview.scene.remove(preview.pillMesh);

    // Use user text or theme default text
    const displayText = userText || preview.theme.text;

    // Create text geometry
    const textGeo = new TextGeometry(displayText, {
      font,
      size: 8, // Fixed size for preview
      depth: selectedProduct.text.thickness + selectedProduct.text.overlap,
      curveSegments: 8,
      bevelEnabled: false,
    });

    textGeo.computeBoundingBox();
    textGeo.center();

    // Create text material with theme colors
    const textMat = new THREE.MeshPhongMaterial({ 
      color: preview.theme.color,
      name: 'TextMaterial'
    });

    const textMesh = new THREE.Mesh(textGeo, textMat);
    preview.textMesh = textMesh;
    preview.scene.add(textMesh);

    // Create pill background
    if (textGeo.boundingBox) {
      const { min, max } = textGeo.boundingBox;
      const textWidth = max.x - min.x;
      const textHeight = max.y - min.y;
      const padding = selectedProduct.background.padding;
      const width = textWidth + padding * 2;
      const height = textHeight + padding * 2;
      const radius = height / 2;

      const shape = new THREE.Shape();
      const x = -width / 2;
      const y = -height / 2;

      shape.moveTo(x + radius, y);
      shape.lineTo(x + width - radius, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + radius);
      shape.lineTo(x + width, y + height - radius);
      shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      shape.lineTo(x + radius, y + height);
      shape.quadraticCurveTo(x, y + height, x, y + height - radius);
      shape.lineTo(x, y + radius);
      shape.quadraticCurveTo(x, y, x + radius, y);

      const pillGeo = new THREE.ExtrudeGeometry(shape, {
        depth: selectedProduct.background.thickness,
        bevelEnabled: false,
      });

      const pillMat = new THREE.MeshPhongMaterial({ 
        color: preview.theme.background,
        name: 'BackgroundMaterial'
      });

      const pillMesh = new THREE.Mesh(pillGeo, pillMat);
      preview.pillMesh = pillMesh;
      preview.scene.add(pillMesh);

      // Position text above pill
      const textZ = selectedProduct.background.thickness - selectedProduct.text.overlap + 
                    (selectedProduct.text.thickness + selectedProduct.text.overlap) / 2;
      textMesh.position.z = textZ;
    }

    // Render the preview
    if (preview.renderer && preview.camera) {
      preview.renderer.render(preview.scene, preview.camera);
    }
  };

  // Animation loop for previews
  useEffect(() => {
    const animate = () => {
      previews.forEach(preview => {
        if (preview.scene && preview.camera && preview.renderer && 
            preview.textMesh && preview.pillMesh) {
          
          // Rotate previews slowly
          preview.textMesh.rotation.y += 0.01;
          preview.pillMesh.rotation.y += 0.01;
          
          preview.renderer.render(preview.scene, preview.camera);
        }
      });
      requestAnimationFrame(animate);
    };
    animate();
  }, [previews]);

  if (!selectedProduct) return null;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      margin: '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <h2 style={{
        color: '#ffffff',
        fontSize: '24px',
        marginBottom: '20px',
        textAlign: 'center',
        fontFamily: '"Press Start 2P", system-ui'
      }}>
        Choose Your Theme
      </h2>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '20px',
        maxHeight: '600px',
        overflowY: 'auto',
        padding: '10px'
      }}>
        {previews.map((preview) => (
          <div
            key={preview.theme.name}
            onClick={() => onThemeSelect(preview.theme)}
            onMouseEnter={() => setHoveredTheme(preview.theme.name)}
            onMouseLeave={() => setHoveredTheme(null)}
            style={{
              background: selectedTheme?.name === preview.theme.name 
                ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
                : hoveredTheme === preview.theme.name
                ? 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'
                : 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform: hoveredTheme === preview.theme.name ? 'translateY(-4px)' : 'translateY(0)',
              boxShadow: hoveredTheme === preview.theme.name 
                ? '0 8px 25px rgba(0,0,0,0.4)' 
                : '0 4px 15px rgba(0,0,0,0.3)',
              border: selectedTheme?.name === preview.theme.name 
                ? '3px solid #3498db' 
                : '2px solid transparent'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <canvas
                ref={preview.canvasRef}
                style={{
                  width: '200px',
                  height: '150px',
                  borderRadius: '8px',
                  border: '2px solid #1a252f'
                }}
              />
              
              <div style={{
                textAlign: 'center',
                color: '#ffffff'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: '0 0 4px 0',
                  fontFamily: '"Press Start 2P", system-ui'
                }}>
                  {preview.theme.name}
                </h3>
                <p style={{
                  fontSize: '12px',
                  margin: '0',
                  opacity: 0.8,
                  fontFamily: 'system-ui'
                }}>
                  {preview.theme.tags.join(', ')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
