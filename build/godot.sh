#!/usr/bin/env bash
# ============================================================
# build/godot.sh — export the Godot WASM build of a game
# ============================================================
#   build/godot.sh <id>       # build a single game's Web export
#   build/godot.sh all        # build every registered game
#
# Drops the Web export at games/<id>/versions/godot-gdscript/
# (index.html / .pck / .wasm / .js / .audio.worklet.js / …).
# The game page's iframe loads from that path; the .pck probe in
# game.ts confirms the build actually ran before embedding.
#
# Strategy: each game's Godot project lives at games/<id>/godot/.
# We stage a copy under build/godot-<id>/ and add the export preset
# + a per-game live_state_publisher autoload to THAT copy so the
# original directory stays clean.
#
# Pre-reqs:
#   - godot 4.x on PATH (or set GODOT=/path/to/godot)
#   - matching Godot export templates (Web) installed
#   - framec on PATH
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Per-game config. Each SYSTEMS entry is "SystemName:fsm.<path>" — the path is
# a GDScript expression rooted at the scene's `fsm` field that yields an object
# carrying .__compartment.state. Trailing [N] is treated as safe-indexed (the
# generated autoload guards against an empty array, so it does the right thing
# in attract / pre-spawn states).
case "${1:-}" in
    asteroids)   SYSTEMS=("AsteroidsGame:fsm" "Ship:fsm.ship" "AsteroidField:fsm.field") ;;
    all)
        # Build each game in turn. Skip a failure and continue with the rest;
        # the summary at the end shows which produced an index.pck.
        for g in asteroids; do
            bash "$0" "$g" || echo "  ! $g failed; continuing"
        done
        echo
        echo "=========================================================="
        echo "==> summary"
        for g in asteroids; do
            if [[ -f "$REPO_DIR/games/$g/versions/godot-gdscript/index.pck" ]]; then
                printf "    ok   %s\n" "$g"
            else
                printf "    MISS %s\n" "$g"
            fi
        done
        exit 0
        ;;
    *)
        echo "usage: build/godot.sh <id|all>"
        echo "  ids: asteroids"
        exit 1
        ;;
esac

GAME="$1"
STAGE_DIR="$REPO_DIR/build/godot-$GAME"
OUT_DIR="$REPO_DIR/games/$GAME/versions/godot-gdscript"

SRC_PROJECT="$REPO_DIR/games/$GAME"
FRAME_SRC="$SRC_PROJECT/frame/$GAME.fgd"
GENERATED_DIR="$SRC_PROJECT/generated"
GODOT_DIR="$SRC_PROJECT/godot"

GODOT_BIN="${GODOT:-godot}"
if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
    echo "error: '$GODOT_BIN' not found"
    echo "set GODOT env var to the binary path, e.g.:"
    echo "  GODOT=/usr/local/bin/godot npm run build:godot $GAME"
    exit 1
fi

echo "=========================================================="
echo "==> $GAME"
echo "=========================================================="

echo "==> regenerate .gd from Frame source"
mkdir -p "$GENERATED_DIR" "$GODOT_DIR/scripts"
framec compile "$FRAME_SRC" --language gdscript -o "$GENERATED_DIR/"
cp "$GENERATED_DIR/$GAME.gd" "$GODOT_DIR/scripts/$GAME.gd"

echo "==> stage Godot project at $STAGE_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -R "$GODOT_DIR/." "$STAGE_DIR/"

echo "==> inject live_state_publisher.gd"
# The autoload posts a per-game state snapshot onto the BroadcastChannel that
# frame-games's FSM popout listens on (channelName(id) in src/games.ts). Each
# system in SYSTEMS becomes a read into a local var, then a snapshot field.
# Safe-array-indexed paths emit `if arr.size() > N` so attract / pre-spawn
# states don't crash.
PUB="$STAGE_DIR/scripts/live_state_publisher.gd"
{
    cat <<EOF
# Auto-injected by frame-games/build/godot.sh — do not edit by hand.
# Reads each FSM's current Frame compartment state and pushes a snapshot
# onto a BroadcastChannel that frame-games's FSM popout (fsm.html) listens
# on. Web-only — non-web exports are no-ops.
extends Node

const CHANNEL_NAME := "frame-games:state:${GAME}"

var _channel: JavaScriptObject = null
var _on_message_ref: JavaScriptObject = null
var _last_sig: String = ""

func _ready() -> void:
    if not OS.has_feature("web"):
        return
    _channel = JavaScriptBridge.create_object("BroadcastChannel", CHANNEL_NAME)
    _on_message_ref = JavaScriptBridge.create_callback(_on_channel_message)
    _channel.onmessage = _on_message_ref

func _process(_dt: float) -> void:
    _publish(false)

func _on_channel_message(args) -> void:
    # Pop-out viewers ping to request a fresh snapshot when they open.
    if args.size() > 0 and args[0].data == "ping":
        _publish(true)

func _publish(force: bool) -> void:
    if _channel == null:
        return
    var scene: Node = get_tree().get_current_scene()
    if scene == null:
        return
    var fsm: Variant = scene.get("fsm")
    if fsm == null:
        return
EOF
    for sys in "${SYSTEMS[@]}"; do
        name="${sys%%:*}"
        expr="${sys##*:}"
        if [[ "$expr" =~ ^(.*)\[([0-9]+)\]$ ]]; then
            arr="${BASH_REMATCH[1]}"
            idx="${BASH_REMATCH[2]}"
            cat <<EOF
    var v_$name: String = ""
    if $arr != null and $arr.size() > $idx:
        v_$name = String($expr.__compartment.state)
EOF
        else
            cat <<EOF
    var v_$name: String = String($expr.__compartment.state)
EOF
        fi
    done
    echo '    var sig: String = ""'
    for sys in "${SYSTEMS[@]}"; do
        name="${sys%%:*}"
        echo "    sig += v_$name + \"|\""
    done
    cat <<EOF
    if not force and sig == _last_sig:
        return
    _last_sig = sig
    var snapshot: JavaScriptObject = JavaScriptBridge.create_object("Object")
EOF
    for sys in "${SYSTEMS[@]}"; do
        name="${sys%%:*}"
        echo "    snapshot.$name = v_$name"
    done
    echo "    _channel.postMessage(snapshot)"
} > "$PUB"

echo "==> register live_state_publisher as autoload"
if grep -q "^\[autoload\]" "$STAGE_DIR/project.godot"; then
    printf '\nLiveStatePublisher="*res://scripts/live_state_publisher.gd"\n' >> "$STAGE_DIR/project.godot"
else
    cat >> "$STAGE_DIR/project.godot" <<'EOF'

[autoload]

LiveStatePublisher="*res://scripts/live_state_publisher.gd"
EOF
fi

echo "==> write Web export preset"
cat > "$STAGE_DIR/export_presets.cfg" <<'EOF'
[preset.0]

name="Web"
platform="Web"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path=""
patches=PackedStringArray()
encryption_include_filters=""
encryption_exclude_filters=""
seed=0
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.0.options]

custom_template/debug=""
custom_template/release=""
variant/extensions_support=true
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=true
html/custom_html_shell=""
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
progressive_web_app/ensure_cross_origin_isolation_headers=true
progressive_web_app/offline_page=""
progressive_web_app/display=1
progressive_web_app/orientation=0
progressive_web_app/icon_144x144=""
progressive_web_app/icon_180x180=""
progressive_web_app/icon_512x512=""
progressive_web_app/background_color=Color(0, 0, 0, 1)
EOF

echo "==> godot export -> $OUT_DIR"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
# `--editor --headless --quit` once on a fresh project so Godot imports the
# resources (.tscn -> .remap, etc.) before the headless export tries to read
# them. Without this first pass the exporter fails with "No main scene".
"$GODOT_BIN" --headless --path "$STAGE_DIR" --editor --quit >/dev/null 2>&1 || true
"$GODOT_BIN" --headless --path "$STAGE_DIR" \
    --export-release "Web" "$OUT_DIR/index.html"

if [[ ! -f "$OUT_DIR/index.pck" ]]; then
    echo "error: export ran but no index.pck produced for $GAME"
    echo "check that Godot export templates (Web) are installed and match the editor version"
    exit 1
fi

echo "==> built $GAME ($(du -sh "$OUT_DIR" | cut -f1))"

# Split the ~46 MB engine out to a shared games/<id>/versions/_engine/ and slim
# this dir to just the .pck + thin loader (exported with extensions_support=true
# so the engine is byte-identical to the C/C++/Rust dlink bundles → one engine
# the browser caches across every language tab).
echo "==> split into shared engine (../_engine) + thin game dir"
bash "$REPO_DIR/build/share-engine.sh" "$OUT_DIR" "$OUT_DIR"
