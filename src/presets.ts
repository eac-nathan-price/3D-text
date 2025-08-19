export interface Preset {
  name: string;
  font: string;
  color: number;
  background: number;
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
    tags: ["Star Trek", "TNG", "Title"]
  },
  {
    name: "TOS Title",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "STAR TREK",
    tags: ["Star Trek", "TOS", "Title"]
  },
  {
    name: "DS9 Title",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "DEEP SPACE NINE",
    tags: ["Star Trek", "DS9", "Title"]
  },
  {
    name: "Voyager Title",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "STAR TREK VOYAGER",
    tags: ["Star Trek", "Voyager", "Title"]
  },
  {
    name: "Enterprise Title",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "ENTERPRISE",
    tags: ["Star Trek", "Enterprise", "Title"]
  },
  {
    name: "Hello World",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "HELLO WORLD",
    tags: ["Generic", "Example"]
  },
  {
    name: "Custom Text",
    font: "Federation_Regular.json",
    color: 0x0077ff,
    background: 0x000000,
    text: "CUSTOM TEXT",
    tags: ["Generic", "Example"]
  },
  {
    name: "Klingon Battle",
    font: "Federation_Regular.json",
    color: 0xff0000,
    background: 0x000000,
    text: "QAPLA'",
    tags: ["Star Trek", "Klingon", "Battle"]
  },
  {
    name: "Vulcan Logic",
    font: "Federation_Regular.json",
    color: 0x00ff00,
    background: 0x000000,
    text: "LIVE LONG AND PROSPER",
    tags: ["Star Trek", "Vulcan", "Logic"]
  }
];
