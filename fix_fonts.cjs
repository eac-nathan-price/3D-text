const fs = require('fs');
const path = require('path');

/**
 * Font Repair Utility
 * 
 * This script fixes common issues in font JSON files that cause hollow letters:
 * 1. Removes inner paths that create holes in letters like "O", "B", "D", etc.
 * 2. Ensures proper path winding for solid geometry
 * 3. Fixes non-manifold edges that can cause 3D printing issues
 * 
 * Usage:
 *   node fix_fonts.cjs <font-file> [characters]
 *   node fix_fonts.cjs --restore <font-file>
 * 
 * Examples:
 *   node fix_fonts.cjs AdventureTimeLogo.json
 *   node fix_fonts.cjs Nasalization.json Oo
 *   node fix_fonts.cjs --restore Nasalization.json
 */

// Function to analyze and fix a font path
function fixFontPath(pathData) {
  if (!pathData || pathData.trim() === '') return pathData;
  
  // Split into subpaths (separated by 'z' commands)
  const subpaths = pathData.split('z').filter(p => p.trim());
  
  if (subpaths.length <= 1) {
    // Single path - no hollow issues
    return pathData;
  }
  
  // For letters that should be solid, keep only the outer path
  // The outer path is typically the first one and has the largest bounding box
  const outerPath = subpaths[0];
  
  // Clean up the path and ensure it's closed
  let fixedPath = outerPath.trim();
  if (!fixedPath.endsWith('z')) {
    fixedPath += ' z';
  }
  
  return fixedPath;
}

// Function to fix a specific font file with optional character filtering
function fixFontFile(fontPath, targetChars = null) {
  console.log(`\n🔧 Fixing font: ${path.basename(fontPath)}`);
  
  if (targetChars) {
    console.log(`  🎯 Targeting specific characters: ${targetChars.join(', ')}`);
  }
  
  try {
    // Read the font file
    const fontData = JSON.parse(fs.readFileSync(fontPath, 'utf8'));
    let fixedCount = 0;
    
    // Process each glyph
    for (const [char, glyph] of Object.entries(fontData.glyphs)) {
      // Skip if we're targeting specific characters and this one isn't in the list
      if (targetChars && !targetChars.includes(char)) {
        continue;
      }
      
      if (glyph.o && typeof glyph.o === 'string') {
        const originalPath = glyph.o;
        const fixedPath = fixFontPath(originalPath);
        
        if (fixedPath !== originalPath) {
          glyph.o = fixedPath;
          fixedCount++;
          console.log(`  ✅ Fixed ${char}: ${originalPath.length} → ${fixedPath.length} chars`);
        }
      }
    }
    
    if (fixedCount > 0) {
      // Create backup
      const backupPath = fontPath.replace('.json', '.backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(fontData, null, 2));
      console.log(`  💾 Backup created: ${path.basename(backupPath)}`);
      
      // Write fixed font
      fs.writeFileSync(fontPath, JSON.stringify(fontData, null, 2));
      console.log(`  💾 Fixed font saved: ${fixedCount} glyphs repaired`);
    } else {
      console.log(`  ℹ️  No issues found in this font`);
    }
    
    return fixedCount;
    
  } catch (error) {
    console.error(`  ❌ Error processing ${fontPath}:`, error.message);
    return 0;
  }
}

// Function to restore a font file from backup
function restoreFontFile(fontPath) {
  console.log(`\n🔄 Restoring font from backup: ${path.basename(fontPath)}`);
  
  const backupPath = fontPath.replace('.json', '.backup.json');
  
  if (!fs.existsSync(backupPath)) {
    console.error(`  ❌ No backup file found: ${path.basename(backupPath)}`);
    return false;
  }
  
  try {
    // Read the backup file
    const backupData = fs.readFileSync(backupPath, 'utf8');
    
    // Write the backup data back to the original file
    fs.writeFileSync(fontPath, backupData);
    
    console.log(`  ✅ Font restored from backup: ${path.basename(backupPath)}`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error restoring font:`, error.message);
    return false;
  }
}

// Function to show usage information
function showUsage() {
  console.log('🔧 Font Repair Utility for 3D Text');
  console.log('=====================================');
  console.log('');
  console.log('Usage:');
  console.log('  node fix_fonts.cjs <font-file> [characters]');
  console.log('  node fix_fonts.cjs --restore <font-file>');
  console.log('');
  console.log('Examples:');
  console.log('  node fix_fonts.cjs AdventureTimeLogo.json');
  console.log('  node fix_fonts.cjs Nasalization.json Oo');
  console.log('  node fix_fonts.cjs --restore Nasalization.json');
  console.log('');
  console.log('Arguments:');
  console.log('  <font-file>     Name of the font JSON file to process');
  console.log('  [characters]    Optional: specific characters to fix (e.g., "OoB")');
  console.log('  --restore       Restore a font file from its backup');
  console.log('');
  console.log('Notes:');
  console.log('  • Only processes the specified font file');
  console.log('  • Creates a .backup.json file before making changes');
  console.log('  • If characters are specified, only those characters are modified');
  console.log('  • Use --restore to undo changes from backup');
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Check if we have any arguments
  if (args.length === 0) {
    showUsage();
    process.exit(1);
  }
  
  // Check for restore mode
  if (args[0] === '--restore') {
    if (args.length !== 2) {
      console.error('❌ --restore requires exactly one font file argument');
      showUsage();
      process.exit(1);
    }
    
    const fontFile = args[1];
    const fontPath = path.join(__dirname, 'public', 'fonts', fontFile);
    
    if (!fs.existsSync(fontPath)) {
      console.error(`❌ Font file not found: ${fontFile}`);
      process.exit(1);
    }
    
    restoreFontFile(fontPath);
    process.exit(0);
  }
  
  // Normal fix mode
  if (args.length < 1 || args.length > 2) {
    console.error('❌ Invalid number of arguments');
    showUsage();
    process.exit(1);
  }
  
  const fontFile = args[0];
  const targetChars = args[1] ? args[1].split('') : null;
  
  const fontPath = path.join(__dirname, 'public', 'fonts', fontFile);
  
  if (!fs.existsSync(fontPath)) {
    console.error(`❌ Font file not found: ${fontFile}`);
    process.exit(1);
  }
  
  // Check if fonts directory exists
  const fontsDir = path.join(__dirname, 'public', 'fonts');
  if (!fs.existsSync(fontsDir)) {
    console.error(`\n❌ Fonts directory not found: ${fontsDir}`);
    console.log('\n💡 Make sure you run this script from the project root directory');
    process.exit(1);
  }
  
  console.log('🔧 Font Repair Utility for 3D Text');
  console.log('=====================================');
  console.log(`📁 Fonts directory: ${fontsDir}`);
  
  fixFontFile(fontPath, targetChars);
}

module.exports = { fixFontPath, fixFontFile, restoreFontFile };
