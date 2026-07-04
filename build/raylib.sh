#!/usr/bin/env bash
# ============================================================
# build/raylib.sh — build the raylib (C) port of Asteroids
# ============================================================
# Pipeline:  framec (asteroids.fc -> asteroids.c)  ->  emcc (raylib + host)
#            ->  games/asteroids/versions/raylib/
#
# The FSM is the SAME Frame source as the Godot-C port (build/spike-c/
# asteroids.fc) — reused verbatim. It's engine-agnostic pure C (its own
# Vector2 + a ShipHost struct of function pointers), so the only thing that
# differs between the Godot-C and raylib ports is the host (raylib_host.c).
#
# Pre-reqs:  framec (FRAMEC), emsdk 4.0.20 sourced (emcc on PATH). raylib is
# cloned + built for web here on first run (no system install needed).
# ============================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE="$REPO/build/spike-raylib"
RAYLIB="$SPIKE/raylib"
OUT="$REPO/games/asteroids/versions/raylib"
FRAMEC="${FRAMEC:-framec}"
RAYLIB_TAG="${RAYLIB_TAG:-5.5}"

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not on PATH — source your emsdk (4.0.20): source ~/emsdk/emsdk_env.sh"
  exit 1
fi

echo "==> [1/3] raylib for web (clone + build if missing)"
if [ ! -f "$RAYLIB/src/libraylib.a" ]; then
  [ -d "$RAYLIB/.git" ] || git clone --depth 1 --branch "$RAYLIB_TAG" \
      https://github.com/raysan5/raylib.git "$RAYLIB"
  ( cd "$RAYLIB/src" && make PLATFORM=PLATFORM_WEB -B GRAPHICS=GRAPHICS_API_OPENGL_ES2 )
fi

echo "==> [2/3] framec: ../spike-c/asteroids.fc -> asteroids.c (shared FSM)"
"$FRAMEC" -l c "$REPO/build/spike-c/asteroids.fc" > "$SPIKE/asteroids.c" 2>/dev/null

echo "==> [3/3] emcc: raylib_host.c + libraylib.a -> $OUT"
( cd "$SPIKE" && emcc -o index.html raylib_host.c raylib/src/libraylib.a \
    -I raylib/src -Os -Wall \
    -s USE_GLFW=3 -s ASYNCIFY -s GL_ENABLE_GET_PROC_ADDRESS -s ALLOW_MEMORY_GROWTH=1 \
    --shell-file shell.html -DPLATFORM_WEB )
rm -rf "$OUT"; mkdir -p "$OUT"
cp "$SPIKE/index.html" "$SPIKE/index.js" "$SPIKE/index.wasm" "$OUT/"
echo "==> done ($(du -sh "$OUT" | cut -f1))"
