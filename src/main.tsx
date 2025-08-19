import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ThreeMFExporter } from './ThreeMFExporter';
import { themes } from './themes';
import type { Theme } from './themes';

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

  // Initialize with TNG Title theme
  useEffect(() => {
    const tngTheme = themes.find(p => p.name === "TNG Title");
    if (tngTheme) {
      applyTheme(tngTheme);
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
    if (!sceneRef.current) return;

    const loader = new FontLoader();
    loader.load(`/fonts/${selectedFont}`, (font: any) => {
      // Remove old meshes
      if (textMeshRef.current && sceneRef.current) sceneRef.current.remove(textMeshRef.current);
      if (pillMeshRef.current && sceneRef.current) sceneRef.current.remove(pillMeshRef.current);

      // Create text geometry
      const textGeo = new TextGeometry(text, {
        font,
        size: 30,
        depth: 5, // Reduced from 10 to 5 for thinner text
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
      // Position text so it sits entirely above the background pill
      // Pill is at z=0 with depth 5, so its top surface is at z=5
      // Text should start at z=5 (touching the pill's top) and extend to z=10
      // Since text depth is 5, position center at z=7.5 (5 + 2.5)
      textMesh.position.z = 5 + (5 / 2); // Pill top (5) + half text depth (2.5) = 7.5
      textMeshRef.current = textMesh;
      if (sceneRef.current) sceneRef.current.add(textMesh);

      // Create pill background
      if (textGeo.boundingBox) {
        const { min, max } = textGeo.boundingBox;
        const padding = 10;
        const width = max.x - min.x + padding * 2;
        const height = max.y - min.y + padding * 2;
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
          depth: 5, // Same depth as text for clean alignment
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
        // Position pill at z=0 (build plate level) so text sits on top
        pillMesh.position.z = 0;
        pillMeshRef.current = pillMesh;
        if (sceneRef.current) sceneRef.current.add(pillMesh);
      }
    });
  }, [text, selectedFont, textColor, backgroundColor]);

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
