#!/bin/bash

# Change to icons directory
cd icons

# Create a backup folder
mkdir -p backup
echo "Created backup folder..."

# Move all files except the ones we want to keep to backup
echo "Moving files to backup..."
for file in *; do
  # Skip these files - they're the only ones we want to keep
  if [[ "$file" != "Aegis Icon 16.png" && 
        "$file" != "Aegis Icon 48.png" && 
        "$file" != "Aegis Icon 128.png" && 
        "$file" != "badge16.png" && 
        "$file" != "badge48.png" && 
        "$file" != "badge128.png" && 
        "$file" != "aegis-logo.svg" ]]; then
    mv "$file" backup/
    echo "  Moved: $file"
  fi
done

# Rename the icon files to match what's in manifest.json
echo "Renaming icon files..."
mv "Aegis Icon 16.png" "icon16.png"
mv "Aegis Icon 48.png" "icon48.png"
mv "Aegis Icon 128.png" "icon128.png"

echo "Cleanup complete! Unnecessary files are in the backup folder."
echo "You can delete the backup folder once you verify everything works." 