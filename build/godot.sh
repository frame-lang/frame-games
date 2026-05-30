#!/usr/bin/env bash
# ============================================================
# build/godot.sh — export the Godot WASM build of Breakout
# ============================================================
# Drops the Web export at games/breakout/versions/godot-wasm/
# (index.html / .pck / .wasm / .js / .audio.worklet.js). The
# game page's iframe loads from that path; the .pck probe in
# game.ts confirms the build actually ran before embedding.
#
# Strategy: the Breakout Godot project lives under the
# frame-arcade submodule. We don't add an export preset there
# (would dirty the submodule), so we stage a copy under
# build/godot-breakout/ and add the preset to that copy.
#
# Pre-reqs:
#   - godot 4.x on PATH (or set GODOT=/path/to/godot)
#   - matching Godot export templates installed
#   - framec on PATH (run by the chapter's own build.sh)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_PROJECT="$REPO_DIR/vendor/frame-arcade/ch02-breakout"
STAGE_DIR="$REPO_DIR/build/godot-breakout"
OUT_DIR="$REPO_DIR/games/breakout/versions/godot-wasm"

GODOT_BIN="${GODOT:-godot}"
if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
    echo "error: '$GODOT_BIN' not found"
    echo "set GODOT env var to the binary path, e.g.:"
    echo "  GODOT=/usr/local/bin/godot npm run build:godot"
    exit 1
fi

echo "==> regenerate breakout.gd from Frame source"
( cd "$SRC_PROJECT" && bash build.sh )

echo "==> stage Godot project at $STAGE_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -R "$SRC_PROJECT/godot/." "$STAGE_DIR/"

echo "==> inject live FSM state publisher (BroadcastChannel autoload)"
# Posts the Breakout/Ball state to the same BroadcastChannel the JS version
# uses, so the frame-games FSM popout highlights live states when you play
# the Godot (WASM) tab. Web-only — non-web exports are no-ops.
cat > "$STAGE_DIR/scripts/live_state_publisher.gd" <<'EOF'
# Auto-injected by frame-games/build/godot.sh — do not edit by hand.
# Reads the Breakout FSM's current Frame compartment state every frame and
# pushes a { Breakout, Ball } snapshot onto a BroadcastChannel that
# frame-games's FSM popout (fsm.html) listens on.
extends Node

const CHANNEL_NAME := "frame-games:state:breakout"

var _channel: JavaScriptObject = null
var _on_message_ref: JavaScriptObject = null
var _last_sig := ""

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
    var scene = get_tree().get_current_scene()
    if scene == null:
        return
    var fsm = scene.get("fsm")
    if fsm == null:
        return
    var bk: String = fsm.__compartment.state
    var ball: String = fsm.ball.__compartment.state
    var sig := bk + "|" + ball
    if not force and sig == _last_sig:
        return
    _last_sig = sig
    var snapshot := JavaScriptBridge.create_object("Object")
    snapshot.Breakout = bk
    snapshot.Ball = ball
    _channel.postMessage(snapshot)
EOF

echo "==> register live_state_publisher as autoload in project.godot"
# Append (or replace) the [autoload] section. The original project.godot
# doesn't have one, so a simple append is safe; if a future submodule change
# adds an autoload section we'd need to merge instead.
if grep -q "^\[autoload\]" "$STAGE_DIR/project.godot"; then
    echo "warning: project.godot already has [autoload] — appending entry, but you may want to merge by hand"
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
variant/extensions_support=false
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

echo "==> godot export → $OUT_DIR"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
# `--editor --headless --quit` once on a fresh project so Godot imports the
# resources (.tscn → .remap, etc.) before the headless export tries to read
# them. Without this first pass the exporter fails with "No main scene".
"$GODOT_BIN" --headless --path "$STAGE_DIR" --editor --quit >/dev/null 2>&1 || true
"$GODOT_BIN" --headless --path "$STAGE_DIR" \
    --export-release "Web" "$OUT_DIR/index.html"

if [[ ! -f "$OUT_DIR/index.pck" ]]; then
    echo "error: export ran but no index.pck produced"
    echo "check that Godot export templates (Web) are installed and match the editor version"
    exit 1
fi

echo
echo "==> built artifacts in $OUT_DIR:"
ls -lh "$OUT_DIR"
echo
echo "    Open the game page, switch to the Godot (WASM) tab — the iframe"
echo "    will now load this build instead of falling back to a note."
