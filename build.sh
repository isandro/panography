#!/bin/bash
# build.sh — package Vosges Hiking Planner as a standalone desktop app
#
# macOS → dist/Vosges Hiking Planner.app  (drag to Applications)
# Windows → dist/Vosges Hiking Planner/Vosges Hiking Planner.exe
# Linux → dist/Vosges Hiking Planner/Vosges Hiking Planner
#
# First-time setup:
#   pip install -r requirements.txt pyinstaller

set -e
cd "$(dirname "$0")"

pyinstaller \
  --name "Vosges Hiking Planner" \
  --windowed \
  --onedir \
  --add-data "index.html:." \
  --add-data "styles.css:." \
  --add-data "map.js:." \
  --add-data "schedules.json:." \
  --add-data "data:data" \
  --clean \
  app.py

echo ""
echo "Build complete → dist/Vosges Hiking Planner"
