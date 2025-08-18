import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';

export interface ExportOptions {
  upAxis: 'X_UP' | 'Y_UP' | 'Z_UP';
  unit: string;
}

export class ThreeMFExporter {
  private scene: THREE.Scene;
  private options: ExportOptions;

  constructor(scene: THREE.Scene, options: Partial<ExportOptions> = {}) {
    this.scene = scene;
    this.options = {
      upAxis: 'Y_UP',
      unit: 'millimeter',
      ...options
    };
  }

  async export(): Promise<Blob> {
    this.scene.updateMatrixWorld(true);

    const meshes: THREE.Mesh[] = [];
    this.scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        meshes.push(object);
      }
    });

    if (meshes.length === 0) {
      throw new Error('No meshes found in scene');
    }

    // Debug: Log materials found
    console.log('Found meshes:', meshes.length);
    meshes.forEach((mesh, index) => {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      let color = 'N/A';
      if (material instanceof THREE.MeshBasicMaterial || 
          material instanceof THREE.MeshPhongMaterial || 
          material instanceof THREE.MeshStandardMaterial) {
        color = material.color ? '#' + material.color.getHexString() : 'N/A';
      }
      console.log(`Mesh ${index}:`, mesh.name, 'Material:', material.name, 'Color:', color);
    });

    const modelContent = this.generateModelXML(meshes);
    const relsContent = this.generateRelsXML();
    const contentTypesContent = this.generateContentTypesXML();

    const files: Record<string, Uint8Array> = {};
    files['[Content_Types].xml'] = strToU8(contentTypesContent);
    files['_rels/.rels'] = strToU8(relsContent);
    files['3D/3dmodel.model'] = strToU8(modelContent);

    const zipData = zipSync(files, { level: 8 });
    return new Blob([zipData], { type: 'application/3mf' });
  }

  private generateModelXML(meshes: THREE.Mesh[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<model unit="' + this.options.unit + '" xml:lang="en-US" ';
    xml += 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ';
    xml += 'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">\n';
    
    xml += this.generateResourcesSection(meshes);
    xml += this.generateBuildSection(meshes);
    
    xml += '</model>';
    return xml;
  }

  private generateResourcesSection(meshes: THREE.Mesh[]): string {
    let xml = ' <resources>\n';
    
    const materialIds = new Map<THREE.Material, number>();
    let materialIdCounter = 0;
    
    meshes.forEach((mesh) => {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!materialIds.has(material)) {
        const materialId = materialIdCounter++;
        materialIds.set(material, materialId);
        xml += this.generateMaterialXML(material, materialId);
      }
    });

    meshes.forEach((_mesh, index) => {
      const material = Array.isArray(_mesh.material) ? _mesh.material[0] : _mesh.material;
      const materialId = materialIds.get(material)!;
      xml += this.generateObjectXML(_mesh, index, materialId);
    });

    xml += ' </resources>\n';
    return xml;
  }

  private generateMaterialXML(material: THREE.Material, materialId: number): string {
    let xml = '  <basematerials id="' + materialId + '">\n';
    
    let color = '#FFFFFF';
    if (material instanceof THREE.MeshBasicMaterial || 
        material instanceof THREE.MeshPhongMaterial || 
        material instanceof THREE.MeshStandardMaterial) {
      if (material.color) {
        color = '#' + material.color.getHexString().toUpperCase();
      }
    }
    
    const name = material.name || material.type || 'Material';
    xml += '   <base name="' + name + '" displaycolor="' + color + '" />\n';
    xml += '  </basematerials>\n';
    
    return xml;
  }

  private generateObjectXML(mesh: THREE.Mesh, objectId: number, materialId: number): string {
    let xml = '  <object id="' + objectId + '" name="' + (mesh.name || 'Object_' + objectId) + '" type="model">\n';
    xml += '   <mesh>\n';
    
    xml += this.generateVerticesXML(mesh.geometry);
    xml += this.generateTrianglesXML(mesh.geometry, materialId);
    
    xml += '   </mesh>\n';
    xml += '  </object>\n';
    
    return xml;
  }

  private generateVerticesXML(geometry: THREE.BufferGeometry): string {
    const positions = geometry.attributes.position;
    if (!positions) {
      throw new Error('Geometry has no position attribute');
    }

    let xml = '    <vertices>\n';
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      const coords = this.transformCoordinates(x, y, z);
      xml += `     <vertex x="${coords.x.toFixed(6)}" y="${coords.y.toFixed(6)}" z="${coords.z.toFixed(6)}" />\n`;
    }
    
    xml += '    </vertices>\n';
    return xml;
  }

  private generateTrianglesXML(geometry: THREE.BufferGeometry, materialId: number): string {
    let xml = '    <triangles>\n';
    
    if (geometry.index) {
      const indices = geometry.index;
      for (let i = 0; i < indices.count; i += 3) {
        const v1 = indices.getX(i);
        const v2 = indices.getX(i + 1);
        const v3 = indices.getX(i + 2);
        xml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${materialId}" />\n`;
      }
    } else {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 3) {
        const v1 = i;
        const v2 = i + 1;
        const v3 = i + 2;
        xml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${materialId}" />\n`;
      }
    }
    
    xml += '    </triangles>\n';
    return xml;
  }

  private generateBuildSection(meshes: THREE.Mesh[]): string {
    let xml = ' <build>\n';
    
    meshes.forEach((_mesh, index) => {
      xml += '  <item objectid="' + index + '" />\n';
    });
    
    xml += ' </build>\n';
    return xml;
  }

  private generateRelsXML(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';
    xml += ' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
    xml += '</Relationships>';
    return xml;
  }

  private generateContentTypesXML(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n';
    xml += ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n';
    xml += ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n';
    xml += '</Types>';
    return xml;
  }

  private transformCoordinates(x: number, y: number, z: number): { x: number, y: number, z: number } {
    if (this.options.upAxis === 'Y_UP') {
      return { x, y, z };
    } else if (this.options.upAxis === 'Z_UP') {
      return { x, z, y: -y };
    } else if (this.options.upAxis === 'X_UP') {
      return { y, z, x };
    } else {
      return { x, y, z };
    }
  }
}

export async function exportSceneTo3MF(
  scene: THREE.Scene, 
  options: Partial<ExportOptions> = {}
): Promise<Blob> {
  const exporter = new ThreeMFExporter(scene, options);
  return exporter.export();
}
