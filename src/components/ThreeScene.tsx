import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { TextStyle } from '../types/Style';
import { TextMeshGenerator } from '../utils/textMeshGenerator';
import { fontLoader } from '../utils/fontLoader';
import { Loader, RotateCcw } from 'lucide-react';

interface ThreeSceneProps {
  text: string;
  style: TextStyle;
  onSceneReady: (scene: THREE.Scene) => void;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({ text, style, onSceneReady }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 50, 100);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-50, 30, -50);
    scene.add(directionalLight2);

    // Basic mouse controls
    let mouseX = 0, mouseY = 0;
    const handleMouseMove = (event: MouseEvent) => {
      if (event.buttons === 1) { // Left mouse button
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        scene.rotation.y += deltaX * 0.01;
        scene.rotation.x += deltaY * 0.01;
        scene.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, scene.rotation.x));
      }
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    onSceneReady(scene);

    // Handle resize
    const handleResize = () => {
      if (mountRef.current && camera && renderer) {
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onSceneReady]);

  useEffect(() => {
    const generateMesh = async () => {
      if (!sceneRef.current || !text.trim()) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // Clear existing meshes
        const objectsToRemove: THREE.Object3D[] = [];
        sceneRef.current.traverse((child) => {
          if (child.userData.isTextMesh) {
            objectsToRemove.push(child);
          }
        });
        objectsToRemove.forEach(obj => sceneRef.current!.remove(obj));

        // Load font and generate mesh
        const font = await fontLoader.loadFont(style.fontUrl);
        const generator = new TextMeshGenerator(sceneRef.current);
        const result = await generator.generateTextMesh(text, font, style);
        console.log('Mesh generation completed:', result);


      } catch (err) {
        console.error('Error generating mesh:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate 3D text');
      } finally {
        setIsLoading(false);
      }
    };

    generateMesh();
  }, [text, style]);

  const resetCamera = () => {
    if (sceneRef.current) {
      sceneRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
          <div className="flex items-center space-x-3 text-white">
            <Loader className="w-6 h-6 animate-spin" />
            <span>Generating 3D model...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-4 right-4 p-3 bg-red-600 text-white rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={resetCamera}
        className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 
                   text-white rounded-lg transition-colors duration-200"
        title="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        Click and drag to rotate • Use mouse wheel to zoom
      </div>
    </div>
  );
};