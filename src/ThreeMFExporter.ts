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

    // Create files object for the 3MF package
    const files: { [key: string]: Uint8Array } = {};

    // Add main 3D model file
    files['3D/3dmodel.model'] = strToU8(this.generateMainModelXML(meshes));

    // Add single combined geometry file (like the working version)
    files['3D/Objects/object_1.model'] = strToU8(this.generateCombinedGeometryXML(meshes));

    // Add metadata files
    files['Metadata/model_settings.config'] = strToU8(this.generateModelSettingsXML(meshes));
    files['Metadata/project_settings.config'] = strToU8(this.generateProjectSettingsXML(meshes));
    files['Metadata/cut_information.xml'] = strToU8(this.generateCutInformationXML());
    files['Metadata/slice_info.config'] = strToU8(this.generateSliceInfoXML());

    // Add relationship files
    files['_rels/.rels'] = strToU8(this.generateRelsXML());
    files['3D/_rels/3dmodel.model.rels'] = strToU8(this.generateModelRelsXML());

    // Add content types file
    files['[Content_Types].xml'] = strToU8(this.generateContentTypesXML());

    // Create the 3MF package
    const zip = zipSync(files);
    return new Blob([zip], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
  }

  private generateMainModelXML(meshes: THREE.Mesh[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<model unit="' + this.options.unit + '" xml:lang="en-US" ';
    xml += 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ';
    xml += 'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ';
    xml += 'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n';
    
    // Add Bambu Studio metadata
    xml += ' <metadata name="Application">BambuStudio-02.02.00.85</metadata>\n';
    xml += ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n';
    xml += ' <metadata name="CreationDate">' + new Date().toISOString().split('T')[0] + '</metadata>\n';
    
    xml += this.generateMainResourcesSection(meshes);
    xml += this.generateMainBuildSection();
    
    xml += '</model>';
    return xml;
  }

  private generateMainResourcesSection(meshes: THREE.Mesh[]): string {
    let xml = ' <resources>\n';
    
    // Create single assembly object that contains all meshes (like working version)
    xml += '  <object id="4" p:UUID="' + this.generateUUID() + '" type="model">\n';
    xml += '   <components>\n';
    
    // Add each mesh as a component with simple 3x4 transform matrices
    meshes.forEach((mesh, index) => {
      const componentId = index + 1;
      
      // Get the mesh's world transformation
      const worldMatrix = mesh.matrixWorld;
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      worldMatrix.decompose(position, quaternion, scale);
      
      // Create simple 3x4 transform matrix (like working version)
      // Format: m11 m12 m13 m21 m22 m23 m31 m32 m33 tx ty tz
      const transform = `1 0 0 0 1 0 0 0 1 ${position.x.toFixed(8)} ${position.y.toFixed(8)} ${position.z.toFixed(8)}`;
      
      xml += `   <component p:path="/3D/Objects/object_1.model" objectid="${componentId}" p:UUID="${this.generateUUID()}" transform="${transform}"/>\n`;
    });
    
    xml += '   </components>\n';
    xml += '  </object>\n';
    xml += ' </resources>\n';
    return xml;
  }

  private generateMainBuildSection(): string {
    let xml = ' <build p:UUID="' + this.generateUUID() + '">\n';
    
    // Place the assembly object at the origin (like working version)
    xml += '  <item objectid="4" p:UUID="' + this.generateUUID() + '" transform="1 0 0 0 1 0 0 0 1 128 127.99999 0" printable="1"/>\n';
    
    xml += ' </build>\n';
    return xml;
  }

  private generateCombinedGeometryXML(meshes: THREE.Mesh[]): string {
    // Create separate objects for each mesh (like the working version)
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<model unit="' + this.options.unit + '" xml:lang="en-US" ';
    xml += 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ';
    xml += 'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ';
    xml += 'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n';
    
    xml += ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n';
    xml += ' <resources>\n';
    
    // Create separate objects for each mesh (like the working version)
    meshes.forEach((mesh, index) => {
      const objectId = index + 1;
      
      // Check if this is a hole placeholder that should be converted to a cylinder primitive
      const isHolePlaceholder = mesh.name === 'HoleMaterial' || 
                               (mesh.material as any)?.name === 'HoleMaterial';
      
      if (isHolePlaceholder) {
        // Create cylinder primitive for the hole (type="other" for negative parts)
        xml += `  <object id="${objectId}" p:UUID="${this.generateUUID()}" type="other">\n`;
        xml += '   <mesh>\n';
        
        // Create cylinder geometry for the hole
        const cylinderGeometry = this.createCylinderGeometry(mesh);
        
        // Generate vertices XML for cylinder
        xml += '    <vertices>\n';
        cylinderGeometry.vertices.forEach(vertex => {
          xml += `     <vertex x="${vertex.x.toFixed(9)}" y="${vertex.y.toFixed(9)}" z="${vertex.z.toFixed(9)}"/>\n`;
        });
        xml += '    </vertices>\n';
        
        // Generate triangles XML for cylinder
        xml += '    <triangles>\n';
        cylinderGeometry.triangles.forEach(triangle => {
          xml += `     <triangle v1="${triangle[0]}" v2="${triangle[1]}" v3="${triangle[2]}"/>\n`;
        });
        xml += '    </triangles>\n';
        
        xml += '   </mesh>\n';
        xml += '  </object>\n';
      } else {
        // Regular mesh object (type="model")
        xml += `  <object id="${objectId}" p:UUID="${this.generateUUID()}" type="model">\n`;
        xml += '   <mesh>\n';
        
        // Get the mesh geometry
        const geometry = mesh.geometry;
        const vertices = geometry.attributes.position;
        
        if (vertices) {
          // Generate vertices XML with world transformation applied
          xml += '    <vertices>\n';
          for (let i = 0; i < vertices.count; i++) {
            const x = vertices.getX(i);
            const y = vertices.getY(i);
            const z = vertices.getZ(i);
            
            // Apply mesh world transformation
            const worldPos = new THREE.Vector3(x, y, z);
            worldPos.applyMatrix4(mesh.matrixWorld);
            
            xml += `     <vertex x="${worldPos.x.toFixed(9)}" y="${worldPos.y.toFixed(9)}" z="${worldPos.z.toFixed(9)}"/>\n`;
          }
          xml += '    </vertices>\n';
          
          // Generate triangles XML
          xml += '    <triangles>\n';
          if (geometry.index) {
            const indices = geometry.index;
            for (let i = 0; i < indices.count; i += 3) {
              if (i + 2 < indices.count) {
                const v1 = indices.getX(i);
                const v2 = indices.getX(i + 1);
                const v3 = indices.getX(i + 2);
                xml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>\n`;
              }
            }
          } else {
            // Non-indexed geometry
            for (let i = 0; i < vertices.count; i += 3) {
              if (i + 2 < vertices.count) {
                const v1 = i;
                const v2 = i + 1;
                const v3 = i + 2;
                xml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>\n`;
              }
            }
          }
          xml += '    </triangles>\n';
        }
        
        xml += '   </mesh>\n';
        xml += '  </object>\n';
      }
    });
    
    xml += ' </resources>\n';
    xml += ' <build/>\n';
    xml += '</model>';
    
    return xml;
  }

  // Helper method to create cylinder geometry for holes
  private createCylinderGeometry(mesh: THREE.Mesh): { vertices: THREE.Vector3[], triangles: number[][] } {
    const vertices: THREE.Vector3[] = [];
    const triangles: number[][] = [];
    
    // Get the mesh's world transformation to determine position and scale
    const worldMatrix = mesh.matrixWorld;
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    worldMatrix.decompose(position, quaternion, scale);
    
    // Create a cylinder with 16 segments (like the working version)
    const segments = 16;
    const radius = 1.5; // 3mm diameter
    const height = 2.0; // 2mm height
    
    // Generate vertices for the cylinder
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      // Top face vertices
      vertices.push(new THREE.Vector3(x, y, height / 2));
      // Bottom face vertices
      vertices.push(new THREE.Vector3(x, y, -height / 2));
    }
    
    // Generate triangles for the cylinder
    // Side faces
    for (let i = 0; i < segments; i++) {
      const top1 = i * 2;
      const top2 = ((i + 1) % segments) * 2;
      const bottom1 = i * 2 + 1;
      const bottom2 = ((i + 1) % segments) * 2 + 1;
      
      // First triangle of the quad
      triangles.push([top1, bottom1, top2]);
      // Second triangle of the quad
      triangles.push([bottom1, bottom2, top2]);
    }
    
    // Top and bottom caps
    for (let i = 1; i < segments - 1; i++) {
      const top1 = i * 2;
      const top2 = (i + 1) * 2;
      const bottom1 = i * 2 + 1;
      const bottom2 = (i + 1) * 2 + 1;
      
      // Top cap triangles
      triangles.push([0, top1, top2]);
      // Bottom cap triangles
      triangles.push([1, bottom2, bottom1]);
    }
    
    // Apply the mesh's world transformation to all vertices
    vertices.forEach(vertex => {
      vertex.applyMatrix4(worldMatrix);
    });
    
    return { vertices, triangles };
  }

  private generateProjectSettingsXML(_meshes: THREE.Mesh[]): string {
    // Simplified project settings for the working structure
    let json = '{\n';
    json += '    "default_filament_profile": [\n';
    json += '        "Bambu PLA Basic @BBL X1C"\n';
    json += '    ],\n';
    json += '    "default_print_profile": "0.20mm Standard @BBL X1C",\n';
    json += '    "layer_height": "0.2",\n';
    json += '    "initial_layer_print_height": "0.2",\n';
    json += '    "top_shell_layers": "3",\n';
    json += '    "bottom_shell_layers": "3",\n';
    json += '    "sparse_infill_density": "15%",\n';
    json += '    "enable_support": "0",\n';
    json += '    "enable_prime_tower": "1",\n';
    json += '    "extruder_colour": [\n';
    json += '        "#FFCC00"\n';
    json += '    ],\n';
    json += '    "filament_colour": [\n';
    json += '        "#FFCC00"\n';
    json += '    ],\n';
    json += '    "filament_map": [\n';
    json += '        "1"\n';
    json += '    ],\n';
    json += '    "filament_map_mode": "Auto For Flush",\n';
    json += '    "printer_model": "Bambu Lab X1 Carbon",\n';
    json += '    "printer_settings_id": "Bambu Lab X1 Carbon 0.2 nozzle",\n';
    json += '    "curr_bed_type": "Textured PEI Plate"\n';
    json += '}';
    
    return json;
  }

  private generateModelSettingsXML(meshes: THREE.Mesh[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<config>\n';
    xml += `  <object id="4">\n`; // Changed from 3 to 4 to match working version
    xml += `    <metadata key="name" value="Assembly"/>\n`;
    xml += `    <metadata key="extruder" value="1"/>\n`;
    
    // Calculate total face count
    const totalFaceCount = meshes.reduce((total, mesh) => {
      const geometry = mesh.geometry;
      if (geometry.attributes.position) {
        return total + Math.floor(geometry.attributes.position.count / 3);
      }
      return total;
    }, 0);
    
    xml += `    <metadata face_count="${totalFaceCount}"/>\n`;
    
    // Define each part within the assembly (simplified like working version)
    meshes.forEach((mesh, index) => {
      const partId = index + 1;
      const extruderId = index + 1;
      const faceCount = Math.floor((mesh.geometry.attributes.position?.count || 0) / 3);
      
      // Check if this is a hole placeholder that should be converted to a negative part
      const isHolePlaceholder = mesh.name === 'HoleMaterial' || 
                               (mesh.material as any)?.name === 'HoleMaterial';
      
      if (isHolePlaceholder) {
        // Create negative part metadata for the hole
        xml += `    <part id="${partId}" subtype="negative_part">\n`;
        xml += `      <metadata key="name" value="Generic-Cylinder"/>\n`;
        xml += `      <metadata key="extruder" value="0"/>\n`;
        
        // Get the transformation matrix for the negative part
        const worldMatrix = mesh.matrixWorld;
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        worldMatrix.decompose(position, quaternion, scale);
        
        // Use simple 3x4 transform matrix
        const transform = `1 0 0 0 1 0 0 0 1 ${position.x.toFixed(8)} ${position.y.toFixed(8)} ${position.z.toFixed(8)}`;
        
        xml += `      <metadata key="matrix" value="${transform}"/>\n`;
        xml += `      <mesh_stat face_count="${faceCount}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n`;
        xml += `    </part>\n`;
      } else {
        // Regular part metadata
        xml += `    <part id="${partId}" subtype="normal_part">\n`;
        xml += `      <metadata key="name" value="Part_${partId}"/>\n`;
        
        // Get the transformation matrix
        const worldMatrix = mesh.matrixWorld;
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        worldMatrix.decompose(position, quaternion, scale);
        
        // Use simple 3x4 transform matrix
        const transform = `1 0 0 0 1 0 0 0 1 ${position.x.toFixed(8)} ${position.y.toFixed(8)} ${position.z.toFixed(8)}`;
        
        xml += `      <metadata key="matrix" value="${transform}"/>\n`;
        xml += `      <metadata key="extruder" value="${extruderId}"/>\n`;
        xml += `      <mesh_stat face_count="${faceCount}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n`;
        xml += `    </part>\n`;
      }
    });
    
    xml += `  </object>\n`;
    xml += `  <plate>\n`;
    xml += `    <metadata key="plater_id" value="1"/>\n`;
    xml += `    <metadata key="plater_name" value=""/>\n`;
    xml += `    <metadata key="locked" value="false"/>\n`;
    xml += `    <metadata key="filament_map_mode" value="Auto For Flush"/>\n`;
    xml += `    <metadata key="filament_maps" value="1 2 3"/>\n`;
    xml += `    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>\n`;
    xml += `    <metadata key="thumbnail_no_light_file" value="Metadata/plate_no_light_1.png"/>\n`;
    xml += `    <metadata key="top_file" value="Metadata/top_1.png"/>\n`;
    xml += `    <metadata key="pick_file" value="Metadata/pick_1.png"/>\n`;
    xml += `    <model_instance>\n`;
    xml += `      <metadata key="object_id" value="4"/>\n`; // Changed from 3 to 4
    xml += `      <metadata key="instance_id" value="0"/>\n`;
    xml += `      <metadata key="identify_id" value="105"/>\n`;
    xml += `    </model_instance>\n`;
    xml += `  </plate>\n`;
    xml += `  <assemble>\n`;
    xml += `   <assemble_item object_id="4" instance_id="0" transform="1 0 0 0 1 0 0 0 1 128 127.99999 0" offset="0 0 0" />\n`; // Changed from 3 to 4
    xml += `  </assemble>\n`;
    xml += `</config>\n`;
    
    return xml;
  }

  private generateRelsXML(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';
    xml += ' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
    xml += '</Relationships>';
    return xml;
  }

  private generateModelRelsXML(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n';
    xml += ' <Relationship Target="/3D/Objects/object_1.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
    xml += '</Relationships>';
    return xml;
  }

  private generateContentTypesXML(): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n';
    xml += ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />\n';
    xml += ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n';
    xml += ' <Default Extension="config" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />\n';
    xml += '</Types>';
    return xml;
  }

  private generateCutInformationXML(): string {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<cut_information>\n</cut_information>';
  }

  private generateSliceInfoXML(): string {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<slice_info>\n</slice_info>';
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export async function exportSceneTo3MF(
  scene: THREE.Scene, 
  options: Partial<ExportOptions> = {}
): Promise<Blob> {
  const exporter = new ThreeMFExporter(scene, options);
  return exporter.export();
}
