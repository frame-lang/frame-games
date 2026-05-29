#!/usr/bin/env bash
# Generate the Frame artifacts that frame-games imports live from the
# frame-arcade-js submodule. The generated *.machine.js and *.dot are gitignored
# inside that submodule (build artifacts), so a fresh checkout won't have them —
# this regenerates them in place. Requires framec >= 4.3.0 on PATH.
set -euo pipefail

cd "$(dirname "$0")/.."
JS_ROOT="vendor/frame-arcade-js"

if ! command -v framec >/dev/null 2>&1; then
  echo "error: framec not found on PATH (need >= 4.3.0). See the frame-arcade-js README." >&2
  exit 1
fi

# Games whose JS version frame-games embeds. Add ids here as games come online.
GAMES=(breakout)

for game in "${GAMES[@]}"; do
  dir="$JS_ROOT/src/games/$game"
  framec -l javascript "$dir/$game.fjs" > "$dir/$game.machine.js"
  framec -l graphviz   "$dir/$game.fjs" > "$dir/$game.dot"
  echo "generated: $game (machine.js + dot)"
done
