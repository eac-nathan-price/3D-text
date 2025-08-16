declare module './3MFExporter' {
  import * as THREE from 'three';
  export class ThreeMFExporter {
    parse(sceneOrMeshes: THREE.Object3D | THREE.Object3D[]): string;
  }
}
