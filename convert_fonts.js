import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';

// Parse command line arguments
const args = process.argv.slice(2);
const deleteTtf = args.includes('-d') || args.includes('--delete-ttf');

if (deleteTtf) {
  console.log('⚠️  TTF files will be deleted after successful conversion');
}

const fontsDir = './public/fonts';

// Get all TTF files
const ttfFiles = fs.readdirSync(fontsDir)
  .filter(file => file.toLowerCase().endsWith('.ttf'));

console.log(`Found ${ttfFiles.length} TTF files to convert:`);
ttfFiles.forEach(file => console.log(`  - ${file}`));

// Convert each TTF file to JSON
ttfFiles.forEach(ttfFile => {
  try {
    const ttfPath = path.join(fontsDir, ttfFile);
    const jsonFileName = ttfFile.replace(/\.ttf$/i, '.json');
    const jsonPath = path.join(fontsDir, jsonFileName);
    
    console.log(`Converting ${ttfFile} to ${jsonFileName}...`);
    
    // Read the TTF file and convert Buffer to ArrayBuffer
    const buffer = fs.readFileSync(ttfPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    // Read and parse the TTF file
    const font = opentype.parse(arrayBuffer);
    
    // Extract font information
    const fontData = {
      familyName: font.names.fontFamily?.en || font.names.fontFamily || 'Unknown',
      subfamilyName: font.names.fontSubfamily?.en || font.names.fontSubfamily || 'Unknown',
      fullName: font.names.fullName?.en || font.names.fullName || 'Unknown',
      postScriptName: font.names.postScriptName?.en || font.names.postScriptName || 'Unknown',
      unitsPerEm: font.unitsPerEm,
      ascender: font.ascender,
      descender: font.descender,
      underlinePosition: font.underlinePosition,
      underlineThickness: font.underlineThickness,
      numGlyphs: font.numGlyphs,
      created: font.names.created ? new Date(font.names.created).toISOString() : null,
      modified: font.names.modified ? new Date(font.names.modified).toISOString() : null,
      glyphs: []
    };
    
    // Extract glyph information (first 100 glyphs to keep file size manageable)
    const maxGlyphs = Math.min(100, font.numGlyphs);
    for (let i = 0; i < maxGlyphs; i++) {
      const glyph = font.glyphs.get(i);
      if (glyph) {
        fontData.glyphs.push({
          name: glyph.name,
          unicode: glyph.unicode,
          advanceWidth: glyph.advanceWidth,
          path: glyph.getPath ? glyph.getPath().toPathData() : null
        });
      }
    }
    
    // Write JSON file
    fs.writeFileSync(jsonPath, JSON.stringify(fontData, null, 2));
    console.log(`  ✓ Successfully converted ${ttfFile} to ${jsonFileName}`);
    
    // Delete TTF file if requested
    if (deleteTtf) {
      fs.unlinkSync(ttfPath);
      console.log(`  🗑️  Deleted ${ttfFile}`);
    }
    
  } catch (error) {
    console.error(`  ✗ Error converting ${ttfFile}:`, error.message);
  }
});

console.log('\nFont conversion completed!');
if (deleteTtf) {
  console.log('TTF files have been deleted as requested.');
} else {
  console.log('TTF files have been preserved. Use -d or --delete-ttf to delete them after conversion.');
}
