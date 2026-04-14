#!/bin/bash
set -e

echo "=== Building VibeShift npm package ==="

# 1. Build all packages
echo "[1/4] Building all packages..."
npx turbo build

# 2. Assemble dist/
echo "[2/4] Assembling dist/..."
rm -rf dist
mkdir -p dist/api dist/mcp dist/shared

# API server
cp -r apps/api/dist/* dist/api/

# MCP server
cp -r packages/mcp-server/dist/* dist/mcp/

# Shared library
cp -r packages/shared/dist/* dist/shared/

# Web (Next.js standalone)
cp -r apps/web/.next/standalone dist/web
cp -r apps/web/.next/static dist/web/apps/web/.next/static
cp -r apps/web/public dist/web/apps/web/public 2>/dev/null || true

# 3. Wire up internal packages so Node.js can resolve @vibeshift/*
echo "[3/4] Wiring internal packages..."
mkdir -p dist/node_modules/@vibeshift/shared/dist
cp -r packages/shared/dist/* dist/node_modules/@vibeshift/shared/dist/
cp packages/shared/package.json dist/node_modules/@vibeshift/shared/

# 4. Build CLI
echo "[4/4] Building CLI..."
npx tsc -p cli/tsconfig.json

# Add shebang to bin.js
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux"* ]]; then
  sed -i '1i#!/usr/bin/env node' dist/bin.js
else
  sed -i '1i#!/usr/bin/env node' dist/bin.js
fi

echo ""
echo "=== Build complete ==="
echo "dist/"
ls dist/
