#!/bin/bash

set -e
cd "$(dirname "$0")"

# --- File list ---
FILES_TO_INCLUDE=(
  "background.js"
  "content.js"
  "manifest.json"
  "popup.css"
  "popup.html"
  "popup.js"
  "turndown.js"
  "icons"
  "fonts"
)

ZIP_FILE="Simple-Exporter-for-Gemini.zip"

BUILD_DIR="build"
echo "Cleaning build dir..."
rm -rf "$BUILD_DIR"
rm -f "$ZIP_FILE"

mkdir -p "$BUILD_DIR"
cp -r "${FILES_TO_INCLUDE[@]}" "$BUILD_DIR/"
(cd "$BUILD_DIR" && zip -r "../$ZIP_FILE" .)
rm -rf "$BUILD_DIR"

echo "'$ZIP_FILE' created successfully."
