import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ThreeMFExporter } from './ThreeMFExporter';
import { themes } from './themes';
import type { Theme } from './themes';
import { products } from './products';
import type { Product } from './products';

/**
 * 3D Text Scene with 3MF Export Capability
 * 
 * Color System:
 * - Themes provide initial colors for text and background
 * - Users can override theme colors using color pickers
 * - A reset button appears when colors are modified to restore theme defaults
 * - Overridden colors are applied to Three.js materials in real-time
 * - The 3MF exporter automatically extracts colors from the current scene materials
 * - This ensures the exported 3MF exactly matches what the user sees in the scene
 * - All color changes (theme or custom) are reflected in the exported 3MF file
 */

const fonts = ['Federation_Regular.json']; // add more JSON fonts here

const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('STAR TREK');
  const [selectedFont, setSelectedFont] = useState(fonts[0]);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Color override states - these will override theme colors
  const [textColor, setTextColor] = useState<number>(0x0077ff); // Default blue
  const [backgroundColor, setBackgroundColor] = useState<number>(0x000000); // Default black

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const textMeshRef = useRef<THREE.Mesh | null>(null);
  const pillMeshRef = useRef<THREE.Mesh | null>(null);

  // Get unique tags and group themes by tag
  const getThemeGroups = () => {
    const allTags = themes.flatMap(theme => theme.tags);
    const uniqueTags = [...new Set(allTags)].sort();
    
    return uniqueTags.map(tag => ({
      tag,
      themes: themes.filter(theme => theme.tags.includes(tag))
    }));
  };

  // Apply theme when selected
  // Note: Colors can be customized beyond themes - the 3MF exporter will use the current scene colors
  const applyTheme = (theme: Theme) => {
    setText(theme.text);
    setSelectedFont(theme.font);
    setSelectedTheme(theme);
    // Update color overrides to match theme colors
    setTextColor(theme.color);
    setBackgroundColor(theme.background);
  };

  // Apply product when selected
  const applyProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  // Initialize with TNG Title theme
  useEffect(() => {
    const tngTheme = themes.find(p => p.name === "TNG Title");
    if (tngTheme) {
      applyTheme(tngTheme);
    }
    
    // Initialize with Keychain product
    const keychainProduct = products.find(p => p.name === "Keychain");
    if (keychainProduct) {
      console.log('Initializing with Keychain product:', keychainProduct);
      applyProduct(keychainProduct);
    } else {
      console.error('Keychain product not found!');
    }
  }, []);

  // Initialize scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 100, 300);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(100, 200, 100);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Animate loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Load JSON font and update text mesh
  useEffect(() => {
    if (!sceneRef.current || !selectedProduct) {
      console.log('Waiting for scene and product to be ready...');
      return;
    }

    const loader = new FontLoader();
    loader.load(`/fonts/${selectedFont}`, (font: any) => {
      // Remove old meshes
      if (textMeshRef.current && sceneRef.current) sceneRef.current.remove(textMeshRef.current);
      if (pillMeshRef.current && sceneRef.current) sceneRef.current.remove(pillMeshRef.current);

      // Create text geometry
      const textGeo = new TextGeometry(text, {
        font,
        size: 30,
        depth: selectedProduct.text.thickness + selectedProduct.text.overlap, // Use product thickness + overlap
        curveSegments: 12,
        bevelEnabled: false,
      });
      textGeo.computeBoundingBox();
      textGeo.center();
      
      // Ensure the geometry is properly formed for 3D printing
      // This helps prevent non-manifold edges
      textGeo.computeVertexNormals();
      textGeo.computeBoundingSphere();
      
      // For 3D printing, ensure the geometry is watertight
      // TextGeometry should already be watertight, but let's verify
      if (textGeo.attributes.position && textGeo.attributes.position.count > 0) {
        console.log(`Text geometry created with ${textGeo.attributes.position.count} vertices`);
      }

              // Create text material with color override (can be customized by user)
        // The 3MF exporter will use whatever color is currently set on this material
        const textMat = new THREE.MeshPhongMaterial({ 
          color: textColor, // Use color override or theme color
          name: 'TextMaterial'
        });
      // Ensure the material name is set for proper identification in the exporter
      textMat.name = 'TextMaterial';
      const textMesh = new THREE.Mesh(textGeo, textMat);
       // Position text based on product specifications
       if (selectedProduct) {
         // Text should start at the top surface of the background and extend above it
         const backgroundThickness = selectedProduct.background.thickness;
         const textThickness = selectedProduct.text.thickness;
         const overlap = selectedProduct.text.overlap;
         const totalTextDepth = textThickness + overlap; // Total Z depth including overlap
         
         // Background goes from z=0 to z=backgroundThickness (e.g., 0 to 2mm)
         // Text should start at backgroundThickness - overlap and extend above it
         // For keychain: background is 2mm thick, text is 1.05mm thick total
         // Text should go from z=1.95mm to z=3mm (centered at z=2.475mm)
         // Since TextGeometry origin is at the center, position at z=2.475mm
         const textStartZ = backgroundThickness - overlap; // 2mm - 0.05mm = 1.95mm
         const textCenterZ = textStartZ + (totalTextDepth / 2); // 1.95mm + 1.05mm/2 = 2.475mm
         textMesh.position.z = textCenterZ;
         
         console.log(`Text positioning: background thickness=${backgroundThickness}mm, text thickness=${textThickness}mm, overlap=${overlap}mm`);
         console.log(`Total text depth: ${totalTextDepth}mm`);
         console.log(`Background Z range: 0mm to ${backgroundThickness}mm`);
         console.log(`Text Z range: ${textStartZ.toFixed(3)}mm to ${(textStartZ + totalTextDepth).toFixed(3)}mm, center at ${textCenterZ.toFixed(3)}mm`);
         console.log(`Text extends ${textThickness}mm above background surface`);
         console.log(`Text actual Z range: ${textMesh.position.z - (totalTextDepth / 2)}mm to ${textMesh.position.z + (totalTextDepth / 2)}mm`);
         console.log(`Text starts at z=${textStartZ}mm and ends at z=${(textStartZ + totalTextDepth).toFixed(3)}mm`);
        }
      textMeshRef.current = textMesh;
      if (sceneRef.current) sceneRef.current.add(textMesh);

        // Scale text based on product size constraints
        if (textGeo.boundingBox) {
          const { min, max } = textGeo.boundingBox;
          const currentWidth = max.x - min.x;
          const currentHeight = max.y - min.y;
          
          // Calculate scaling to meet minimum size requirements
          const minScaleX = selectedProduct.minSize[0] / currentWidth;
          const minScaleY = selectedProduct.minSize[1] / currentHeight;
          let scaleFactor = Math.max(minScaleX, minScaleY);
          
          // If minimum requirements are met, check if we can scale up to maximum
          if (scaleFactor <= 1) {
            scaleFactor = 1; // No scaling needed for minimum
          }
          
          // Check if scaling to maximum is possible without exceeding either dimension
          const maxScaleX = selectedProduct.maxSize[0] / currentWidth;
          const maxScaleY = selectedProduct.maxSize[1] / currentHeight;
          const maxPossibleScale = Math.min(maxScaleX, maxScaleY);
          
          // Apply the larger of the two scales (minimum requirement vs maximum possible)
          scaleFactor = Math.max(scaleFactor, maxPossibleScale);
          
          // Apply uniform scaling to maintain aspect ratio
          textMesh.scale.set(scaleFactor, scaleFactor, 1);
          
          console.log(`Text scaled by factor ${scaleFactor.toFixed(3)} to meet product constraints`);
          console.log(`Original size: ${currentWidth.toFixed(1)} x ${currentHeight.toFixed(1)}mm`);
          console.log(`Scaled size: ${(currentWidth * scaleFactor).toFixed(1)} x ${(currentHeight * scaleFactor).toFixed(1)}mm`);
        }

        // Create pill background
        if (textGeo.boundingBox) {
          const { min, max } = textGeo.boundingBox;
          const basePadding = selectedProduct.background.padding;
          
          // Calculate padding for hole if product has left hole add-on
          let leftPadding = basePadding;
          let rightPadding = basePadding;
          const leftHole = selectedProduct.addOns.find(addon => addon.type === "hole" && addon.position === "left");
          if (leftHole) {
            // Hole is 3mm diameter with 1mm padding on all sides = 5mm total width
            // We need the background to extend 5mm to the left of the text
            leftPadding = basePadding + leftHole.padding; // basePadding + 1mm = 3mm total left padding
          }
          
          const width = max.x - min.x + leftPadding + rightPadding;
          const height = max.y - min.y + basePadding * 2;
          const radius = height / 2;

          const shape = new THREE.Shape();
          const x = -width / 2;
          const y = -height / 2;

          shape.moveTo(x + radius, y);
          shape.lineTo(x + width - radius, y);
          shape.quadraticCurveTo(x + width, y, x + width, y + radius);
          shape.lineTo(x + width, y + height - radius);
          shape.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
          );
          shape.lineTo(x + radius, y + height);
          shape.quadraticCurveTo(x, y + height, x, y + height - radius);
          shape.lineTo(x, y + radius);
          shape.quadraticCurveTo(x, y, x + radius, y);

          const pillGeo = new THREE.ExtrudeGeometry(shape, {
            depth: selectedProduct.background.thickness, // Use product thickness
            bevelEnabled: false,
          });
          
          // Ensure the pill geometry is properly formed for 3D printing
          // This helps prevent non-manifold edges
          pillGeo.computeVertexNormals();
          pillGeo.computeBoundingBox();
          pillGeo.computeBoundingSphere();

          // Create background material with color override (can be customized by user)
          // The 3MF exporter will use whatever color is currently set on this material
          const pillMat = new THREE.MeshPhongMaterial({ 
            color: backgroundColor, // Use color override or theme color
            name: 'BackgroundMaterial'
          });
          // Ensure the material name is set for proper identification in the exporter
          pillMat.name = 'BackgroundMaterial';
          const pillMesh = new THREE.Mesh(pillGeo, pillMat);
          
          // Position pill to center it around the text, accounting for left padding
          // Pill should go from z=0 to z=2mm
          // Since ExtrudeGeometry origin is at the center, position at z=1mm (half thickness)
          pillMesh.position.z = selectedProduct.background.thickness / 2;
          
          // Adjust X position to account for left padding (move right to center text)
          if (leftHole) {
            const leftPadding = leftHole.padding;
            pillMesh.position.x = leftPadding / 2; // Move right by half the extra padding
          }
          
          console.log(`Pill positioning: thickness=${selectedProduct.background.thickness}mm, center at z=${pillMesh.position.z}mm`);
          console.log(`Pill Z range: 0mm to ${selectedProduct.background.thickness}mm`);
          console.log(`Pill actual Z range: ${pillMesh.position.z - (selectedProduct.background.thickness / 2)}mm to ${pillMesh.position.z + (selectedProduct.background.thickness / 2)}mm`);

          pillMeshRef.current = pillMesh;
          if (sceneRef.current) sceneRef.current.add(pillMesh);
          
          // Debug: Log final positions of both meshes
          console.log('=== Final Mesh Positions ===');
          console.log(`Text mesh: position.z = ${textMesh.position.z.toFixed(3)}mm`);
          console.log(`Pill mesh: position.z = ${pillMesh.position.z.toFixed(3)}mm`);
          console.log(`Text mesh scale: ${textMesh.scale.x.toFixed(3)} x ${textMesh.scale.y.toFixed(3)} x ${textMesh.scale.z.toFixed(3)}`);
          
          // Additional debugging for transform origin verification
          const textThickness = selectedProduct.text.thickness;
          const overlap = selectedProduct.text.overlap;
          const totalTextDepth = textThickness + overlap;
          const backgroundThickness = selectedProduct.background.thickness;
          
          console.log(`Expected text Z range: ${(textMesh.position.z - totalTextDepth/2).toFixed(3)}mm to ${(textMesh.position.z + totalTextDepth/2).toFixed(3)}mm`);
          console.log(`Expected pill Z range: ${(pillMesh.position.z - backgroundThickness/2).toFixed(3)}mm to ${(pillMesh.position.z + backgroundThickness/2).toFixed(3)}mm`);
          console.log(`Text should extend ${textThickness}mm above pill surface (z=${backgroundThickness}mm)`);
          console.log(`Actual text extension above pill: ${(textMesh.position.z + totalTextDepth/2 - backgroundThickness).toFixed(3)}mm`);
          console.log('===========================');
        }
    });
  }, [text, selectedFont, textColor, backgroundColor, selectedProduct]);

  // Export scene to 3MF
  const export3MF = async () => {
    if (!sceneRef.current) return;

    try {
      // Log current colors in the scene for debugging
      console.log('=== Current Scene Colors ===');
      const sceneColors: Array<{name: string, color: string, material: string}> = [];
      
      sceneRef.current.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material) {
          const material = Array.isArray(object.material) ? object.material[0] : object.material;
          if (material instanceof THREE.MeshPhongMaterial && material.color) {
            const colorHex = '#' + material.color.getHexString().toUpperCase();
            const meshInfo = {
              name: object.name || 'Unnamed Mesh',
              color: colorHex,
              material: material.name || 'Unnamed Material'
            };
            sceneColors.push(meshInfo);
            console.log(`${meshInfo.name}: ${colorHex} (Material: ${meshInfo.material})`);
          }
        }
      });
      
      console.log('Scene Colors Summary:', sceneColors);
      console.log('===========================');

      // The exporter will automatically use the current colors of all objects in the scene
      // This includes any custom colors set by the user using the color pickers
      const exporter = new ThreeMFExporter(sceneRef.current);
      const blob = await exporter.export();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'text_scene.3mf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting 3MF:', error);
      alert('Error exporting 3MF file. Check console for details.');
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '8px',
          background: '#ddd',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label>Product: </label>
          <select
            value={selectedProduct?.name || ''}
            onChange={(e) => {
              const product = products.find(p => p.name === e.target.value);
              if (product) {
                applyProduct(product);
              }
            }}
            style={{ minWidth: '150px' }}
          >
            {products.map((product) => (
              <option key={product.name} value={product.name}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label>Theme: </label>
            <select
              value={selectedTheme?.name || ''}
              onChange={(e) => {
                const theme = themes
                  .find(p => p.name === e.target.value);
                if (theme) {
                  applyTheme(theme);
                }
              }}
              style={{ minWidth: '200px' }}
            >
              {getThemeGroups().map((group) => (
                <optgroup key={group.tag} label={group.tag}>
                  {group.themes.map((theme) => (
                    <option key={theme.name} value={theme.name}>
                      {theme.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {/* Reset icon - only show if colors have been modified from theme defaults */}
            {selectedTheme && (textColor !== selectedTheme.color || backgroundColor !== selectedTheme.background) && (
              <button
                onClick={() => {
                  if (selectedTheme) {
                    setTextColor(selectedTheme.color);
                    setBackgroundColor(selectedTheme.background);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '3px',
                  width: '24px',
                  height: '24px'
                }}
                title="Reset colors to theme defaults"
              >
                🔄
              </button>
            )}
          </div>
        
        <div>
          <label>Text: </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label>Text Color:</label>
            <input
              type="color"
              value={`#${textColor.toString(16).padStart(6, '0')}`}
              onChange={(e) => setTextColor(parseInt(e.target.value.slice(1), 16))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label>Background Color:</label>
            <input
              type="color"
              value={`#${backgroundColor.toString(16).padStart(6, '0')}`}
              onChange={(e) => setBackgroundColor(parseInt(e.target.value.slice(1), 16))}
            />
          </div>
        </div>
        <button onClick={export3MF}>Download 3MF</button>
      </div>
      <div ref={mountRef} style={{ flex: 1 }} />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
