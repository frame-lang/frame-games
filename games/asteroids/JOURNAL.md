# Asteroids — Dev Journal

A running log of decisions, gotchas, and learnings from building the
Asteroids showcase — raw material for the articles. Newest entries at the
bottom. (The polished narrative lives in `article.md`; this is the workshop
floor.)

---

## The arc so far — the multi-language Godot port

**Goal.** Asteroids already ships two runtimes: the JS/Phaser build and a
GDScript Godot/WASM build, both driven by the *same* Frame controllers
(Ship, AsteroidField, AsteroidsGame). The new push: port to the other
**Godot-runnable** languages as playable in-browser WASM, hardest-first —
**Rust → C++ → C**. (C# is parked: Godot 4.x has no .NET Web export.)

**Stage 0 — does Rust-in-Godot-on-the-web even work?** Proven end-to-end: a
Rust GDExtension, compiled to WASM, runs inside Godot's web build in a real
browser (console + on-canvas proof). The hard-won recipe:
- Godot 4.6.2's web runtime is built with **Emscripten 4.0.20** — the
  GDExtension must match that exact emcc version (the gdext book's "3.1.74"
  is stale and fails).
- Rust **nightly** + `-Zbuild-std`, target `wasm32-unknown-emscripten`;
  `godot` crate (gdext) git master with `["api-custom","experimental-wasm","lazy-function-tables"]`.
- Export preset `variant/extensions_support=true` → Godot picks the
  `web_dlink` template. COOP/COEP on GitHub Pages is handled by Godot's own
  service worker — not a blocker.
- Gotcha: the installed `godot` is x86_64 (Rosetta) — build an x86_64
  desktop dylib so the *export host* can instantiate the extension class,
  else the exported scene silently downgrades the node to a placeholder.

**The port doubled as a fuzzer.** Translating real game logic surfaced
genuine framec codegen bugs (all filed on `frame-lang/framec`):
- **#59** — whole-number float state-var inits emit integer literals
  (`$.timer: f32 = 0.0` → `timer: 0`). Breaks Rust at *compile* time,
  C++/C/C# at *runtime* (`bad_any_cast` / wrong bits). **Fixed in 4.5.0.**
- **#67** — param-referencing domain initializers emit `Default::default()`
  in the generated parameterless `new()`, uncompilable for non-`Default`
  types (parameterized cross-system embeds like `ship: Ship = @@Ship(ship_host)`,
  and `host: Gd<Node>`). **Fixed** — threads the param through `__create`.
- Also: **#58** (non-native `#` comments leak into output — open),
  **#60** (snapshot tests capture emitted text but never compile it, so
  typed-target codegen bugs pass CI), **#61/#62** (type-passthrough docs),
  and `framec-test-env`**#8** (the fuzzers only ever type state vars as
  `int` — which is exactly why #59 slipped through four layers of tests).

**FSM port status:** all three systems — Ship, AsteroidField, AsteroidsGame
(HSM + `push$`/`pop$` + parameterized + cross-system embedding) — now
generate Rust that **cargo-checks clean against the real gdext API**. The
controller layer is done; gameplay layer next.

---

## 2026-06-09 — Host-push callbacks vs Rust's borrow checker

**The pattern.** Per the article's Host model, each controller calls back
into an engine-side host adapter at state boundaries. Ship does this for
four one-shot effects: `warp_out` (relocate on hyperspace entry),
`reset_ship` (recentre on respawn), `spawn_explosion`, `warp_in`. In the
GDScript build, `$InHyperspace.$>() { host.warp_out() }` just works.

**The gotcha.** In Rust/gdext it *panics*. The host *is* the gameplay node,
and these callbacks fire during `fsm.tick()` / `fsm.ship_hyperspace()` —
which run inside the node's `physics_process`, where gdext already holds
`&mut self`. `host.call("warp_out")` re-enters the same node and gdext's
borrow guard aborts with *"already borrowed."* The dynamic runtimes
(GDScript, Phaser/JS) have no borrow checker, so the same controller code
is fine there — this is purely Rust's memory model surfacing.

**Decision: `call_deferred`.** Change the four FSM host calls from
`.call("x")` to `.call_deferred("x")`. Godot queues them and runs them
after `physics_process` unwinds — no re-entrancy, host-push design
preserved, ~4 one-word edits in `asteroids.frs`. Cost: effects land one
frame late. Negligible here — `spawn_explosion` and `warp_in` are no-ops,
and a single-frame lag on the hyperspace reposition is imperceptible.

**Alternative considered (declined): predicate-pull.** Drop the host from
the FSM entirely; have the gameplay poll Ship's state each frame and fire
the effects itself on detecting an entry. Cleaner (immediate effects, FSM
holds no engine handle), but a bigger restructure that diverges from the
showcase's host-push pedagogy — not worth it for a one-frame cosmetic win.

**Article angle.** This is a tidy illustration of the showcase's thesis:
one Frame controller, many host runtimes — and how a target *language's*
constraints (here Rust's aliasing rules) force a host idiom (`call_deferred`)
that the dynamic engines never need, without touching the state-machine
logic at all.

---

## 2026-06-09 — Rust port playable end-to-end ✅

The full Rust port runs in Godot's web build, in a browser. The gameplay
layer (`AsteroidsMain`, a `#[class(base=Node2D)]` port of `main.gd`)
cargo-checked clean against gdext on the second pass — only two borrow-checker
nits in ~300 lines: `self.to_gd().upcast()` instead of moving out of the
`base()` borrow, and hoisting `bullets[i].vel` into a local before
`bullets[i].pos +=`.

Build chain (reused from the Stage 0 spike): `cargo +nightly -Zbuild-std
--target wasm32-unknown-emscripten --release` for the extension, an x86_64
desktop dylib so the export host can instantiate the class, then Godot's
`web_dlink` release export. Verified headless (Chrome via puppeteer-core):
`Initialize godot-rust (API v4.6.2.stable)`, no panics, and screenshots of
both the Attract screen (FSM-driven HUD) and the Playing state — the blue
triangle ship plus four asteroids that spawned and drifted from the edges
(`asteroids_for_wave(1)` = 4 for difficulty 2). The `call_deferred` host
path and all cross-system FSM calls ran clean.

**What the port cost vs. what it bought.** The translation itself was
mechanical (the FSM is the same machine; only the native bodies changed:
`//` comments, braces+parens, explicit Rust types, gdext APIs). The real
work was flushing out — and getting upstream to fix — two framec codegen
bugs (#59, #67) that *every* typed-target port would have hit. The Godot
pipeline (Stage 0) was never the risk; framec's typed-target maturity was.

**Still scratch.** Lives in `build/spike-rust/` (crate `spike_ext`, still
carries the Stage 0 `SpikeProbe`). Productionizing = a real home under
`games/asteroids/`, a generalized build script (per-language variant), a
`game.json` version entry, and the nav dropdown so the site can mount it.

---

## 2026-06-09 — C++ port started; blocked on a framec C++ bug

Next language in the trio. The shape mirrors Rust: `framec -l cpp` on a
C++-flavored `asteroids.fcpp` (the FSM, 2174 lines, emits clean), a
godot-cpp `Node2D` gameplay port (`main.cpp`), built via SCons against
godot-cpp (cloned `master`, built against the 4.6.2 API dumped from the
engine — the C++ analog of gdext's `api-custom`, since godot-cpp has no
`4.6` branch yet).

Two C++ findings:

1. **Param-order gotcha (mine).** `@@system AsteroidsGame(difficulty: int = 2,
   ship_host: Node*)` emits `__create(int difficulty = 2, Node* ship_host)` —
   invalid C++ (a defaulted parameter before a non-defaulted one; C++ requires
   defaults trailing). Reordered to `(ship_host, difficulty = 2)`. Rust and
   GDScript didn't care about param order; C++ does.

2. **framec#69 (blocker).** On the C++ target, `self.<field>` is emitted
   *verbatim* — `self.n`, `self.ship.respawn()` — instead of being lowered to
   `n` / `ship->respawn()`. C++ has no `self`, so nothing compiles. It
   contradicts cpp.md's stated contract, and it's pervasive (every domain /
   cross-system access). No clean Frame-source workaround, so — same call as
   AsteroidsGame on #67 — **paused for a framec fix.**

**The pattern holds across languages.** The port keeps doubling as the fuzzer:
Rust hardened the *shared* typed-target codegen (#59 float literals, #67
param-init constructors); C++ exposes a *C++-specific* gap (#69 self-lowering).
Each target's first real port is where its codegen path actually gets
exercised on non-toy input. (cf. #60 — the snapshot tests never compile the
emitted C++, so this sat undiscovered.)

**Banked for when #69 lands:** `asteroids.fcpp` (FSM, compiles via framec),
`main.cpp` (godot-cpp gameplay), godot-cpp built vs 4.6.2, and the extension
scaffolding (`register_types.cpp`, `SConstruct`, `asteroids.gdextension`).
Resume = re-`framec`, g++-validate, then the wasm/dlink build + browser verify,
exactly like the Rust finish.

---

## 2026-06-10 — C++: compiles & builds, but runtime is blocked downstream of framec

#69 was fixed — but as a **language change** (RFC-0046): the blessed,
portable self-reference is now `@@:self.field` (lowers to `this->field` on
C++, stays `self.field` on Rust, `this.field` on Java…). Bare `self.` is now
native passthrough — fine for Rust, invalid C++. Migrated `asteroids.fcpp`
(`self.` → `@@:self.`, 102 refs) and the **full C++ port g++-compiles clean
against godot-cpp** — real framec output, no emulation. So the *Frame* story
for C++ is proven end-to-end.

Then the **toolchain** fought back, in two rounds:

1. **Exceptions.** framec's C++ runtime uses `try`/`throw` (the `std::any`
   state-var dispatch), but Godot/godot-cpp build `-fno-exceptions` by
   default. Had to rebuild godot-cpp (web + arm64) and the extension with
   `disable_exceptions=no`.
2. **godot-cpp lag.** There's **no godot-cpp 4.6 branch** — it trails the
   engine (gdext/Rust sidesteps this with `api-custom`, dumping the live
   engine's API; that's *why* Rust was smoother). Cloned `master` (4.7-dev)
   and built against the dumped 4.6.2 API. The C ABI header matches 4.6.2
   exactly, everything compiles and exports — but the extension **crashes on
   load**: SIGSEGV, a stack-overflow recursion inside godot-cpp's own
   registration/init (`asteroids_library_init` frames repeating). Most likely
   the exceptions-ABI tension (an exceptions extension against a
   no-exceptions engine) or a `master`-vs-4.6.2 registration quirk.

**Where it stands:** Rust is the proven, browser-playable non-GDScript
runtime. C++ is **compile-proven** (framec C++ + RFC-0046 validated on the
whole game; godot-cpp builds + dlink export all succeed) but **runtime-blocked
in godot-cpp**, not in Frame. The remaining work is godot-cpp runtime
debugging (or waiting for a godot-cpp 4.6 release) — downstream of, and
separate from, the Frame/framec achievement.

**Article angle.** Two runtimes, one controller — and the honest asymmetry of
the bindings beneath them. Rust's `gdext` tracks any engine build via
`api-custom`; C++'s `godot-cpp` is a released artifact that lags the engine,
and Godot's no-exceptions default collides with framec's exception-using C++
runtime. The Frame layer ported cleanly to both; the *host bindings* are where
the cross-language reality lives.

---

## 2026-06-11 — C: the FSM ports cleanly; the host is where C bites

Third target. The C FSM came together fast once two framec C-target bugs were
fixed (both surfaced by this port, both filed + fixed same day):

- **#72** — interface params/returns box through a `void*` slot. `int`/`bool`/
  pointers fit (`intptr_t`); **float returns** packed but never *un*packed on
  read (`(float)void*`), and **struct-by-value** (`Vector2`) wasn't boxable at
  all. Fixed: symmetric `unpack_double`, real struct boxing.
- **#73** — embedded-system calls `@@:self.sub.method()` emitted
  `self->sub.method()` (a struct-member access) instead of the free-function
  form `Sub_method(self->sub, args)`. Fixed.

C idioms that differ from Rust/C++: methods are **free functions**
(`Ship_tick(self, dt)`, no `this`); **no `str`/`vector`/operator overloading**
(so `Vector2` is a plain struct with helper fns, the asteroid field is a
fixed-capacity array + count via the typedef-flatten workaround); state name
is `const char*` (compared with `strcmp`, not `==`). The host is a **struct of
callbacks** — and notably, **C needs no `call_deferred`**: with no borrow
checker, the Ship can call back into the host synchronously mid-tick, the way
GDScript does. So the same re-entrancy that forced `call_deferred` on Rust/C++
just… isn't a problem in C. (`@@:self.field` → `self->field`; **state vars
stay `$.x`**, not `@@:self.x` — E609 caught that mix-up cleanly.)

All three systems — Ship, AsteroidField, AsteroidsGame (HSM, push$/pop$,
cross-system embeds) — `gcc -fsyntax-only` clean.

**Where C stops (for now): the host, again.** The gameplay layer has to use
the **raw GDExtension C ABI** — no binding library. Every engine call
(`draw_arc`, input) goes through `classdb_get_method_bind(class, method,
version-specific-hash)` + manual `ptrcall` marshaling, which **only validates
at runtime** — and runtime is currently blocked (a pile of `UE`-state headless
Godot zombies on the arm64 slice that survive `kill -9`; needs a reboot).
Authoring that blind would be unverifiable. So the C *controller* is proven;
the C *gameplay* waits for the runtime loop. The recurring lesson across all
three: **the Frame FSM ports cleanly; the language's *host binding* is the
whole story** — `gdext` (easy), `godot-cpp` (exceptions + version lag), raw C
(no library, runtime-only validation).

---

## The C++ crash that wasn't a crash — a runtime-only codegen bug (#77, #78)

The C++ extension compiled g++-clean and linked, but Godot **SIGABRT'd at
extension load**. I spent a long time bisecting the *registration* surface
(virtuals, bound methods, deferred FSM, class-version) with a minimal
`MinNode` — all clean. The registration trail was a red herring. The real
differentiator was simpler: the crashing lib *includes the generated FSM TU*;
`MinNode` doesn't.

`atos` on the crash offsets pointed at `std::__hash_table<std::string,
std::any>::__rehash` — the FSM's per-compartment `state_vars` map. From there
the bug was plain: Frame stores `float` state vars in `std::any` and reads them
with `std::any_cast<float>`, **but the literal initializers are emitted as bare
`double`** (`state_vars["cooldown"] = 0.0;`). `std::any` captures the *exact*
type, and `any_cast<float>` demands an exact match — so the first read throws
`std::bad_any_cast` → `terminate()` → **SIGABRT**. Same defect on float-typed
return slots (`radius_of(): float` → `_return = std::any(32.0)`).

Reproduced it in **5 lines, no Godot, no reboot** — a tiny native harness that
constructs the FSM and calls `can_fire()`:
`libc++abi: terminating due to uncaught exception of type std::bad_any_cast`.
That escape from the Godot wedge loop was the whole game: a runtime crash you
can trigger in a unit harness is a bug you can *file*, not a mystery you have
to reboot to poke at.

Two tickets, because there are two bugs:

- **#77 (codegen)** — the third sighting of one recurring pattern: typed
  (esp. `float`) values corrupted crossing each backend's *type-erasure layer*.
  #59 was Rust (wrong literal emitted, `0.0`→`0`); #72 was C (`void*` boxing,
  read never unpacks); #77 is C++ (`std::any`, literal *correct* but
  `double`≠`float`). The first two were **compile errors**. #77 **compiles
  clean and crashes at runtime** — a strictly worse failure mode.

- **#78 (validation process)** — and that's why it slipped through. framec's
  tests are **compile-only**: RFC-0034's `compile_check` runs
  `g++ -fsyntax-only`. The smoking gun: framec's *own* CI fixture
  `15_float_state_vars` emits this exact bug; `-fsyntax-only` returns rc=0, but
  compiling-and-running its `peek()` aborts with `bad_any_cast`. #60 added
  *compilation*; the missing tier is *execution*. The compile tier
  **structurally cannot** catch valid-but-wrong codegen — half the failure
  space is untested on every backend. Filed with a concrete execution-tier
  proposal (drive each fixture's FSM, assert clean exit + correct typed
  round-trip returns, across all runnable backends).

The through-line holds and sharpens: **the FSM ports cleanly; the host binding
is the whole story** — and this time the "host" was the C++ *standard library*
itself. `std::any`'s exact-type contract is a host the generated code has to
satisfy as carefully as any engine ABI. C++ port is **blocked on #77** (root
fix in framec — not hand-patching generated output).

---

## C, part 2 — running the FSM finds what compiling couldn't (#81)

The C FSM compiled clean back on day one. That said nothing about whether it
*works*. Two runtime findings, both invisible to a compiler:

**1. A stale-codegen float bug, caught by running it.** Driving the full FSM
natively (no Godot — the host is just a struct of C callbacks), the ship hit an
asteroid, entered `Exploding`… and never left. 3 seconds of ticks, duration is
1.0s, still `Exploding`. The Jun-11 `asteroids.c` boxed float **state vars** as
`(void*)(intptr_t)` — integer truncation — so `timer = (int)0 + 0.05` stored as
`(intptr_t)0.05` → **0**, every tick, forever. Same truncation silently broke
the fire cooldown (`0.22` → `0`). framec had already fixed this upstream
(state-var floats now use `pack_double`); regenerating with current `main` made
the explode cycle transition at exactly tick 20 (t=1.00) and the whole game
loop — hit → explode → respawn → hyperspace warp_out/warp_in → alive — run
correctly. The lesson is #78's: a compile-clean FSM can be a dead FSM; only
*execution* tells you.

**2. #81 — the boxing is 64-bit-only, and the web target is 32-bit.** Then the
emcc build refused: `'memcpy' will always overflow; destination buffer has size
4, but size argument is 8`. framec's `pack_double` bit-puns a `double` through a
`void*` — fine on arm64 (`void*` is 8 bytes), **corrupting on wasm32** (`void*`
is 4). Every float boxed on the web export collapses to `0`: `dt`, every timer,
every radius. The native build is perfect; the *same source* on wasm32 is a dead
simulation. Proven with a 6-line repro (0.4 → 0.0 under emcc). This is the
through-line in its purest form yet — **the FSM ports; the host is the whole
story** — except here the "host" is the *target's pointer width*. Filed #81
(fix: box doubles independently of pointer width; + a `strdup`/ISO-C nit).

**Where C stands.** The FSM logic is runtime-proven correct on arm64. The raw
GDExtension C host (`gameplay.c`) is written and compiles clean — ~360 lines,
every engine call a `classdb_get_method_bind`+ptrcall against real Godot 4.6.2
hashes, the ship drawn as a wireframe triangle (3 `draw_line`s) to dodge
`PackedVector2Array` marshaling, and — crucially — *no bound methods*: in C the
`ShipHost` is direct function pointers, so the Ship fires effects synchronously
with no `call_deferred` and nothing to register but the class + 3 virtuals. The
arm64 `.dylib` builds and exports `asteroids_library_init`; the Godot project is
scaffolded. Two gates remain: macOS run-verify waits on the Godot wedge (reboot);
the **web** build is blocked on #81.

---

## C++ runtime, root-caused at last — it was never the Frame code (godot-cpp vs 4.6.2)

The C++ extension crashed at load. Earlier I'd pinned that on framec #77 (the
`std::any` double/float bug) — a real bug, fixed and verified. But with #77
fixed and the FSM regenerated, the extension **still** crashed at load, now with
SIGSEGV (not the old `bad_any_cast` SIGABRT) deep inside
`godot::StringName::init_bindings()` → `Variant::init_bindings()` →
`GDExtensionBinding::init` — i.e. inside **godot-cpp's own binding setup**,
before a single line of my code or the FSM runs.

The decisive test: an **empty control extension** — same godot-cpp `.a`, a bare
`class Ctl : Node2D {}`, no FSM at all — crashes in the *identical*
`init_bindings` frame. So the crash is independent of Frame, framec, and my
host code. Methodically ruled out, in order:

- my extension code — empty control crashes the same way
- framec #77 — fixed and separately proven (native repro runs clean)
- my compile flags — matched the (also-crashing) minimal build exactly
- the extension_api.json version — re-dumped the engine's real **4.6.2** API,
  swapped it in (was 4.6.0), still crashed
- build caching — `scons -c`, deleted `gen/`, full clean rebuild with binding
  regeneration against 4.6.2, still crashed

What's left is the toolchain itself: **godot-cpp master (`3a7edf0`) has drifted
ahead of Godot 4.6.2 stable.** godot-cpp ships *no* 4.6 release branch (branches
stop at 4.5; 4.6 lives only on master), and the local clone is shallow (depth 1),
so the master commit that actually matches 4.6.2's GDExtension ABI can't be
bisected without an unshallow fetch. This is a version-pinning problem, not a
code problem.

Two through-lines land here. First, the recurring one — **the FSM ports; the
host binding is the whole story** — in its sharpest form: the host binding
*library* is so far ahead of the engine that it segfaults before the extension
initializes. Second, a contrast worth keeping: the **C** port uses the raw
GDExtension C ABI and **no binding library at all**, so it sidesteps this entire
class of problem — the only thing the raw-C host depends on is the C ABI, which
is stable. The C port's blockers (the headless wedge; framec #81 for web) are
unrelated to this. So once the machine is rebooted, **C may actually reach a
running build before C++** — the binding-less approach pays off exactly where
godot-cpp's version coupling hurts.

**C++ status:** FSM proven correct; host code complete and compiling; #77 fixed.
Runtime blocked on (a) a godot-cpp commit matching 4.6.2 stable [research +
unshallow fetch], and (b) the arm64 headless wedge [reboot]. Not a Frame issue.

---

## C plays — the binding-less port wins the post-reboot race

Reboot cleared the wedge. First runtime test: the **C** raw-GDExtension port —
and it ran. `AsteroidsMain` registered, the game ran 6s headless with zero
crashes, and a windowed in-engine capture (synth-press SPACE to leave Attract,
hold LEFT to rotate) shows it rendering: four grey `draw_arc` asteroids and the
blue wireframe-triangle ship (three `draw_line`s, `COL_SHIP`) on black. The
whole stack works on the first try — class registration via raw
`classdb_register_extension_class3`, the three virtuals dispatched through
`get_virtual`, and every `_draw`/input call a hand-pulled Godot 4.6.2
method-bind hash + ptrcall. A wrong hash anywhere is an instant segfault; none.

This is the prediction from the C++ post-mortem paying off literally: the raw C
ABI depends on *nothing* but the GDExtension C interface, which is stable — so
where godot-cpp's master-vs-4.6.2 drift segfaulted C++ before its first line ran,
C sailed through. The binding-less approach, the most tedious to write, turned
out the most robust to the toolchain.

One editor-only wrinkle: `--import` crashes in `EditorHelp::_gen_extensions_docs`
(the editor introspecting the class for documentation) — irrelevant to running
the game, but it'll need a workaround in the export pipeline (which does an
`--editor` import pass). And `reloadable=true` warns that raw C can't hot-reload
(set it false).

**C status:** macOS arm64 — **playable, visually verified.** Web (wasm32)
remains gated on framec #81 (the `pack_double` float corruption would make `dt`
and every timer zero), plus the doc-gen export-pipeline wrinkle. But the port
itself — FSM, host binding, rendering — is proven end to end.

---

## C ships to the web — #81 fixed, end-to-end in the browser

framec #81 landed (PR #82): doubles now box through `malloc`'d slots, pointer-
width-independent, and `strdup` became an emitted `Sys_strdup_` shim (strict
ISO C). Regenerated `asteroids.c` — `pack_double` now `malloc`s the double and
returns the pointer; the emcc build that used to warn `memcpy will always
overflow` is silent. Native arm64 regression still green (explode→respawn at
t=1.00).

Web export, the parts that turned out to matter:
- **`--export-release` is not an editor command.** The editor doc-gen crash
  (`EditorHelp::_gen_extensions_docs`) only fires under `--import`/`--editor`;
  exporting headless skips it entirely. So the pipeline is: one `--import`
  (writes `.godot/`, then crashes on doc-gen — harmless, the import already
  finished) → `--export-release "Web"`. Clean bundle, rc=0.
- **`variant/extensions_support=true`** in the preset — mandatory for a
  GDExtension web build (the GDScript export leaves it false). Gives the dlink
  shape: `index.wasm` (1.5 MB main) + `index.side.wasm` (41 MB engine) + the
  separately-loaded extension wasm. (That shape is also why the Rust bundle's
  1.5 MB `index.wasm` looked wrong earlier — it wasn't.)

Browser-verified in headless Chrome (WebGL via SwiftShader, COOP/COEP): Godot
4.6.2 boots with "GDExtension support", zero page errors, and a screenshot after
SPACE-to-start + hold-LEFT shows four `draw_arc` asteroids and the blue
wireframe ship **rotated** — and the rotation is the proof that closes #81: ship
angle is float math through the boxed-double path, so a turning ship means
wasm32 floats round-trip correctly. Then the same bundle loaded through the live
site's iframe (vite passthrough + the generalized `versions/<variant>/` regex),
dropdown set to "Godot · C", no errors.

**C is now a live web port in the nav.** First of the four Godot languages to
go green end-to-end — the binding-less raw-C path that dodged godot-cpp's
version swamp. Known follow-up: the live FSM-panel sync (BroadcastChannel
publisher) isn't wired for a GDExtension version — the GDScript publisher reads
`fsm.ship.__compartment.state`, which a C-extension node doesn't expose — so the
diagrams show initial states on the C tab rather than live ones. Game plays;
diagram sync is a separate enhancement.

---

## Desktop restart, device-aware controls — and a silently-broken sync

Reported problem: on desktop there was no obvious way to restart Asteroids. Root
cause — the JS/Phaser overlays were written in the **mobile button glyphs**
(`Press ↻ to restart`, `(⚡ hyperspace · ⏸ pause)`). Those buttons only render on
touch, so a desktop player saw a `↻` that didn't exist (the R key worked, but
nothing said so). The Godot ports were inconsistent: most used keyboard letters,
GDScript also used glyphs.

Fix (chosen: device-aware text): every version now checks the device and shows
the matching token — keyboard `R/H/P` for hover+fine-pointer, button glyphs
`↻/⚡/⏸` for touch. JS uses `matchMedia("(hover: none) and (pointer: coarse)")`
(the same predicate as the CSS that reveals the buttons); the Godot ports use
`DisplayServer.is_touchscreen_available()`. Verified in headless Chrome: JS shows
`Press any key to start (H hyperspace · P pause)` on desktop and
`Tap to start (⚡ hyperspace · ⏸ pause)` under emulated touch. Also added
`· R restart` to the page controls line (desktop-only chrome), the one universal
discoverability win.

Confirmed along the way that the mobile button bar **does** drive the Godot
iframes — its synthetic `KeyboardEvent`s are dispatched into the frame's own
realm (canvas + document + window), and tapping started the C game
(Attract→Playing). So the Godot ports are genuinely touch-playable, which is why
they earned the device-aware treatment too.

Side-discovery while rebuilding GDScript: its injected `live_state_publisher.gd`
**never compiled** — `var fsm = scene.get("fsm")` infers from a `Variant`, and the
export treats that warning as an error, so the autoload silently failed and the
GDScript tab's FSM diagrams were dead the whole time. Fixed by giving every
generated var an explicit type. All three live Godot ports now publish state and
sync the diagrams (verified Attract→Playing on each).

Open: the **C** port renders no in-game text at all (it skipped `draw_string`),
so its restart hint lives only in the page controls line + the visible mobile
button; adding a device-aware HUD/center overlay to the raw-C port is a separate
chunk (12-arg `draw_string` ptrcall + a ThemeDB fallback font). C++ stays paused
on #86.

---

## C++ ships — all four Godot languages now live

framec #86 fixed (PR #90): the dead `try/catch(...){ pop; throw; }` dispatch
wrapper became a method-local RAII scope-guard
(`struct __CtxGuard { …; ~__CtxGuard(){ s.pop_back(); } }`) — same context-stack
balance, zero exceptions. Validated the new binary end to end: regenerated
`asteroids.cpp` has **0** try/catch/throw (2177→1987 lines), the native FSM runs
clean under `-fno-exceptions`, the web extension compiles with no `invoke_ji`,
and the browser plays it (HUD, asteroids, ship rotating under input). Brought
C++ to parity with the others — `emscripten_run_script` state publishing +
device-aware center text (`DisplayServer::is_touchscreen_available()`) — and
wired it live. **All five versions are now selectable and playable: JavaScript,
Godot · GDScript / C / Rust / C++.**

Validation also probed #87 (the open follow-up the binary is branched for —
no-throw `any_cast` for persisted systems): a `@@[persist(...)]` C++ system still
emits 4 `try/catch/throw` in its serialization (a quiescence `throw` + the
`try{any_cast<int>}catch{}` type-probes #87 targets) plus an `nlohmann` JSON
dependency, so persisted C++ systems are **not** yet `-fno-exceptions`-clean.
Asteroids doesn't persist, so this doesn't touch the port — but #87 isn't done
in this build.

The godot-cpp version story, captured in `build/godot-cpp.sh`: godot-cpp has no
4.6 release branch, `master` segfaults on 4.6.2, so the port builds against the
stable `godot-4.5-stable` tag (forward-compatible) with `-fno-exceptions` against
a `disable_exceptions=yes` godot-cpp web lib.

---

## One engine, four games — 176 MB → 47 MB

A Godot web export is ~99% engine: of each 46 MB bundle, the actual Frame-driven
Asteroids logic is 42 KB–843 KB; the rest is `index.side.wasm` (39 MB engine) +
`index.js` (5 MB Emscripten loader) + `index.wasm` (1.4 MB dlink main). And the
engine is byte-identical across the GDExtension ports (verified by md5). So four
ports shipped four copies of the same engine.

Godot's web loader already separates these: `GODOT_CONFIG` names `executable`
(the engine), `mainPack` (the `.pck`), and `gdextensionLibs` (the compiled game
`.wasm`) independently, and `mainPack` overrides the default `${executable}.pck`.
So the fix is purely layout: hoist the engine to a shared `versions/_engine/`,
and slim each game dir to its `.pck` + extension `.wasm` + a thin `index.html`
whose loader points `executable` at `../_engine/index` while keeping `mainPack`
local.

GDScript was the one holdout — it had been exported with
`extensions_support=false` (the smaller non-dlink engine). Re-exported with it
`true`, its engine is now byte-identical to the C/C++/Rust ones, so **one** dlink
engine serves all four. (The dlink engine runs a plain-GDScript project fine.)

Result: `_engine/` 46 MB + godot-c 56 KB + godot-cpp 836 KB + godot-rust 440 KB +
godot-gdscript 52 KB = **47 MB total** (was 176 MB). And the UX win is bigger
than the disk win: the browser downloads the engine once and caches it, so
switching language tabs after the first load fetches only the few-KB game delta —
instant, instead of re-downloading 46 MB. Captured in `build/share-engine.sh`,
called by all four build scripts.

One scar from automating the exports: the 4.6.2 editor doc-gen cleanup crash
leaves the headless export process in macOS **UE** (uninterruptible) state —
unkillable until reboot, the same wedge as before but triggered at export time.
The bundle is always written *before* the hang, so the build is correct; the
scripts now `disown` the export rather than `wait` on a process that will never
be reaped. The zombies accumulate across builds and only a reboot clears them.

---

## C gets its HUD — raw-C text, at last

The C port shipped without on-canvas text — no score, no "press to start" —
because `draw_string` is the worst call in the GDExtension C ABI: 11 ptrcall
args (all required, no defaults) including a `Font*` you first fetch from a
second singleton (`ThemeDB::get_fallback_font`), and a `String` you must
construct (`string_new_with_utf8_chars`) and destruct (`variant_get_ptr_destructor`)
around each call. The godot `String` is conveniently pointer-sized (4 bytes on
wasm32, 8 on arm64), so a `void*` slot is exactly right on both.

Wrapped that into a `draw_text(text, pos, width, align, size, color)` helper,
added the HUD (`SCORE/LIVES/WAVE/DIFF/WARP`) and a device-aware center message
(multi-line, split on `\n` and each line centered via `HORIZONTAL_ALIGNMENT_CENTER`
across the court width) — keys `R/H/P` on desktop, glyphs `↻/⚡/⏸` on touch, same
as the other ports. Verified on macOS (in-engine capture) and in the browser:
the C port now reads identically to GDScript/Rust/C++ — full visual parity, no
longer the bare-bones one. (Exit-time "RID leaked" warnings are cosmetic — five
cached shaped-texts for the five distinct strings, not a per-frame leak.)
