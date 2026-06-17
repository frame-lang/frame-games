# Asteroids — Godot language ports

Asteroids ships in five implementations, all driven by the same Frame state
machine and selectable from the version drop-down on the game page:

| Version | Source | Build |
|---|---|---|
| JavaScript (Phaser) | `games/asteroids/src/` | bundled by Vite |
| Godot · GDScript | `games/asteroids/godot/` (+ `games/asteroids/frame/`) | `npm run build:godot` |
| Godot · C | `build/spike-c/` | `npm run build:godot-c` |
| Godot · Rust | `build/spike-rust/` | `npm run build:godot-rust` |
| Godot · C++ | `build/spike-cpp/` | `npm run build:godot-cpp` |

The three GDExtension ports (C / Rust / C++) live under `build/spike-*/`. Those
directories are **gitignored except their source** — the Frame/host/godot-project
files are tracked; everything generated or downloaded is not:

- **C** — `asteroids.fc` (Frame), `gameplay.c` (raw GDExtension C host),
  `gdextension_interface.h`, `godot/` project. Ignored: generated `asteroids.c`,
  `godot/bin`, `godot/out`, `godot/.godot`.
- **C++** — `asteroids.fcpp`, `main.cpp`, `register_types.cpp`,
  `gdextension_interface.h`, `godot/` project. Ignored: generated
  `asteroids.cpp`, the `godot-cpp-45/` clone, build outputs.
- **Rust** — `rust/src/*.rs`, `rust/Cargo.{toml,lock}`, `rust/.cargo/config.toml`,
  `godot/` project. Ignored: `rust/target/`, `node_modules/`.

## Shared engine

A Godot web export is ~46 MB, ~99% of it the engine. All four Godot ports use
the **same** dlink engine (exported with `extensions_support=true`), so it's
hoisted to one `games/asteroids/versions/_engine/` and each game dir is just its
`.pck` + extension `.wasm` + a thin loader pointing `executable` at
`../_engine/`. `build/share-engine.sh` performs the split; the build scripts call
it. The browser caches the engine once, so switching language tabs is instant.

## Reproducibility — what a clean clone still needs

The deployable bundles are committed, so the **site runs from a clone**. Rebuilding
the ports is not yet one-command — it assumes this toolchain is present locally:

- **Godot 4.6.2** on `PATH` (or `GODOT=`) + the Web export templates.
- **framec** (`FRAMEC=`) — for C++, needs the no-exceptions codegen (issue #86).
- **emsdk 4.0.20** sourced (`~/emsdk/emsdk_env.sh`) — must match Godot's emscripten.
- **Rust nightly + rust-src** (for `cargo -Zbuild-std`), and `GDRUST_GODOT_BIN=`.
- **godot-cpp at `godot-4.5-stable`** (master segfaults on 4.6.2; 4.5 is
  forward-compatible), prebuilt for arm64 + web (`threads=no`,
  `disable_exceptions=yes` for the web lib) at `build/spike-cpp/godot-cpp-45/`.

Known follow-ups:
- A **toolchain bootstrap** (clone+build godot-cpp 4.5, fetch templates, etc.) so
  the ports rebuild from a clean checkout. Not yet automated.
- The Rust **FSM** (`rust/src/asteroids.rs`) is a checked-in framec-generated file
  with no `.frm` source in-tree — it can't currently be regenerated.
- Each GDExtension export leaves the headless Godot process in macOS **UE**
  (uninterruptible) state — a 4.6.2 editor doc-gen cleanup bug. The bundle is
  written first, so builds are correct; the zombies clear only on reboot. The
  build scripts `disown` rather than `wait` on them.
