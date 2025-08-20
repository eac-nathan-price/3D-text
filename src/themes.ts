/**
 * Theme configurations for 3D text scenes
 * 
 * These themes provide initial colors and settings. Users can override
 * these colors using the color pickers in the interface, and a reset button
 * allows returning to the theme defaults. The 3MF exporter will use the 
 * actual colors from the Three.js scene materials, ensuring the exported 
 * file matches exactly what the user sees.
 */
export interface Theme {
  name: string;
  font: string;
  color: number;        // Initial text color (can be overridden by user)
  background: number;   // Initial background color (can be overridden by user)
  text: string;
  tags: string[];
  caps: boolean;
}

export const themes: Theme[] = [
  {
    name: "TOS Title",
    font: "TOS_Title.json",
    color: 0xffff00,
    background: 0x000000,
    text: "STAR TREK",
    tags: ["Star Trek"],
    caps: true
  },
  {
    name: "TNG Title",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "STAR TREK",
    tags: ["Star Trek"],
    caps: true
  },
  {
    name: "DS9 Title",
    font: "DS9_Title.json",
    color: 0xcccccc,
    background: 0x000000,
    text: "STAR TREK",
    tags: ["Star Trek"],
    caps: true
  },
  {
    name: "Nasa",
    font: "Nasalization.json",
    color: 0xff0000,
    background: 0xffffff,
    text: "NASA",
    tags: ["Misc"],
    caps: true
  },
  {
    name: "Highway",
    font: "HWYGOTH.json",
    color: 0xffffff,
    background: 0x44dd44,
    text: "Highway",
    tags: ["Misc"],
    caps: false
  },
  {
    name: "Adventure Time Title",
    font: "AdventureTimeLogo.json",
    color: 0xff0000,
    background: 0x6cbfff,
    text: "ADVENTURE TIME",
    tags: ["Misc"],
    caps: false
  },
  {
    name: "Adventure Time Credits",
    font: "Thunderman.json",
    color: 0x000000,
    background: 0x88ff88,
    text: "ADVENTURE TIME",
    tags: ["Misc"],
    caps: false
  }
];
