import React, { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { parse, Font } from 'opentype.js';
import { TextModel } from './components/TextModel';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white">Loading 3D viewer...</div>
    </div>
  );
}

function App() {
  const [text, setText] = useState('Hello');
  const [font, setFont] = useState<Font | null>(null);
  const [scale, setScale] = useState(1);
  const [foregroundDepth, setForegroundDepth] = useState(1);
  const [backgroundDepth, setBackgroundDepth] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number; depth: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default font
  useEffect(() => {
    loadDefaultFont();
  }, []);

  const loadDefaultFont = async () => {
    try {
      const response = await fetch('/fonts/Lucy Said Ok Personal Use.ttf');
      const fontBuffer = await response.arrayBuffer();
      const loadedFont = parse(fontBuffer);
      setFont(loadedFont);
    } catch (err) {
      console.error('Error loading default font:', err);
      setError('Failed to load default font');
    }
  };

  const handleFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const loadedFont = parse(buffer);
      setFont(loadedFont);
      setError(null);
    } catch (err) {
      console.error('Error loading font:', err);
      setError('Failed to load font');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">3D Text Generator</h1>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Controls Panel */}
        <div className="w-80 bg-white shadow-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Input
            </label>
            <div className="flex items-center">
              <span className="text-gray-400 mr-2">Aa</span>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter text..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Font (.ttf)
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <span className="mr-2">📁</span>
              {font ? 'Change Font' : 'Upload Font'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf"
              onChange={handleFontUpload}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              XY Scale
            </label>
            <input
              type="number"
              min="0.5"
              max="5"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foreground Depth (mm)
              </label>
              <input
                type="number"
                min="0.5"
                max="5"
                step="0.1"
                value={foregroundDepth}
                onChange={(e) => setForegroundDepth(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Depth (mm)
              </label>
              <input
                type="number"
                min="0.5"
                max="5"
                step="0.1"
                value={backgroundDepth}
                onChange={(e) => setBackgroundDepth(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Specifications</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Foreground depth: {foregroundDepth}mm</li>
              <li>• Background depth: {backgroundDepth}mm</li>
              <li>• Outline offset: 0.75mm</li>
              {dimensions && (
                <>
                  <li className="pt-2 font-medium">Dimensions:</li>
                  <li>• Width: {dimensions.width.toFixed(1)}mm</li>
                  <li>• Height: {dimensions.height.toFixed(1)}mm</li>
                  <li>• Total depth: {dimensions.depth.toFixed(1)}mm</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* 3D Preview */}
        <div className="flex-1 bg-gray-900">
          <Suspense fallback={<LoadingFallback />}>
            <Canvas
              camera={{ position: [0, 0, 100], fov: 50 }}
              style={{ background: '#111827' }}
            >
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />
              <OrbitControls />
              {font && (
                <TextModel
                  text={text}
                  font={font}
                  scale={scale}
                  foregroundDepth={foregroundDepth}
                  backgroundDepth={backgroundDepth}
                  onDimensionsChange={setDimensions}
                />
              )}
            </Canvas>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default App;