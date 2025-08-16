import React, { useState, useCallback } from 'react';
import * as THREE from 'three';
import { ControlPanel } from './components/ControlPanel';
import { ThreeScene } from './components/ThreeScene';
import { predefinedStyles } from './data/styles';
import { ThreeMFExporter } from './utils/3mfExporter';

function App() {
  const [text, setText] = useState('Hello World!');
  const [selectedStyle, setSelectedStyle] = useState(predefinedStyles[0]);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleSceneReady = useCallback((newScene: THREE.Scene) => {
    setScene(newScene);
  }, []);

  const handleExport = useCallback(async () => {
    if (!scene || !text.trim()) return;

    setIsExporting(true);
    try {
      const exporter = new ThreeMFExporter();
      const filename = `${text.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_3d_text.stl`;
      exporter.export(scene, filename);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [scene, text]);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <ControlPanel
        text={text}
        onTextChange={setText}
        styles={predefinedStyles}
        selectedStyle={selectedStyle}
        onStyleChange={setSelectedStyle}
        onExport={handleExport}
        isExporting={isExporting}
      />
      
      <div className="flex-1 p-6">
        <div className="w-full h-full max-h-[calc(100vh-3rem)]">
          <ThreeScene
            text={text}
            style={selectedStyle}
            onSceneReady={handleSceneReady}
          />
        </div>
      </div>
    </div>
  );
}

export default App;