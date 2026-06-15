#!/usr/bin/env bash
# ============================================================
# build/godot-cpp.sh — build the C++ (godot-cpp GDExtension) port of Asteroids
# ============================================================
# Pipeline:  framec (.fcpp -> .cpp)  ->  clang++ (arm64 .dylib) + em++ (web .wasm)
#            ->  godot Web export  ->  games/asteroids/versions/godot-cpp/
#
# Two C++-specific gotchas this captures:
#   1. godot-cpp has NO 4.6 release branch — `master` had drifted and segfaults
#      in StringName::init_bindings on the 4.6.2 engine. We build against the
#      stable `godot-4.5-stable` tag (cloned at build/spike-cpp/godot-cpp-45),
#      which is forward-compatible (older godot-cpp on a newer engine is OK).
#   2. Godot's web engine has NO C++ exception runtime, so the extension is
#      built `-fno-exceptions` against a `disable_exceptions=yes` godot-cpp.
#      That requires framec's no-exceptions C++ codegen (issue #86 fix —
#      RAII context-stack guard instead of try/catch). Verify with:
#         grep -c 'try {' asteroids.cpp   # must be 0
#
# Pre-reqs:  framec WITH the #86 fix (set FRAMEC), godot 4.6.x, emsdk 4.0.20,
#            and godot-cpp-45 prebuilt (arm64 + web nothreads, no-exceptions web).
# ============================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE="$REPO/build/spike-cpp"
GC="$SPIKE/godot-cpp-45"
GD="$SPIKE/godot"
OUT="$REPO/games/asteroids/versions/godot-cpp"
FRAMEC="${FRAMEC:-framec}"
GODOT="${GODOT:-godot}"
INC=(-I "$GC/include" -I "$GC/gen/include" -I "$GC/gdextension")

echo "==> [1/4] framec: asteroids.fcpp -> asteroids.cpp (must be exception-free)"
"$FRAMEC" -l cpp "$SPIKE/asteroids.fcpp" > "$SPIKE/asteroids.cpp"
n=$(grep -cE '\btry \{|\} catch|\bthrow\b' "$SPIKE/asteroids.cpp" || true)
[ "$n" -eq 0 ] || { echo "error: $n try/catch/throw in generated C++ — needs the #86 no-exceptions fix"; exit 1; }

echo "==> [2/4] clang++: arm64 macOS dylib (export host) — -fno-exceptions"
( cd "$SPIKE" && clang++ -std=c++17 -arch arm64 -fno-exceptions -fvisibility=hidden -shared \
    "${INC[@]}" register_types.cpp "$GC/bin/libgodot-cpp.macos.template_release.arm64.a" \
    -o "$GD/bin/libasteroids.macos.template_release.arm64.dylib" )

echo "==> [2b]  em++: web wasm32 side module — -fno-exceptions, no-exc godot-cpp"
if ! command -v em++ >/dev/null 2>&1; then
  echo "    ! em++ not on PATH — source ~/emsdk/emsdk_env.sh (4.0.20). Skipping web."
else
  ( cd "$SPIKE" && em++ -std=c++17 -O2 -fno-exceptions -fvisibility=hidden \
      -sSIDE_MODULE=1 -sWASM_BIGINT -sSUPPORT_LONGJMP=0 \
      "${INC[@]}" register_types.cpp "$GC/bin/libgodot-cpp.web.template_release.wasm32.nothreads.a" \
      -o "$GD/bin/libasteroids.web.template_release.wasm32.nothreads.wasm" )
fi

echo "==> [3/4] godot Web export (auto-imports; doc-gen cleanup may hang — handled)"
rm -rf "$GD/.godot" "$GD/out"; mkdir -p "$GD/out"
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
