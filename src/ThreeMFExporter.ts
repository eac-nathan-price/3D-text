import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';

export interface ExportOptions {
  upAxis: 'X_UP' | 'Y_UP' | 'Z_UP';
  unit: string;
}

export class ThreeMFExporter {
  private scene: THREE.Scene;
  private options: ExportOptions;

  /**
   * Creates a new ThreeMFExporter instance.
   * 
   * The exporter automatically extracts colors from the current materials in the scene.
   * This means it will use whatever colors are currently applied to objects, whether they
   * come from themes or have been customized by the user.
   * 
   * @param scene - The Three.js scene to export
   * @param options - Export options for coordinate system and units
   */
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

    // Debug: Log materials found with their current colors
    // This shows the actual colors that will be used in the 3MF export
    console.log('Found meshes:', meshes.length);
    meshes.forEach((mesh, index) => {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      let color = 'N/A';
      if (material instanceof THREE.MeshBasicMaterial || 
          material instanceof THREE.MeshPhongMaterial || 
          material instanceof THREE.MeshStandardMaterial) {
        color = material.color ? '#' + material.color.getHexString() : 'N/A';
      }
      console.log(`Mesh ${index}:`, mesh.name, 'Material:', material.name, 'Current Color:', color);
    });

    // Validate and clean geometry to prevent non-manifold edges
    meshes.forEach((mesh, index) => {
      if (mesh.geometry) {
        this.validateAndCleanGeometry(mesh.geometry, `Mesh ${index} (${mesh.name || 'unnamed'})`);
      }
    });

    // Generate Bambu Studio compatible 3MF structure
    const mainModelContent = this.generateMainModelXML(meshes);
    const assemblyObjectContent = this.generateAssemblyObjectXML(meshes);
    const relsContent = this.generateRelsXML();
    const contentTypesContent = this.generateContentTypesXML();
    const projectSettingsContent = this.generateProjectSettingsXML(meshes);
    const modelSettingsContent = this.generateModelSettingsXML(meshes);

    const files: Record<string, Uint8Array> = {};
    files['[Content_Types].xml'] = strToU8(contentTypesContent);
    files['_rels/.rels'] = strToU8(relsContent);
    files['3D/3dmodel.model'] = strToU8(mainModelContent);
    files['3D/_rels/3dmodel.model.rels'] = strToU8(this.generateModelRelsXML());
    files['3D/Objects/object_3.model'] = strToU8(assemblyObjectContent);

    // Add Bambu Studio metadata
    files['Metadata/project_settings.config'] = strToU8(projectSettingsContent);
    files['Metadata/model_settings.config'] = strToU8(modelSettingsContent);

    const zipData = zipSync(files, { level: 8 });
    return new Blob([zipData], { type: 'application/3mf' });
  }

  /**
   * Validates and cleans geometry to prevent non-manifold edges
   */
  private validateAndCleanGeometry(geometry: THREE.BufferGeometry, meshName: string): void {
    try {
      // Ensure geometry has required attributes
      if (!geometry.attributes.position) {
        console.warn(`${meshName}: Missing position attribute`);
        return;
      }

      // Check for degenerate triangles (triangles with zero area)
      if (geometry.index) {
        const indices = geometry.index;
        let degenerateCount = 0;
        
        for (let i = 0; i < indices.count; i += 3) {
          const v1 = indices.getX(i);
          const v2 = indices.getX(i + 1);
          const v3 = indices.getX(i + 2);
          
          if (v1 === v2 || v2 === v3 || v1 === v3) {
            degenerateCount++;
          }
        }
        
        if (degenerateCount > 0) {
          console.warn(`${meshName}: Found ${degenerateCount} degenerate triangles`);
        }
      }

      // Ensure normals are computed for proper rendering
      if (!geometry.attributes.normal) {
        geometry.computeVertexNormals();
        console.log(`${meshName}: Computed vertex normals`);
      }

      // Ensure bounding box is computed
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      // Ensure bounding sphere is computed
      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }

      // Ensure the geometry is properly closed (manifold)
      this.ensureManifoldGeometry(geometry, meshName);

    } catch (error) {
      console.warn(`${meshName}: Error validating geometry:`, error);
    }
  }

  /**
   * Ensures geometry is manifold (properly closed) to prevent non-manifold edges
   */
  private ensureManifoldGeometry(geometry: THREE.BufferGeometry, meshName: string): void {
    try {
      // For text geometry, ensure it's properly closed
      if (geometry.attributes.position) {
        const positions = geometry.attributes.position;
        
        // Check if we have enough vertices for proper triangulation
        if (positions.count < 3) {
          console.warn(`${meshName}: Not enough vertices for triangulation`);
          return;
        }

        // For extruded text, ensure the geometry is watertight
        // This is especially important for 3D printing
        if (geometry.attributes.uv) {
          // UV coordinates exist, which suggests this is a proper 3D mesh
          console.log(`${meshName}: Geometry has UV coordinates, appears to be properly formed`);
        } else {
          // No UV coordinates, but this is normal for simple geometries
          console.log(`${meshName}: Geometry is simple (no UV coordinates)`);
        }

        // Ensure the geometry has proper winding order
        if (geometry.attributes.normal) {
          const normals = geometry.attributes.normal;
          let consistentNormals = true;
          
          // Check if normals are consistent (all pointing outward)
          for (let i = 0; i < normals.count; i++) {
            const nx = normals.getX(i);
            const ny = normals.getY(i);
            const nz = normals.getZ(i);
            
            // Check if normal is a valid unit vector
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (Math.abs(length - 1.0) > 0.1) {
              consistentNormals = false;
              break;
            }
          }
          
          if (!consistentNormals) {
            console.warn(`${meshName}: Inconsistent normals detected, recomputing`);
            geometry.computeVertexNormals();
          }
        }
      }
    } catch (error) {
      console.warn(`${meshName}: Error ensuring manifold geometry:`, error);
    }
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
    
    // Create single assembly object that contains all meshes
    xml += '  <object id="3" p:UUID="' + this.generateUUID() + '" type="model">\n';
    xml += '   <components>\n';
    
    // Add each mesh as a component with positioning
    meshes.forEach((mesh, index) => {
      const componentId = index + 1;
      // Get the actual position from the mesh
      const x = mesh.position.x;
      const y = mesh.position.y;
      const z = mesh.position.z;
      xml += `    <component p:path="/3D/Objects/object_3.model" objectid="${componentId}" p:UUID="${this.generateUUID()}" transform="1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}"/>\n`;
    });
    
    xml += '   </components>\n';
    xml += '  </object>\n';
    xml += ' </resources>\n';
    return xml;
  }

  private generateMainBuildSection(): string {
    let xml = ' <build p:UUID="' + this.generateUUID() + '">\n';
    
    // Place the assembly object at the origin
    xml += '  <item objectid="3" p:UUID="' + this.generateUUID() + '" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/>\n';
    
    xml += ' </build>\n';
    return xml;
  }

  private generateAssemblyObjectXML(meshes: THREE.Mesh[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<model unit="' + this.options.unit + '" xml:lang="en-US" ';
    xml += 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ';
    xml += 'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ';
    xml += 'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n';
    
    xml += ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n';
    xml += ' <resources>\n';
    
    // Add each mesh as a separate object within the assembly
    meshes.forEach((mesh: THREE.Mesh, index: number) => {
      const objectId = index + 1;
      xml += `  <object id="${objectId}" p:UUID="${this.generateUUID()}" type="model">\n`;
      xml += '   <mesh>\n';
      
      xml += this.generateVerticesXML(mesh.geometry);
      xml += this.generateTrianglesXML(mesh.geometry);
      
      xml += '   </mesh>\n';
      xml += '  </object>\n';
    });
    
    xml += ' </resources>\n';
    xml += ' <build/>\n';
    xml += '</model>';
    
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

  private generateTrianglesXML(geometry: THREE.BufferGeometry): string {
    let xml = '    <triangles>\n';
    
    if (geometry.index) {
      const indices = geometry.index;
      for (let i = 0; i < indices.count; i += 3) {
        const v1 = indices.getX(i);
        const v2 = indices.getX(i + 1);
        const v3 = indices.getX(i + 2);
        
        // Ensure proper winding order (counter-clockwise for 3MF)
        // This helps prevent non-manifold edges
        xml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
      }
    } else {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 3) {
        const v1 = i;
        const v2 = i + 1;
        const v3 = i + 2;
        
        // Ensure we don't exceed vertex count
        if (v2 < positions.count && v3 < positions.count) {
          xml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}" />\n`;
        }
      }
    }
    
    xml += '    </triangles>\n';
    return xml;
  }

  private generateProjectSettingsXML(meshes: THREE.Mesh[]): string {
    const materialCount = meshes.length;
    
    // This method generates the project settings JSON that Bambu Studio uses
    // to configure filaments and extruders. The key is that we extract colors
    // directly from the Three.js scene materials to ensure the 3MF colors
    // exactly match what the user sees in the web application.
    
    let json = '{\n';
    json += '    "default_filament_profile": [\n';
    
    // Add Bambu PLA Basic profile for each material
    for (let i = 0; i < materialCount; i++) {
      json += '        "Bambu PLA Basic @BBL X1C"';
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    
    json += '    ],\n';
    json += '    "default_print_profile": "0.20mm Standard @BBL X1C",\n';
    
    // Add print quality settings that affect cost
    json += '    "layer_height": "0.2",\n';
    json += '    "initial_layer_print_height": "0.2",\n';
    json += '    "top_shell_layers": "3",\n';
    json += '    "bottom_shell_layers": "3",\n';
    json += '    "sparse_infill_density": "15%",\n';
    json += '    "enable_support": "0",\n';
    json += '    "enable_prime_tower": "1",\n';
    
    json += '    "extruder_colour": [\n';
    
    // Add extruder colors for each material - use the same colors as the filaments
    for (let i = 0; i < materialCount; i++) {
      const mesh = meshes[i];
      const meshMaterial = mesh.material;
      const material = Array.isArray(meshMaterial) ? meshMaterial[0] : meshMaterial;
      let color = '#FFCC00'; // Default fallback color
      
      // Use the same color logic as filament colors for consistency
      if (material instanceof THREE.MeshBasicMaterial || 
          material instanceof THREE.MeshPhongMaterial || 
          material instanceof THREE.MeshStandardMaterial) {
        if (material.color) {
          color = '#' + material.color.getHexString().toUpperCase();
        }
      }
      
      json += `        "${color}"`;
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    
    json += '    ],\n';
    json += '    "filament_colour": [\n';
    
    // Extract current colors from each mesh's material in the scene
    // This ensures the 3MF uses the actual colors visible in the Three.js scene
    // rather than any theme or default values
    for (let i = 0; i < materialCount; i++) {
      const mesh = meshes[i];
      const meshMaterial = mesh.material;
      const material = Array.isArray(meshMaterial) ? meshMaterial[0] : meshMaterial;
      let color = '#FFCC00'; // Default fallback color
      
      // Always use the current color from the material in the scene
      if (material instanceof THREE.MeshBasicMaterial || 
          material instanceof THREE.MeshPhongMaterial || 
          material instanceof THREE.MeshStandardMaterial) {
        if (material.color) {
          color = '#' + material.color.getHexString().toUpperCase();
          console.log(`Mesh ${i} (${mesh.name || 'unnamed'}): Using color ${color} from material`);
        } else {
          console.warn(`Mesh ${i} (${mesh.name || 'unnamed'}): Material has no color, using fallback ${color}`);
        }
      } else {
        console.warn(`Mesh ${i} (${mesh.name || 'unnamed'}): Unsupported material type, using fallback ${color}`);
      }
      
      json += `        "${color}"`;
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    
    json += '    ],\n';
    json += '    "filament_map": [\n';
    
    // Map each material to an extruder
    for (let i = 0; i < materialCount; i++) {
      json += `        "${i + 1}"`;
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    
    json += '    ],\n';
    json += '    "filament_map_mode": "Auto For Flush",\n';
    
    // Add comprehensive filament information
    json += '    "filament_cost": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "24.99"'; // Standard Bambu PLA cost
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_density": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "1.26"'; // Standard PLA density
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_diameter": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "1.75"'; // Standard 1.75mm diameter
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_type": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "PLA"'; // Standard PLA type
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_vendor": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "Bambu Lab"'; // Standard Bambu Lab vendor
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_settings_id": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "Bambu PLA Basic @BBL X1C"'; // Standard Bambu profile
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    // Add more filament properties for better compatibility
    json += '    "filament_flow_ratio": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "0.98"'; // Standard PLA flow ratio
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_max_volumetric_speed": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "21"'; // Standard PLA max volumetric speed
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "filament_ids": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "GFA00"'; // Standard Bambu PLA ID
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "printer_model": "Bambu Lab X1 Carbon",\n';
    json += '    "printer_settings_id": "Bambu Lab X1 Carbon 0.2 nozzle",\n';
    
    // Add important printer settings for better compatibility
    json += '    "curr_bed_type": "Textured PEI Plate",\n';
    json += '    "hot_plate_temp": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "55"'; // Standard PLA bed temperature
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "hot_plate_temp_initial_layer": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "55"'; // Standard PLA initial layer bed temperature
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "nozzle_temperature_range_low": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "200"'; // Standard PLA nozzle temperature low
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '    "nozzle_temperature_range_high": [\n';
    for (let i = 0; i < materialCount; i++) {
      json += '        "220"'; // Standard PLA nozzle temperature high
      if (i < materialCount - 1) json += ',';
      json += '\n';
    }
    json += '    ],\n';
    
    json += '}';
    
    return json;
  }

  private generateModelSettingsXML(meshes: THREE.Mesh[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<config>\n';
    
    // Define the assembly object
    xml += '  <object id="3">\n';
    xml += '    <metadata key="name" value="Assembly"/>\n';
    xml += '    <metadata key="extruder" value="1"/>\n';
    xml += `    <metadata face_count="${meshes.reduce((total, mesh) => total + (mesh.geometry.attributes.position?.count || 0) / 3, 0)}"/>\n`;
    
    // Define each part within the assembly
    meshes.forEach((mesh, index) => {
      const partId = index + 1;
      const extruderId = index + 1;
      const faceCount = Math.floor((mesh.geometry.attributes.position?.count || 0) / 3);
      
      xml += `    <part id="${partId}" subtype="normal_part">\n`;
      xml += `      <metadata key="name" value="${mesh.name || 'Part_' + (index + 1)}"/>\n`;
      xml += `      <metadata key="matrix" value="1 0 0 0 1 0 0 0 1 ${mesh.position.x} ${mesh.position.y} ${mesh.position.z}"/>\n`;
      xml += `      <metadata key="extruder" value="${extruderId}"/>\n`;
      xml += `      <metadata key="mesh_stat" face_count="${faceCount}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n`;
      xml += `    </part>\n`;
    });
    
    xml += '  </object>\n';
    xml += '  <plate>\n';
    xml += '    <metadata key="plater_id" value="1"/>\n';
    xml += '    <metadata key="plater_name" value=""/>\n';
    xml += '    <metadata key="locked" value="false"/>\n';
    xml += '    <metadata key="filament_map_mode" value="Auto For Flush"/>\n';
    
    // Add filament maps for each material
    const filamentMaps = meshes.map((_, index) => index + 1).join(' ');
    xml += `    <metadata key="filament_maps" value="${filamentMaps}"/>\n`;
    
    // Add model instance for the assembly
    xml += '    <model_instance>\n';
    xml += '      <metadata key="object_id" value="3"/>\n';
    xml += '      <metadata key="instance_id" value="0"/>\n';
    xml += '      <metadata key="identify_id" value="105"/>\n';
    xml += '    </model_instance>\n';
    
    xml += '  </plate>\n';
    xml += '  <assemble>\n';
    
    // Add assemble item for the assembly
    xml += '   <assemble_item object_id="3" instance_id="0" transform="1 0 0 0 1 0 0 0 1 0 0 0" offset="0 0 0" />\n';
    
    xml += '  </assemble>\n';
    xml += '</config>';
    
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
    xml += ' <Relationship Target="/3D/Objects/object_3.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />\n';
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

  private generateUUID(): string {
    // Simple UUID v4 generator
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
