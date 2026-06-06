#!/usr/bin/env bash
# Generate the Frame artifacts (machine.js + dot) the page imports live.
# Generated files are gitignored, so a fresh checkout won't have them —
# this regenerates them in place. Requires framec >= 4.3.0 on PATH.
#
# Games are split into two tables:
#   LOCAL_GAMES — sources live in games/<id>/src/ (frame-games proper).
#   VENDOR_GAMES — sources live in the deprecated frame-arcade-js submodule;
#     these will migrate to LOCAL_GAMES one at a time. Both tables run
#     through the same framec invocations.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v framec >/dev/null 2>&1; then
  echo "error: framec not found on PATH (need >= 4.3.0)." >&2
  exit 1
fi

LOCAL_GAMES=(asteroids)
VENDOR_GAMES=(breakout pong invaders pacman platformer shooter stealth)
JS_ROOT="vendor/frame-arcade-js"

for game in "${LOCAL_GAMES[@]}"; do
  dir="games/$game/src"
  framec -l javascript "$dir/$game.fjs" > "$dir/$game.machine.js"
  framec -l graphviz   "$dir/$game.fjs" > "$dir/$game.dot"
  echo "generated (local): $game"
done

for game in "${VENDOR_GAMES[@]}"; do
  dir="$JS_ROOT/src/games/$game"
  framec -l javascript "$dir/$game.fjs" > "$dir/$game.machine.js"
  framec -l graphviz   "$dir/$game.fjs" > "$dir/$game.dot"
  echo "generated (vendor): $game"
done

# Showcase's own controller — the Frame machine that decides which game
# version (JS / Godot WASM) is mounted on the page. Treats the page itself
# as a state machine, dog-fooding the same Frame compiler.
framec -l javascript src/page.fjs > src/page.machine.js
framec -l graphviz   src/page.fjs > src/page.dot
echo "generated: page (machine.js + dot)"
