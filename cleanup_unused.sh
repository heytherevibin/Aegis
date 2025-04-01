#!/bin/bash

# Create a backup directory
mkdir -p backup

# List of unused files to move to backup
UNUSED_FILES=(
  "background.mjs"
  "userLearning.js"
  "config.js"
  ".env"
  ".DS_Store"
)

# Move unused files to backup
for file in "${UNUSED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Moving $file to backup/"
    mv "$file" backup/
  fi
done

# Clean up other temporary files
if [ -f "generate_icons.sh" ]; then
  echo "Moving generate_icons.sh to backup/"
  mv generate_icons.sh backup/
fi

if [ -f "cleanup_icons.sh" ]; then
  echo "Moving cleanup_icons.sh to backup/"
  mv cleanup_icons.sh backup/
fi

echo "Cleanup complete! Unused files have been moved to the backup directory."
echo "You can delete the backup directory once you've verified everything works correctly." 