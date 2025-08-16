import * as opentype from 'opentype.js';

class FontLoader {
  private fontCache: Map<string, opentype.Font> = new Map();

  async loadFont(url: string): Promise<opentype.Font> {
    if (this.fontCache.has(url)) {
      return this.fontCache.get(url)!;
    }

    try {
      // For local fonts, we need to fetch as ArrayBuffer first
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      const font = await new Promise<opentype.Font>((resolve, reject) => {
        opentype.parse(arrayBuffer, (err, font) => {
          if (err || !font) {
            reject(err || new Error('Failed to load font'));
          } else {
            resolve(font);
          }
        });
      });

      this.fontCache.set(url, font);
      return font;
    } catch (error) {
      console.error('Error loading font:', error);
      throw error;
    }
  }
}

export const fontLoader = new FontLoader();