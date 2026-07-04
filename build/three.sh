#!/usr/bin/env bash
# Build the TypeScript / three.js Asteroids port -> games/asteroids/versions/three/
#
# Pipeline:
#   asteroids.fts  --(framec, typescript backend)-->  asteroids.ts   (the Frame FSM)
#   main.ts + asteroids.ts  --(esbuild bundle, three.js)-->  bundle.js
#
# The typescript backend is native-passthrough (like js/python/ruby): handler
# bodies are hand-written native TypeScript, not the brace style the C-family
# translates. Requires: framec on PATH (or ~/.cargo/bin/framec) and `three`
# installed in build/spike-three/node_modules (npm install three).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$HERE/spike-three"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/games/asteroids/versions/three"
FRAMEC="${FRAMEC:-$(command -v framec || echo "$HOME/.cargo/bin/framec")}"
ESBUILD="$ROOT/node_modules/.bin/esbuild"

echo "==> framec: regenerate asteroids.ts from asteroids.fts"
"$FRAMEC" -l typescript "$SPIKE/asteroids.fts" > "$SPIKE/asteroids.ts"

echo "==> esbuild: bundle main.ts + three.js -> bundle.js"
[ -d "$SPIKE/node_modules/three" ] || (cd "$SPIKE" && npm install --silent three@0.169.0)
"$ESBUILD" "$SPIKE/main.ts" --bundle --format=iife --minify --target=es2020 \
  --outfile="$SPIKE/bundle.js"

echo "==> publish -> $OUT"
mkdir -p "$OUT"
cp "$SPIKE/index.html" "$SPIKE/bundle.js" "$OUT/"

echo "done. bundle: $(du -h "$OUT/bundle.js" | cut -f1)"
