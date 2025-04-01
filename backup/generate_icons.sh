#!/bin/bash

# Create icons directory if it doesn't exist
mkdir -p icons

# Function to generate icons with hover effect
generate_icons() {
    local base_name=$1
    local hover_brightness=1.1
    
    for size in 16 48 128; do
        # Generate normal icon
        magick convert -background none -size ${size}x${size} icons/${base_name}.svg icons/${base_name}${size}.png
        
        # Generate hover state with increased brightness
        magick convert -background none -size ${size}x${size} icons/${base_name}.svg \
            -modulate 110,100,100 icons/${base_name}${size}_hover.png
    done
}

# Generate all icon variants
generate_icons "icon"
generate_icons "icon_disabled"
generate_icons "icon_warning"
generate_icons "icon_blocked"

# Generate notification badge overlay
for size in 16 48 128; do
    magick convert -size ${size}x${size} xc:none -fill "#EF4444" -draw "circle $((size/2)),$((size/4)) $((size/2)),$((size/3))" \
        -alpha set -background none icons/badge${size}.png
done

# Make the script executable
chmod +x generate_icons.sh 