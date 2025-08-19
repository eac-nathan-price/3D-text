/**
 * Preset configurations for 3D text scenes
 * 
 * These presets provide initial colors and settings, but the 3MF exporter
 * will use the actual colors from the Three.js scene materials, allowing
 * for user customization beyond these preset values.
 */
export interface Preset {
  name: string;
  font: string;
  color: number;        // Initial text color (can be customized later)
  background: number;   // Initial background color (can be customized later)
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
