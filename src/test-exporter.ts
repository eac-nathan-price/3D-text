import * as THREE from 'three';
import { ThreeMFExporter } from './ThreeMFExporter';

// Create a simple test scene
const scene = new THREE.Scene();

// Create a simple cube with colored material
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Red
const cube = new THREE.Mesh(geometry, material);
cube.name = 'RedCube';
scene.add(cube);

// Create a sphere with different colored material
const sphereGeometry = new THREE.SphereGeometry(5, 32, 32);
const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Green
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(20, 0, 0);
sphere.name = 'GreenSphere';
scene.add(sphere);

// Test the exporter
async function testExporter() {
  try {
    console.log('Testing 3MF exporter...');
    
    const exporter = new ThreeMFExporter(scene);
    const blob = await exporter.export();
    
    console.log('Export successful!');
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test_scene.3mf';
    a.click();
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Export failed:', error);
  }
}

// Export the test function
export { testExporter };
