import * as THREE from 'three';

export class ThreeMFExporter {
  export(scene: THREE.Scene, filename: string = 'text-model.3mf'): void {
    // Create a simple STL-like format for now (3MF is complex)
    // In a production app, you'd use a proper 3MF library
    const stlContent = this.generateSTL(scene);
    this.downloadFile(stlContent, filename.replace('.3mf', '.stl'), 'application/octet-stream');
  }

  private generateSTL(scene: THREE.Scene): string {
    let stl = 'solid TextModel\n';
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry) {
        const geometry = object.geometry;
        const matrix = object.matrixWorld;
        
        if (geometry.attributes.position) {
          const positions = geometry.attributes.position.array;
          const indices = geometry.index ? geometry.index.array : null;
          
          if (indices) {
            for (let i = 0; i < indices.length; i += 3) {
              const i1 = indices[i] * 3;
              const i2 = indices[i + 1] * 3;
              const i3 = indices[i + 2] * 3;
              
              const v1 = new THREE.Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]).applyMatrix4(matrix);
              const v2 = new THREE.Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]).applyMatrix4(matrix);
              const v3 = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]).applyMatrix4(matrix);
              
              const normal = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(v2, v1),
                new THREE.Vector3().subVectors(v3, v1)
              ).normalize();
              
              stl += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
              stl += '    outer loop\n';
              stl += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`;
              stl += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`;
              stl += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(6)} ${v3.z.toFixed(6)}\n`;
              stl += '    endloop\n';
              stl += '  endfacet\n';
            }
          }
        }
      }
    });
    
    stl += 'endsolid TextModel\n';
    return stl;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}