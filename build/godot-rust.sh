#!/usr/bin/env bash
# ============================================================
# build/godot-rust.sh — build the Rust (gdext GDExtension) port of Asteroids
# ============================================================
# Pipeline:  cargo (wasm32 side module, build-std) + cargo (arm64 host dylib)
#            ->  godot import + Web export  ->  games/asteroids/versions/godot-rust/
#
# Uses godot-rust (gdext) with the `api-custom` feature, which introspects the
# local godot binary at build time so bindings auto-match 4.6.2 — gdext tracks
# the engine version cleanly (unlike godot-cpp, which is release-branch-pinned).
#
# Pre-reqs:  rustup nightly + rust-src, emsdk 4.0.20 sourced, godot 4.6.x.
#   - GDRUST_GODOT_BIN must point at the godot binary (api-custom dumps its API).
#   - wasm flags live in build/spike-rust/rust/.cargo/config.toml (SIDE_MODULE=2).
#   - macOS host dylib is arm64 (matches the arm64 godot we export under; no x86).
#   - FRAMEC regenerates src/asteroids.rs from asteroids.frs (the FSM source);
#     gameplay.rs/lib.rs are hand-written and not generated.
# ============================================================
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPIKE="$REPO/build/spike-rust"
RUST="$SPIKE/rust"
GD="$SPIKE/godot"
OUT="$REPO/games/asteroids/versions/godot-rust"
GODOT="${GODOT:-godot}"
FRAMEC="${FRAMEC:-framec}"
export GDRUST_GODOT_BIN="${GDRUST_GODOT_BIN:-$(command -v "$GODOT")}"

echo "==> [0/4] framec: asteroids.frs -> src/asteroids.rs (FSM)"
"$FRAMEC" -l rust "$RUST/asteroids.frs" > "$RUST/src/asteroids.rs"

echo "==> [1/4] cargo: web wasm32 side module (build-std)"
( cd "$RUST" && cargo +nightly build -Zbuild-std \
    --target wasm32-unknown-emscripten --release )

echo "==> [2/4] cargo: arm64 macOS host dylib"
( cd "$RUST" && cargo +nightly build --release --target aarch64-apple-darwin )

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
