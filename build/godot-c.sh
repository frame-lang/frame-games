#!/usr/bin/env bash
# ============================================================
# build/godot-c.sh — build the C (raw GDExtension) port of Asteroids
# ============================================================
# Pipeline:  framec (.fc -> .c)  ->  clang (arm64 .dylib) + emcc (web .wasm)
#            ->  godot import + Web export  ->  games/asteroids/versions/godot-c/
#
# The C port uses the raw GDExtension C ABI (no binding library), so engine
# calls go through classdb_get_method_bind + ptrcall against Godot 4.6.2's
# version hashes (hard-coded in gameplay.c). It is binding-less, which is why
# it is forward/back-compatible where godot-cpp is version-pinned.
#
# Pre-reqs:  framec on PATH (or set FRAMEC), godot 4.6.x (or GODOT),
#            emsdk 4.0.20 sourced (~/emsdk/emsdk_env.sh).
# Notes:
#   - We skip an explicit `--import`: it triggers a Godot 4.6.2 editor-only
#     crash (EditorHelp::_gen_extensions_docs), and `--export-release` is a
#     non-editor path that auto-imports a fresh project, so it isn't needed.
#   - The Web preset needs variant/extensions_support=true (GDExtension dlink).
#   - On wasm32 floats round-trip correctly only with framec >= the #81 fix
#     (heap-boxed doubles); older framec silently zeroes every float.
# ============================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE="$REPO/build/spike-c"
GD="$SPIKE/godot"
OUT="$REPO/games/asteroids/versions/godot-c"
FRAMEC="${FRAMEC:-framec}"
GODOT="${GODOT:-godot}"

echo "==> [1/4] framec: asteroids.fc -> asteroids.c"
"$FRAMEC" -l c "$SPIKE/asteroids.fc" > "$SPIKE/asteroids.c"

echo "==> [2/4] clang: arm64 macOS dylib (host introspection + native play)"
( cd "$SPIKE" && clang -std=c11 -arch arm64 -O2 -fvisibility=hidden -fPIC -shared \
    -I. gameplay.c -lm -o "$GD/bin/libasteroids.macos.arm64.dylib" )

echo "==> [2b]  emcc: web wasm32 side module (no exceptions — C has none)"
if ! command -v emcc >/dev/null 2>&1; then
  echo "    ! emcc not on PATH — source ~/emsdk/emsdk_env.sh (needs 4.0.20). Skipping web."
else
  ( cd "$SPIKE" && emcc -std=c11 -O2 -fno-exceptions \
      -sSIDE_MODULE=1 -sWASM_BIGINT -sSUPPORT_LONGJMP=0 \
      -I. gameplay.c -o "$GD/bin/libasteroids.web.wasm32.nothreads.wasm" )
fi

echo "==> [3/4] godot Web export (auto-imports; avoids the editor doc-gen crash)"
rm -rf "$GD/.godot" "$GD/out"; mkdir -p "$GD/out"
# The 4.6.2 editor doc-gen crashes/hangs during export *cleanup*, after the
# full bundle (~11 files) is written. Run in the background, wait for the
# bundle to land, then stop godot so the hung cleanup can't block the build.
arch -arm64 "$GODOT" --headless --path "$GD" --export-release "Web" "$GD/out/index.html" >/dev/null 2>&1 &
for _ in $(seq 1 150); do
  [ -f "$GD/out/index.pck" ] && [ "$(ls "$GD/out" 2>/dev/null | wc -l)" -ge 10 ] && break
  sleep 1
done
# The export writes the full bundle, then hangs UNKILLABLY in the 4.6.2 editor
# doc-gen cleanup (UE state — a known engine bug, cleared only by reboot). Don't
# wait on it (would block forever) and don't bother killing it (SIGKILL is
# ignored in UE); the bundle is already on disk, so just detach and move on.
disown 2>/dev/null || true
[ -f "$GD/out/index.pck" ] || { echo "error: export produced no index.pck"; exit 1; }

echo "==> [4/4] split into shared engine (../_engine) + thin game dir"
bash "$REPO/build/share-engine.sh" "$GD/out" "$OUT"
echo "==> done"
