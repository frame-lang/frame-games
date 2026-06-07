#!/usr/bin/env bash
# Generate the Frame artifacts (machine.js + dot) the page imports live.
# Generated files are gitignored, so a fresh checkout won't have them —
# this regenerates them in place. Requires framec >= 4.3.0 on PATH.
#
# Each game's source lives at games/<id>/src/<id>.fjs and outputs land
# beside it as <id>.machine.js + <id>.dot.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v framec >/dev/null 2>&1; then
  echo "error: framec not found on PATH (need >= 4.3.0)." >&2
  exit 1
fi

GAMES=(asteroids)

for game in "${GAMES[@]}"; do
  dir="games/$game/src"
  framec -l javascript "$dir/$game.fjs" > "$dir/$game.machine.js"
  framec -l graphviz   "$dir/$game.fjs" > "$dir/$game.dot"
  echo "generated: $game"
done

# Showcase's own controller — the Frame machine that decides which game
# version (JS / Godot WASM) is mounted on the page. Treats the page itself
# as a state machine, dog-fooding the same Frame compiler.
framec -l javascript src/page.fjs > src/page.machine.js
framec -l graphviz   src/page.fjs > src/page.dot
echo "generated: page (machine.js + dot)"
