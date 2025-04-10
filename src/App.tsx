import React, { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { parse, Font } from 'opentype.js';
import * as THREE from 'three';
import { TextModel } from './components/TextModel';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white">Loading 3D viewer...</div>
    </div>
  );
}

interface TextSegment {
  text: string;
  outerOffset: number;
  innerOffset: number;
  xOffset: number;
  yOffset: number;
}

function splitTextByCaseAndCreateSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentSegment = '';
  let isCurrentUpper = false;
  let currentX = 0;
  const fontScale = 72; // Match the scale used in TextModel
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isUpper = char === char.toUpperCase() && char !== char.toLowerCase(); // Better case detection
    
    if (i === 0 || isUpper !== isCurrentUpper) {
      if (currentSegment) {
        segments.push({
          text: currentSegment,
          outerOffset: 0.75,
          innerOffset: 0.5,
          xOffset: currentX,
          yOffset: 0
        });
        // Advance X position by the width of the segment
        currentX += segments[segments.length - 1].text.length * fontScale * 0.5; // Approximate width
      }
      currentSegment = char;
      isCurrentUpper = isUpper;
    } else {
      currentSegment += char;
    }
  }
  
  if (currentSegment) {
    segments.push({
      text: currentSegment,
      outerOffset: 0.75,
      innerOffset: 0.5,
      xOffset: currentX,
      yOffset: 0
    });
  }
  
  // Calculate total width
  const totalWidth = segments.reduce((sum, segment) => sum + segment.text.length * fontScale * 0.5, 0);
  
  // Center all segments by offsetting by half the total width
  const centerOffset = totalWidth / 2;
  segments.forEach(segment => {
    segment.xOffset -= centerOffset;
  });
  
  return segments;
}

function App() {
  const [text, setText] = useState('Hello');
  const [segments, setSegments] = useState<TextSegment[]>(splitTextByCaseAndCreateSegments('Hello'));
  const [font, setFont] = useState<Font | null>(null);
  const [scale, setScale] = useState(1);
  const [foregroundDepth, setForegroundDepth] = useState(1);
  const [backgroundDepth, setBackgroundDepth] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number; depth: number } | null>(null);
  const [referenceTexture, setReferenceTexture] = useState<THREE.Texture | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDefaultFont();
  }, []);

  useEffect(() => {
    setSegments(splitTextByCaseAndCreateSegments(text));
  }, [text]);

  // Create reference texture for complete text
  useEffect(() => {
    if (!font) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = 'black';
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

  const updateSegment = (index: number, updates: Partial<TextSegment>) => {
    setSegments(prevSegments => {
      const newSegments = [...prevSegments];
      newSegments[index] = { ...newSegments[index], ...updates };
      return newSegments;
    });
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
        <div className="w-96 bg-white shadow-lg p-6 space-y-6 overflow-y-auto">
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
                step="0.1"
                value={backgroundDepth}
                onChange={(e) => setBackgroundDepth(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Text Segments</h3>
            
            <div className="space-y-6">
              {segments.map((segment, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-md space-y-3">
                  <div className="font-medium text-gray-700">Segment: "{segment.text}"</div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Outer Offset (mm)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.05"
                      value={segment.outerOffset}
                      onChange={(e) => updateSegment(index, { outerOffset: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inner Offset (mm)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.05"
                      value={segment.innerOffset}
                      onChange={(e) => updateSegment(index, { innerOffset: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      X Position Offset (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={segment.xOffset}
                      onChange={(e) => updateSegment(index, { xOffset: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Y Position Offset (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={segment.yOffset}
                      onChange={(e) => updateSegment(index, { yOffset: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Specifications</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Foreground depth: {foregroundDepth}mm</li>
              <li>• Background depth: {backgroundDepth}mm</li>
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
              camera={{ position: [0, 0, 200], fov: 50 }}
              style={{ background: '#111827' }}
            >
              <color attach="background" args={['white']} />
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <directionalLight position={[-10, -10, -5]} intensity={0.5} />
              <OrbitControls />
              
              {/* Reference plane for complete text */}
              {font && referenceTexture && dimensions && (
                <mesh position={[0, dimensions.height + 5, 0]} rotation={[0, 0, 0]}>
                  <planeGeometry args={[60, 60 / (dimensions.width / dimensions.height)]} />
                  <meshBasicMaterial map={referenceTexture} transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
              )}
              
              {/* Text segments */}
              {font && segments.map((segment, index) => (
                <TextModel
                  key={index}
                  text={segment.text}
                  font={font}
                  scale={scale}
                  foregroundDepth={foregroundDepth}
                  backgroundDepth={backgroundDepth}
                  outerOffset={segment.outerOffset}
                  innerOffset={segment.innerOffset}
                  xOffset={segment.xOffset}
                  yOffset={segment.yOffset}
                  onDimensionsChange={index === 0 ? setDimensions : undefined}
                />
              ))}
            </Canvas>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default App;