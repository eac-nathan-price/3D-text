/**
 * Preset configurations for 3D text scenes
 * 
 * These presets provide initial colors and settings. Users can override
 * these colors using the color pickers in the interface. The 3MF exporter
 * will use the actual colors from the Three.js scene materials, ensuring
 * the exported file matches exactly what the user sees.
 */
export interface Preset {
  name: string;
  font: string;
  color: number;        // Initial text color (can be overridden by user)
  background: number;   // Initial background color (can be overridden by user)
  text: string;
  tags: string[];
}

export const presets: Preset[] = [
  {
    name: "TNG Title",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "STAR TREK",
    tags: ["Star Trek"]
  }
];
