import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ThreeMFExporter } from './ThreeMFExporter';
import { presets } from './presets';
import type { Preset } from './presets';

const fonts = ['Federation_Regular.json']; // add more JSON fonts here

const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('STAR TREK');
  const [selectedFont, setSelectedFont] = useState(fonts[0]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const textMeshRef = useRef<THREE.Mesh | null>(null);
  const pillMeshRef = useRef<THREE.Mesh | null>(null);

  // Get unique tags and group presets by tag
  const getPresetGroups = () => {
    const allTags = presets.flatMap(preset => preset.tags);
    const uniqueTags = [...new Set(allTags)].sort();
    
    return uniqueTags.map(tag => ({
      tag,
      presets: presets.filter(preset => preset.tags.includes(tag))
    }));
  };

  // Apply preset when selected
  const applyPreset = (preset: Preset) => {
    setText(preset.text);
    setSelectedFont(preset.font);
    setSelectedPreset(preset);
  };

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

      const textMat = new THREE.MeshPhongMaterial({ 
        color: selectedPreset?.color || 0x0077ff, // Use preset color or default blue
        name: 'TextMaterial'
      });
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
        const pillMat = new THREE.MeshPhongMaterial({ 
          color: selectedPreset?.background || 0x000000, // Use preset background or default black
          name: 'BackgroundMaterial'
        });
        const pillMesh = new THREE.Mesh(pillGeo, pillMat);
        // Position pill at z=0 (build plate level) so text sits on top
        pillMesh.position.z = 0;
        pillMeshRef.current = pillMesh;
        if (sceneRef.current) sceneRef.current.add(pillMesh);
      }
    });
  }, [text, selectedFont, selectedPreset]);

  // Export scene to 3MF
  const export3MF = async () => {
    if (!sceneRef.current) return;

    try {
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
        <div>
          <label>Preset: </label>
          <select
            value={selectedPreset?.name || ''}
            onChange={(e) => {
              const preset = presets
                .find(p => p.name === e.target.value);
              if (preset) {
                applyPreset(preset);
              }
            }}
            style={{ minWidth: '200px' }}
          >
            <option value="">Select a preset...</option>
            {getPresetGroups().map((group) => (
              <optgroup key={group.tag} label={group.tag}>
                {group.presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label>Font: </label>
          <select
            value={selectedFont}
            onChange={(e) => setSelectedFont(e.target.value)}
          >
            {fonts.map((f) => (
              <option key={f} value={f}>
                {f.replace('.json', '')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Text: </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button onClick={export3MF}>Download 3MF</button>
      </div>
      <div ref={mountRef} style={{ flex: 1 }} />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
