/**
 * Product configurations for 3D text scenes
 * 
 * These products define the physical constraints and specifications for different
 * 3D printed items, including size limits, thickness requirements, and add-ons.
 */

export interface AddOn {
  type: "hole";
  position: "left" | "right" | "top" | "bottom" | "center";
  diameter: number;
  padding: number;
}

export interface BackgroundConfig {
  thickness: number;
  shape: "pill" | "rectangle" | "circle";
  padding: number;
}

export interface TextConfig {
  thickness: number;
  overlap: number;
}

export interface Product {
  name: string;
  minSize: [number, number]; // [Xmm, Ymm]
  targetSize: [number, number]; // [Xmm, Ymm]
  background: BackgroundConfig;
  text: TextConfig;
  addOns: AddOn[];
}

export const products: Product[] = [
  {
    name: "Keychain",
    minSize: [36, 12],
    targetSize: [76.2, 25.4],
    background: {
      thickness: 2,
      shape: "pill",
      padding: 4
    },
    text: {
      thickness: 1,
      overlap: 0.05
    },
    addOns: [
      {
        type: "hole",
        position: "left",
        diameter: 3,
        padding: 1
      }
    ]
  }
];
