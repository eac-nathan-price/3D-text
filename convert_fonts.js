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

// Get all TTF and OTF files
const fontFiles = fs.readdirSync(fontsDir)
  .filter(file => file.toLowerCase().endsWith('.ttf') || file.toLowerCase().endsWith('.otf'));

console.log(`Found ${fontFiles.length} font files to convert:`);
fontFiles.forEach(file => console.log(`  - ${file}`));

// Convert each font file to JSON
fontFiles.forEach(fontFile => {
  try {
    const fontPath = path.join(fontsDir, fontFile);
    const jsonFileName = fontFile.replace(/\.(ttf|otf)$/i, '.json');
    const jsonPath = path.join(fontsDir, jsonFileName);
    
    console.log(`Converting ${fontFile} to ${jsonFileName}...`);
    
    // Read the font file and convert Buffer to ArrayBuffer
    const buffer = fs.readFileSync(fontPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    // Read and parse the font file (TTF or OTF)
    const font = opentype.parse(arrayBuffer);
    
    // Calculate proper scale factor (same as facetype.js)
    const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72);
    
    // Create the font data structure that Three.js expects
    const result = {
      glyphs: {},
      familyName: font.names.fontFamily?.en || font.names.fontFamily || 'Unknown',
      ascender: Math.round(font.ascender * scale),
      descender: Math.round(font.descender * scale),
      underlinePosition: Math.round((font.tables.post?.underlinePosition || -185) * scale),
      underlineThickness: Math.round((font.tables.post?.underlineThickness || 28) * scale),
      boundingBox: {
        yMin: Math.round((font.tables.head?.yMin || font.descender) * scale),
        xMin: Math.round((font.tables.head?.xMin || -100) * scale),
        yMax: Math.round((font.tables.head?.yMax || font.ascender) * scale),
        xMax: Math.round((font.tables.head?.xMax || 100) * scale)
      },
      resolution: 1000,
      original_font_information: font.tables.name || {
        format: 0,
        fontFamily: font.names.fontFamily?.en || font.names.fontFamily || 'Unknown',
        fontSubfamily: font.names.fontSubfamily?.en || font.names.fontSubfamily || 'Regular',
        fullName: font.names.fullName?.en || font.names.fullName || 'Unknown',
        postScriptName: font.names.postScriptName?.en || font.names.postScriptName || 'Unknown',
        version: font.names.version?.en || font.names.version || '1.0',
        uniqueID: font.names.uniqueID?.en || font.names.uniqueID || 'Unknown'
      }
    };
    
    // Set CSS properties
    if (font.names.fontSubfamily?.en?.toLowerCase().indexOf('bold') > -1) {
      result.cssFontWeight = 'bold';
    } else {
      result.cssFontWeight = 'normal';
    }
    
    if (font.names.fontSubfamily?.en?.toLowerCase().indexOf('italic') > -1) {
      result.cssFontStyle = 'italic';
    } else {
      result.cssFontStyle = 'normal';
    }
    
    // Process all glyphs using the facetype.js approach
    for (let i = 0; i < font.numGlyphs; i++) {
      const glyph = font.glyphs.get(i);
      if (!glyph) continue;
      
      const unicodes = [];
      
      // Collect all unicode values for this glyph
      if (glyph.unicode !== undefined) {
        unicodes.push(glyph.unicode);
      }
      if (glyph.unicodes && glyph.unicodes.length) {
        glyph.unicodes.forEach(function(unicode) {
          if (unicodes.indexOf(unicode) == -1) {
            unicodes.push(unicode);
          }
        });
      }
      
      // Process each unicode for this glyph
      unicodes.forEach(function(unicode) {
        const glyphCharacter = String.fromCharCode(unicode);
        
        // Create glyph data in the format Three.js expects
        const token = {
          ha: Math.round(glyph.advanceWidth * scale),
          x_min: Math.round(glyph.xMin * scale),
          x_max: Math.round(glyph.xMax * scale),
          o: ""
        };
        
        // Process path commands directly (same as facetype.js)
        if (glyph.path && glyph.path.commands) {
          glyph.path.commands.forEach(function(command, i) {
            // Convert 'C' to 'b' for Three.js compatibility
            if (command.type.toLowerCase() === "c") {
              command.type = "b";
            }
            
            // Add command type (lowercase)
            token.o += command.type.toLowerCase();
            token.o += " ";
            
            // Add coordinates with proper spacing
            if (command.x !== undefined && command.y !== undefined) {
              token.o += Math.round(command.x * scale);
              token.o += " ";
              token.o += Math.round(command.y * scale);
              token.o += " ";
            }
            
            // Add control points for curves
            if (command.x1 !== undefined && command.y1 !== undefined) {
              token.o += Math.round(command.x1 * scale);
              token.o += " ";
              token.o += Math.round(command.y1 * scale);
              token.o += " ";
            }
            
            if (command.x2 !== undefined && command.y2 !== undefined) {
              token.o += Math.round(command.x2 * scale);
              token.o += " ";
              token.o += Math.round(command.y2 * scale);
              token.o += " ";
            }
          });
        }
        
        // Store the glyph
        result.glyphs[glyphCharacter] = token;
      });
    }
    
    // Write JSON file
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    console.log(`  ✓ Successfully converted ${fontFile} to ${jsonFileName} (${Object.keys(result.glyphs).length} glyphs)`);
    
    // Delete TTF file if requested
    if (deleteTtf) {
      fs.unlinkSync(fontPath);
      console.log(`  🗑️  Deleted ${fontFile}`);
    }
    
  } catch (error) {
    console.error(`  ✗ Error converting ${fontFile}:`, error.message);
  }
});

console.log('\nFont conversion completed!');
if (deleteTtf) {
  console.log('Font files have been deleted as requested.');
} else {
  console.log('Font files have been preserved. Use -d or --delete-ttf to delete them after conversion.');
}
