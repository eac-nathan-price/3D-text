import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ThreeMFExporter } from './ThreeMFExporter';
import { themes } from './themes';
import type { Theme } from './themes';
import { products } from './products';
import type { Product } from './products';
import { ThemeGrid } from './ThemeGrid';

/**
 * 3D Text Scene with 3MF Export Capability
 * 
 * Color System:
 * - Themes provide initial colors for text and background
 * - Users can override theme colors using color pickers
 * - A reset button appears when colors are modified to restore theme defaults
 * - Overridden colors are applied to Three.js materials in real-time
 * - The 3MF exporter automatically extracts colors from the current scene materials
 * - This ensures the exported 3MF exactly matches what the user sees in the scene
 * - All color changes (theme or custom) are reflected in the exported 3MF file
 */



const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  // Text and font state
  const [text, setText] = useState('Your Name');
  const [selectedFont, setSelectedFont] = useState('Federation_Regular.json');
  

  
  // Theme and color state
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Control whether to apply additional scaling beyond initial font size
  const [scaleText, setScaleText] = useState(false);
  
  // Color override states - these will override theme colors
  const [textColor, setTextColor] = useState<number>(0x0077ff); // Default blue
  const [backgroundColor, setBackgroundColor] = useState<number>(0x000000); // Default black
  const [textProtrusion, setTextProtrusion] = useState<{
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
  } | null>(null);

  // Check if debug mode is enabled via query parameter
  const isDebugMode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debug') === 'true';
  };

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const textMeshRef = useRef<THREE.Mesh | null>(null);
  const pillMeshRef = useRef<THREE.Mesh | null>(null);
  const holeMeshRef = useRef<THREE.Mesh | null>(null);



  // Apply theme when selected
  // Note: Colors can be customized beyond themes - the 3MF exporter will use the current scene colors
  const applyTheme = (theme: Theme) => {
    // Don't change the user's text - keep their input
    setSelectedFont(theme.font);
    setSelectedTheme(theme);
    // Update color overrides to match theme colors
    setTextColor(theme.color);
    setBackgroundColor(theme.background);
    // Reset protrusion state when theme changes
    setTextProtrusion(null);
  };

  // Apply product when selected
  const applyProduct = (product: Product) => {
    setSelectedProduct(product);
  };







  // Initialize with TNG Title theme
  useEffect(() => {
    const tngTheme = themes.find(p => p.name === "TNG Title");
    if (tngTheme) {
      applyTheme(tngTheme);
    }
    
    // Initialize with Keychain product
    const keychainProduct = products.find(p => p.name === "Keychain");
    if (keychainProduct) {
      if (isDebugMode()) {
        console.log('Initializing with Keychain product:', keychainProduct);
      }
      applyProduct(keychainProduct);
    } else {
      if (isDebugMode()) {
        console.error('Keychain product not found!');
      }
    }
  }, []);

  // Initialize scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 100, 300);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(100, 200, 100);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Animate loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Load JSON font and update text mesh
  useEffect(() => {
    if (!sceneRef.current || !selectedProduct) {
      if (isDebugMode()) {
        console.log('Waiting for scene and product to be ready...');
      }
      return;
    }

    const loader = new FontLoader();
    loader.load(`/fonts/${selectedFont}`, (font: any) => {
      // Remove old meshes
      if (textMeshRef.current && sceneRef.current) sceneRef.current.remove(textMeshRef.current);
      if (pillMeshRef.current && sceneRef.current) sceneRef.current.remove(pillMeshRef.current);
      if (holeMeshRef.current && sceneRef.current) sceneRef.current.remove(holeMeshRef.current);

      // Create text geometry
      // Use a more reasonable initial text size that's closer to the target dimensions
      // This prevents the need for extreme scaling
      const initialTextSize = Math.min(selectedProduct.targetSize[0] / 3, selectedProduct.targetSize[1] / 2);
      if (isDebugMode()) {
        console.log('Initial text size calculated:', {
          targetX: selectedProduct.targetSize[0],
          targetY: selectedProduct.targetSize[1],
          initialTextSize: initialTextSize.toFixed(2) + 'mm'
        });
      }
             // Apply caps transformation if theme requires it
       const displayText = selectedTheme?.caps ? text.toUpperCase() : text;
       
       const textGeo = new TextGeometry(displayText, {
         font,
         size: initialTextSize,
         depth: selectedProduct.text.thickness + selectedProduct.text.overlap, // Use product thickness + overlap
         curveSegments: 12,
         bevelEnabled: false,
       });
      
      textGeo.computeBoundingBox();
      textGeo.center();
      
      // Ensure the geometry is properly formed for 3D printing
      // This helps prevent non-manifold edges
      textGeo.computeVertexNormals();
      textGeo.computeBoundingSphere();
      
      // Create text material with color override (can be customized by user)
      // The 3MF exporter will use whatever color is currently set on this material
      const textMat = new THREE.MeshPhongMaterial({ 
        color: textColor, // Use color override or theme color
        name: 'TextMaterial'
      });
      // Ensure the material name is set for proper identification in the exporter
      textMat.name = 'TextMaterial';
      const textMesh = new THREE.Mesh(textGeo, textMat);
      
      // Position text based on product specifications
      if (selectedProduct) {
        // Text should start at the top surface of the background and extend above it
        const backgroundThickness = selectedProduct.background.thickness;
        const textThickness = selectedProduct.text.thickness;
        const overlap = selectedProduct.text.overlap;
        const totalTextDepth = textThickness + overlap; // Total Z depth including overlap
        
        // Background goes from z=0 to z=backgroundThickness (e.g., 0 to 2mm)
        // Text should start at backgroundThickness - overlap and extend above it
        // For keychain: background is 2mm thick, text is 1.05mm thick total
        // Text should go from z=1.95mm to z=3mm (centered at z=2.475mm)
        // Since TextGeometry origin is at the center, position at z=2.475mm
        const textStartZ = backgroundThickness - overlap; // 2mm - 0.05mm = 1.95mm
        const textCenterZ = textStartZ + (totalTextDepth / 2); // 1.95mm + 1.05mm/2 = 2.475mm
        textMesh.position.z = textCenterZ;
        
        // Text positioning will be handled after pill creation when we have the dimensions
        textMesh.position.x = 0; // Temporary position, will be updated
        textMesh.position.y = 0; // Keep text centered in Y
      }
      textMeshRef.current = textMesh;
      if (sceneRef.current) sceneRef.current.add(textMesh);

              // Apply sizing logic according to product constraints
        if (textGeo.boundingBox) {
          const { min, max } = textGeo.boundingBox;
          const currentWidth = max.x - min.x;
          const currentHeight = max.y - min.y;
          
          if (isDebugMode()) {
            console.log('Text dimensions before scaling:', {
              width: currentWidth.toFixed(2) + 'mm',
              height: currentHeight.toFixed(2) + 'mm',
              productConstraints: {
                minSize: selectedProduct.minSize,
                targetSize: selectedProduct.targetSize
              }
            });
          }
          
          // Check if text dimensions are reasonable for the product
          if (currentWidth > selectedProduct.targetSize[0] * 2) {
            if (isDebugMode()) {
              console.warn('Text is extremely wide! Consider using shorter text or adjusting product constraints.');
            }
          }
          
          // Only apply additional scaling if scaleText is enabled
          if (scaleText) {
            // Apply the sizing logic according to the specified criteria
            const scaleFactor = calculateOptimalScale(
              currentWidth,
              currentHeight,
              selectedProduct.minSize,
              selectedProduct.targetSize
            );
            
            // Apply uniform scaling to maintain aspect ratio (X and Y scale equally)
            // Z scale remains 1 to preserve the correct text thickness
            textMesh.scale.set(scaleFactor, scaleFactor, 1);
            
            if (isDebugMode()) {
              console.log(`Text sizing: Current(${currentWidth.toFixed(2)}mm x ${currentHeight.toFixed(2)}mm), Scale: ${scaleFactor.toFixed(3)}, Final(${(currentWidth * scaleFactor).toFixed(2)}mm x ${(currentHeight * scaleFactor).toFixed(2)}mm)`);
              console.log('Scale factor breakdown:', {
                targetXScale: selectedProduct.targetSize[0] / currentWidth,
                minYScale: selectedProduct.minSize[1] / currentHeight,
                finalScale: scaleFactor
              });
            }
          } else {
            // Keep initial font size without additional scaling
            if (isDebugMode()) {
              console.log('Additional scaling disabled - using initial font size:', {
                width: currentWidth.toFixed(2) + 'mm',
                height: currentHeight.toFixed(2) + 'mm'
              });
            }
          }
        }

      // Create pill background
      if (textGeo.boundingBox) {
        const { min, max } = textGeo.boundingBox;
        const basePadding = selectedProduct.background.padding;
        
        // Calculate dimensions for the hole if product has left hole add-on
        let leftPadding = basePadding;
        let rightPadding = basePadding;
        const leftHole = selectedProduct.addOns.find(addon => addon.type === "hole" && addon.position === "left");
        
        if (leftHole) {
          // Hole is 3mm diameter, positioned at x1 + 2.5 (where x1 is left edge of pill)
          // Text starts at x1 + 5 (2.5 + 1.5 + 1 = 5mm from left edge)
          // So we need:
          // - 5mm from left edge to text start
          // - text width
          // - basePadding from text end to right edge
          leftPadding = 5; // 5mm from left edge to text start
          rightPadding = basePadding; // Keep right padding as specified
        }
        
        // Calculate pill dimensions based on SCALED text dimensions
        const textWidth = (max.x - min.x) * textMesh.scale.x;
        const textHeight = (max.y - min.y) * textMesh.scale.y;
        const width = textWidth + leftPadding + rightPadding;
        const height = textHeight + basePadding * 2;
        const radius = height / 2;

        const shape = new THREE.Shape();
        const x = -width / 2;
        const y = -height / 2;

        shape.moveTo(x + radius, y);
        shape.lineTo(x + width - radius, y);
        shape.quadraticCurveTo(x + width, y, x + width, y + radius);
        shape.lineTo(x + width, y + height - radius);
        shape.quadraticCurveTo(
          x + width,
          y + height,
          x + width - radius,
          y + height
        );
        shape.lineTo(x + radius, y + height);
        shape.quadraticCurveTo(x, y + height, x, y + height - radius);
        shape.lineTo(x, y + radius);
        shape.quadraticCurveTo(x, y, x + radius, y);

        const pillGeo = new THREE.ExtrudeGeometry(shape, {
          depth: selectedProduct.background.thickness, // Use product thickness
          bevelEnabled: false,
        });
        
        // Ensure the pill geometry is properly formed for 3D printing
        // This helps prevent non-manifold edges
        pillGeo.computeVertexNormals();
        pillGeo.computeBoundingBox();
        pillGeo.computeBoundingSphere();
        
        // Create background material with color override (can be customized by user)
        // The 3MF exporter will use whatever color is currently set on this material
        const pillMat = new THREE.MeshPhongMaterial({ 
          color: backgroundColor, // Use color override or theme color
          name: 'BackgroundMaterial'
        });
        // Ensure the material name is set for proper identification in the exporter
        pillMat.name = 'BackgroundMaterial';
        const pillMesh = new THREE.Mesh(pillGeo, pillMat);
        
        // Position the pill at the origin
        // The pill goes from z=0 to z=2mm and is centered at the origin
        pillMesh.position.set(0, 0, 0);
        
        pillMeshRef.current = pillMesh;
        if (sceneRef.current) sceneRef.current.add(pillMesh);
        
        // Now position the text correctly based on the pill dimensions
        if (leftHole) {
          // Text should start at x1 + 5 (where x1 is the left edge of the pill)
          // Since the pill is centered at origin, its left edge is at -width/2
          const pillLeftEdge = -width / 2;
          const textStartX = pillLeftEdge + 5; // x1 + 5
          // Since TextGeometry origin is at its center, we need to offset by half the text width
          const textCenterX = textStartX + (textWidth / 2);
          textMesh.position.x = textCenterX;
        }
        
        // Check if text protrudes beyond the pill's rounded corners
        const checkTextProtrusion = () => {
          if (!textMeshRef.current || !pillMeshRef.current) return;
          
          const textBBox = (textMeshRef.current.geometry as any).boundingBox;
          if (!textBBox) return;
          
          // Get the scaled text dimensions
          const scaledTextWidth = (textBBox.max.x - textBBox.min.x) * textMeshRef.current.scale.x;
          const scaledTextHeight = (textBBox.max.y - textBBox.min.y) * textMeshRef.current.scale.y;
          
          // Get text position relative to pill center
          const textLeft = textMeshRef.current.position.x - (scaledTextWidth / 2);
          const textRight = textMeshRef.current.position.x + (scaledTextWidth / 2);
          const textTop = textMeshRef.current.position.y + (scaledTextHeight / 2);
          const textBottom = textMeshRef.current.position.y - (scaledTextHeight / 2);
          
          // Pill boundaries (pill is centered at origin)
          const pillLeft = -width / 2;
          const pillRight = width / 2;
          const pillTop = height / 2;
          const pillBottom = -height / 2;
          
          // Check for protrusion beyond rounded corners
          const cornerRadius = height / 2; // Pill corner radius
          const protrusionLeft = textLeft < (pillLeft + cornerRadius);
          const protrusionRight = textRight > (pillRight - cornerRadius);
          const protrusionTop = textTop > (pillTop - cornerRadius);
          const protrusionBottom = textBottom < (pillBottom + cornerRadius);
          
          // Update the protrusion state
          setTextProtrusion({
            left: protrusionLeft,
            right: protrusionRight,
            top: protrusionTop,
            bottom: protrusionBottom
          });
          
                     if (protrusionLeft || protrusionRight || protrusionTop || protrusionBottom) {
             if (isDebugMode()) {
               console.warn('Text protrudes beyond pill rounded corners!', {
                 protrusionLeft,
                 protrusionRight,
                 protrusionTop,
                 protrusionBottom,
                 textBounds: { left: textLeft, right: textRight, top: textTop, bottom: textBottom },
                 pillBounds: { left: pillLeft, right: pillRight, top: pillTop, bottom: pillBottom }
               });
             }
             
             // Note: Text color remains unchanged - protrusion is purely informational
           }
        };
        
        // Check for protrusion after positioning
        checkTextProtrusion();
        
                 // Add visual representation of the hole if it exists (for display only - not included in 3MF export)
         if (leftHole) {
           // Remove existing hole if it exists
           if (holeMeshRef.current && sceneRef.current) {
             sceneRef.current.remove(holeMeshRef.current);
           }
           
           // Create a 3mm diameter, 2mm high cylinder to represent the hole
           const holeGeometry = new THREE.CylinderGeometry(1.5, 1.5, 2, 16); // radius=1.5mm, height=2mm
           const holeMaterial = new THREE.MeshPhongMaterial({ 
             color: 0x666666, // Dark grey to represent the hole
             transparent: true,
             opacity: 0.7,
             name: 'HoleMaterial' // This name is used to filter it out of 3MF export
           });
           const holeMesh = new THREE.Mesh(holeGeometry, holeMaterial);
           
           // Position the hole at x1 + 2.5 (where x1 is the left edge of the pill)
           const holeX = -width / 2 + 2.5;
           const holeY = 0; // Center in Y direction
           const holeZ = 1; // Center in Z direction (pill goes from z=0 to z=2)
           
           holeMesh.position.set(holeX, holeY, holeZ);
           
           // Rotate the hole 90 degrees around X-axis so it goes through the pill horizontally
           // This makes the cylinder lie flat (parallel to the pill's top/bottom faces)
           holeMesh.rotation.x = Math.PI / 2;
           
           holeMeshRef.current = holeMesh; // Store the hole mesh
           if (sceneRef.current) sceneRef.current.add(holeMesh);
         }
      }
    });
  }, [text, selectedFont, textColor, backgroundColor, selectedProduct]);

  // Update text material color when textColor changes
  useEffect(() => {
    if (textMeshRef.current && textMeshRef.current.material instanceof THREE.MeshPhongMaterial) {
      textMeshRef.current.material.color.setHex(textColor);
    }
  }, [textColor]);

  // Update background material color when backgroundColor changes
  useEffect(() => {
    if (pillMeshRef.current && pillMeshRef.current.material instanceof THREE.MeshPhongMaterial) {
      pillMeshRef.current.material.color.setHex(backgroundColor);
    }
  }, [backgroundColor]);

  // Calculate optimal scale factor based on product constraints
  const calculateOptimalScale = (
    currentWidth: number,
    currentHeight: number,
    minSize: [number, number],
    targetSize: [number, number]
  ): number => {
    const [minX, minY] = minSize;
    const [targetX, targetY] = targetSize;
    
    // Step 1: Scale X and Y such that X size equals target X size
    let scaleFactor = targetX / currentWidth;
    
    // Step 2: Check Y constraints and adjust if necessary
    const projectedY = currentHeight * scaleFactor;
    
    if (projectedY > targetY) {
      // Y size is greater than target Y size - scale down until Y equals target Y
      // This ensures Y constraint is met while keeping X as close to target as possible
      scaleFactor = targetY / currentHeight;
    } else if (projectedY < minY) {
      // Y size is less than minimum Y size - scale up until Y equals min Y
      // This ensures minimum Y requirement is met
      scaleFactor = minY / currentHeight;
    }
    // else: Y size is already acceptable (between minY and targetY), no action needed
    
    // Ensure minimum X requirement is also met
    const projectedX = currentWidth * scaleFactor;
    if (projectedX < minX) {
      // If scaling for Y constraints made X too small, scale up to meet minimum X
      const minXScale = minX / currentWidth;
      scaleFactor = Math.max(scaleFactor, minXScale);
    }
    
    return scaleFactor;
  };

  // Manual function to check for text protrusion (can be called from UI)
  const checkTextProtrusionManually = () => {
    if (!textMeshRef.current || !pillMeshRef.current) {
      if (isDebugMode()) {
        console.log('No text or pill mesh available for protrusion check');
      }
      return;
    }
    
    const textBBox = (textMeshRef.current.geometry as any).boundingBox;
    if (!textBBox) {
      if (isDebugMode()) {
        console.log('No bounding box available for text geometry');
      }
      return;
    }
    
    // Get the scaled text dimensions
    const scaledTextWidth = (textBBox.max.x - textBBox.min.x) * textMeshRef.current.scale.x;
    const scaledTextHeight = (textBBox.max.y - textBBox.min.y) * textMeshRef.current.scale.y;
    
    // Get text position relative to pill center
    const textLeft = textMeshRef.current.position.x - (scaledTextWidth / 2);
    const textRight = textMeshRef.current.position.x + (scaledTextWidth / 2);
    const textTop = textMeshRef.current.position.y + (scaledTextHeight / 2);
    const textBottom = textMeshRef.current.position.y - (scaledTextHeight / 2);
    
    // Get pill dimensions from the pill mesh
    const pillBBox = (pillMeshRef.current.geometry as any).boundingBox;
    if (!pillBBox) {
      if (isDebugMode()) {
        console.log('No bounding box available for pill geometry');
      }
      return;
    }
    
    const pillWidth = pillBBox.max.x - pillBBox.min.x;
    const pillHeight = pillBBox.max.y - pillBBox.min.y;
    
    // Pill boundaries (pill is centered at origin)
    const pillLeft = -pillWidth / 2;
    const pillRight = pillWidth / 2;
    const pillTop = pillHeight / 2;
    const pillBottom = -pillHeight / 2;
    
    // Check for protrusion beyond rounded corners
    const cornerRadius = pillHeight / 2; // Pill corner radius
    const protrusionLeft = textLeft < (pillLeft + cornerRadius);
    const protrusionRight = textRight > (pillRight - cornerRadius);
    const protrusionTop = textTop > (pillTop - cornerRadius);
    const protrusionBottom = textBottom < (pillBottom + cornerRadius);
    
    if (isDebugMode()) {
      console.log('Manual protrusion check:', {
        textBounds: { left: textLeft, right: textRight, top: textTop, bottom: textBottom },
        pillBounds: { left: pillLeft, right: pillRight, top: pillTop, bottom: pillBottom },
        cornerRadius,
        protrusion: { left: protrusionLeft, right: protrusionRight, top: protrusionTop, bottom: protrusionBottom }
      });
    }
    
    return { protrusionLeft, protrusionRight, protrusionTop, protrusionBottom };
  };

  // Export scene to 3MF
  const export3MF = async () => {
    if (!sceneRef.current) return;

    try {
      

      // The exporter will automatically use the current colors of all objects in the scene
      // This includes any custom colors set by the user using the color pickers
      const exporter = new ThreeMFExporter(sceneRef.current);
      const blob = await exporter.export();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'text_scene.3mf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (isDebugMode()) {
        console.error('Error exporting 3MF:', error);
      }
      alert('Error exporting 3MF file. Check console for details.');
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#222222',
        fontFamily: '"Press Start 2P", system-ui',
      }}
    >
      <div
        style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
          borderBottom: '1px solid #34495e',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            color: '#ecf0f1', 
            fontSize: '14px', 
            fontWeight: '600',
            minWidth: '60px'
          }}>Product:</label>
          <select
            value={selectedProduct?.name || ''}
            onChange={(e) => {
              const product = products.find(p => p.name === e.target.value);
              if (product) {
                applyProduct(product);
              }
            }}
            style={{ 
              minWidth: '150px',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #34495e',
              background: '#34495e',
              color: '#ecf0f1',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3498db';
              e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3), 0 0 0 3px rgba(52,152,219,0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#34495e';
              e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3)';
            }}
          >
            {products.map((product) => (
              <option key={product.name} value={product.name}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        

        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ 
            color: '#ecf0f1', 
            fontSize: '14px', 
            fontWeight: '600',
            minWidth: '60px'
          }}>
            Text: 

          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // Reset protrusion state when text changes
                setTextProtrusion(null);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #34495e',
                background: '#34495e',
                color: '#ecf0f1',
                fontSize: '14px',
                fontWeight: '500',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                minWidth: '120px'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3498db';
                e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3), 0 0 0 3px rgba(52,152,219,0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#34495e';
                e.target.style.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.3)';
              }}
            />

          </div>
        </div>
        

        
        {/* Download button - only show in debug mode */}
        {isDebugMode() && (
          <button 
            onClick={export3MF}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              minWidth: '140px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            }}
          >
            💾 Download 3MF
          </button>
        )}
        
        {/* Additional scaling checkbox - only show in debug mode */}
        {isDebugMode() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ 
              color: '#ecf0f1', 
              fontSize: '14px', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={scaleText}
                onChange={(e) => setScaleText(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#3498db',
                  cursor: 'pointer'
                }}
              />
              Enable Additional Scaling
            </label>
          </div>
        )}
        
        {/* Debug information display - only show in debug mode */}
        {isDebugMode() && selectedProduct && textMeshRef.current && (
          <div style={{ 
            background: 'linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
            border: '1px solid #bdc3c7',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            minWidth: '300px',
            maxWidth: '400px'
          }}>
            <div style={{ marginBottom: '8px', fontWeight: '600', color: '#2c3e50' }}>
              <strong>Product:</strong> {selectedProduct.name}
            </div>
            <div style={{ marginBottom: '8px', color: '#34495e' }}>
              <strong>Constraints:</strong> Min: [{selectedProduct.minSize[0]}mm, {selectedProduct.minSize[1]}mm] | Target: [{selectedProduct.targetSize[0]}mm, {selectedProduct.targetSize[1]}mm]
            </div>
            <div style={{ marginBottom: '8px', color: '#34495e' }}>
              <strong>Scaling:</strong> {scaleText ? '✅ Enabled' : '❌ Disabled (using initial font size)'}
            </div>
            {textMeshRef.current && (
              <>
                <div style={{ marginBottom: '8px', color: '#34495e' }}>
                  <strong>Text Scale:</strong> {scaleText ? `${textMeshRef.current.scale.x.toFixed(3)}x` : '1.000x (initial size)'}
                </div>
                <div style={{ marginBottom: '12px', color: '#34495e' }}>
                  <strong>Final Text Size:</strong> { 
                    ((textMeshRef.current.geometry as any).boundingBox ? 
                      `${((textMeshRef.current.geometry as any).boundingBox.max.x - (textMeshRef.current.geometry as any).boundingBox.min.x) * textMeshRef.current.scale.x}mm x ${((textMeshRef.current.geometry as any).boundingBox.max.y - (textMeshRef.current.geometry as any).boundingBox.min.y) * textMeshRef.current.scale.y}mm` 
                      : 'Calculating...'
                    )
                  }
                </div>
                {textProtrusion && (
                  <div style={{ 
                    color: (textProtrusion.left || textProtrusion.right || textProtrusion.top || textProtrusion.bottom) ? '#e74c3c' : '#27ae60',
                    fontWeight: '600',
                    marginBottom: '12px',
                    padding: '8px',
                    background: (textProtrusion.left || textProtrusion.right || textProtrusion.top || textProtrusion.bottom) ? 'rgba(231, 76, 60, 0.1)' : 'rgba(39, 174, 96, 0.1)',
                    borderRadius: '6px',
                    border: `1px solid ${(textProtrusion.left || textProtrusion.right || textProtrusion.top || textProtrusion.bottom) ? '#e74c3c' : '#27ae60'}`
                  }}>
                    <strong>Protrusion:</strong> {
                      (textProtrusion.left || textProtrusion.right || textProtrusion.top || textProtrusion.bottom) 
                        ? `⚠️ Text extends beyond pill corners` 
                        : `✅ Text fits within pill bounds`
                    }
                    {(textProtrusion.left || textProtrusion.right || textProtrusion.top || textProtrusion.bottom) && (
                      <div style={{ fontSize: '11px', marginLeft: '8px', marginTop: '4px' }}>
                        {textProtrusion.left && '← Left '}
                        {textProtrusion.right && '→ Right '}
                        {textProtrusion.top && '↑ Top '}
                        {textProtrusion.bottom && '↓ Bottom '}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#7f8c8d', marginTop: '6px' }}>
                      Note: Colors remain unchanged - protrusion is informational only
                    </div>
                  </div>
                )}
                <button 
                  onClick={checkTextProtrusionManually}
                  style={{ 
                    padding: '8px 12px', 
                    fontSize: '12px',
                    background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                  }}
                  title="Manually check for text protrusion beyond pill corners (informational only - colors unchanged)"
                >
                  🔍 Check Protrusion
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Theme Grid */}
      <ThemeGrid
        onThemeSelect={applyTheme}
        selectedTheme={selectedTheme}
        selectedProduct={selectedProduct}
        userText={text}
      />
      
      <div ref={mountRef} style={{ flex: 1 }} />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
