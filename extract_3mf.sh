#!/bin/bash

# Script to extract 3MF files to folders with prefixed periods
# Usage: ./extract_3mf.sh

# Check if we're in the right directory
if [ ! -d "public/3mf" ]; then
    echo "Error: public/3mf directory not found. Make sure you're running this from the project root."
    exit 1
fi

# Change to the public/3mf directory
cd public/3mf

# Loop through all .3mf files
for file in *.3mf; do
    if [ -f "$file" ]; then
        # Get the base name without extension
        basename=$(basename "$file" .3mf)
        
        # Create the target directory with prefixed period
        target_dir=".$basename"
        
        # Safety checks to prevent dangerous rm -rf operations
        if [ -z "$target_dir" ] || [ "$target_dir" = "." ] || [ "$target_dir" = ".." ] || [[ "$target_dir" == *"/"* ]] || [[ "$target_dir" == *".."* ]]; then
            echo "  ✗ Skipping $file - invalid target directory name: $target_dir"
            continue
        fi
        
        echo "Extracting $file to $target_dir/"
        
        # Remove existing directory if it exists
        if [ -d "$target_dir" ]; then
            echo "  Removing existing directory $target_dir/"
            rm -rf "$target_dir"
        fi
        
        # Create the target directory
        mkdir -p "$target_dir"
        
        # Extract the 3MF file (which is a ZIP archive)
        unzip -q "$file" -d "$target_dir"
        
        if [ $? -eq 0 ]; then
            echo "  ✓ Successfully extracted to $target_dir/"
        else
            echo "  ✗ Failed to extract $file"
        fi
    fi
done

echo "Extraction complete!"
echo "Extracted folders:"
ls -la | grep "^\." | grep -v "^\.\.$"
