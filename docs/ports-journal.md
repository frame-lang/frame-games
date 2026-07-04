# The Ports Journal — config-path discoveries from 16 languages, one FSM

Raw material for future articles. This is the engineering diary of porting the
Frame Asteroids controller to every practical framec backend as in-browser
builds (June–July 2026): what each toolchain actually required, what broke,
what the fix was, and which findings generalize. The mission was never the
games — it was **using each port as a bug-discovery vehicle for framec**, with
a hard rule: *no workarounds; file the bug and wait for the fix.*

Scoreboard at time of writing: **16 languages** driving the identical FSM —
JS, GDScript, C, C++, Rust, Dart, C#, Go, Lua, Python, TypeScript, Ruby, PHP,
Java, Kotlin, Swift. Erlang paused. **14 framec issues found → fixed →
validated** (#108 #110 #112 #115 #116 #117 #120 #122 #124 #141 #144 #147 #156
#157), plus #126 (not-a-bug — instructive) and #125 (pre-existing, Erlang).

---

## 1. The one lesson that ate the most time: what a Frame body IS

Everything else in this journal is downstream of one fact from
`framec/docs/frame_language.md` ("Appendix: Frame Syntax Taxonomy"):

> Frame has almost no expression grammar of its own. The value-bearing parts
> of a handler line are **native** code; Frame contributes only *references*
> and *calls*.

So a handler body is **native target-language code** with a small closed set
of Frame splices: `$.stateVar`, `@@:(e)` / `@@:return(e)` (the return slot),
`@@:self.method(args)` (reentrant self-dispatch ONLY — the one call that emits
the `_transitioned` guard), `@@:system.state.name`, and the transitions
(`->`, `=> $^`, `push$`, `-> pop$`). Domain access, child-system calls, action
calls, locals, and control flow are **written in the target language**:
`$this->ship->tick($dt);` in PHP, `if (cond) {` in Java/Kotlin/C#,
`if cond {` in Swift, `if cond ... end` in Ruby, `if cond:` in Python.

**framec does not translate control flow for any typed backend.** We proved
this by feeding `if score >= 60 {` to c/rust/cpp/dart/swift/java/csharp/go/
kotlin — every one passes it through verbatim. The working C/C#/Dart ports all
wrote native parens. (A misleading detail: framec's own kotlin test fixtures
contain paren-less `if score >= 60 {`, which *encodes non-compiling output* —
the fixtures test structure, not body syntax. The ground truth was our own
working port sources.)

Practical division of labor per statement type (measured, java backend):
framec appends `;` to Frame *calls* but NOT to Frame *assignments*
(`@@:self.n = e` → `this.n = this.n + 1` with no terminator) — so in
semicolon languages, write the `;` yourself on everything.

**Corollary — the #126 story.** Early on we filed "python: nested if/while not
colon+indented; true/false not capitalized" — and the maintainer correctly
closed it as not-a-bug: Python/JS/Ruby (and TS/PHP) are *native passthrough*;
you write real Python. The user later said "refile 126"; we re-verified and
declined with evidence. The `var total = 0` / `while i < n {` we later fed the
Erlang backend produced garbage output for the same reason: that was C-style
pseudocode, not native Erlang. Garbage in, garbage out is *by design* in a
native-passthrough model; the transpiler's job is Frame structure, not
language conversion.

## 2. The framec bug taxonomy that emerged

Porting 16 backends surfaced the same few defect *families* over and over:

1. **The deferred-field placeholder family** (RFC-0017). A domain field whose
   initializer references a system parameter gets its assignment moved into
   `__frame_init`; the *declaration* needs a placeholder. Primitives are fine
   (`Int = 0`). Reference types broke per-language:
   - **kotlin #147**: `var host: IShipHost = null` — null into a non-null
     type. Fix: `lateinit var`.
   - **swift #156**: `public var host: IShipHost` — uninitialized non-optional
     → definite-init error. Fix: `var host: IShipHost!` (IUO).
   - **Java/C# immune** (auto-null / defaults) — which is exactly why the bug
     hid until the definite-init languages.
2. **Host-platform-only annotations**: **kotlin #157** — the companion factory
   carried `@JvmStatic`, a JVM-only annotation, making generated Kotlin
   uncompilable for Kotlin/JS, Native, and wasm. Three annotations were the
   ONLY errors in 2,009 generated lines. Fix: drop it (companion functions
   are callable without it on every target).
3. **Language-legality of emitted initializers**: **php #144** — a
   non-constant domain initializer (`new Vec2(640,480)`) emitted as a PHP
   *property default*, which PHP forbids. Fix: lower into the constructor.
4. **Sigil misuse handled inconsistently**: **#141** — on the passthrough
   backends, void `@@:return()` emitted a dangling `_return =` and
   `@@:return(expr)` inside an *action* was emitted **verbatim** — silently,
   exit 0 — where the C backend errors cleanly on comparable misuse. The
   theme: *silently emitting invalid target code* is the bug; a diagnostic
   would be fine.
5. **Earlier waves (Go/C#/Lua)**: casing of action calls (#112/#115),
   missing statement terminators (#116), semicolons inside if-conditions
   (#117), Lua's dot-vs-colon cross-system calls + missing module export
   (#120), table literals (#122), else-if chains (#124).

Meta-observation: **every single new backend surfaced at least one defect
before shipping** — except Java and TypeScript, the two most "mainstream"
shapes. The infrequently-exercised corners (definite-init languages,
multiplatform Kotlin, PHP's property-default rule) are precisely where
codegen assumptions leak.

## 3. Per-toolchain browser recipes (and their traps)

### Godot (GDScript / C / C++ / Rust)
- Shared-engine "dlink" layout: one `_engine/` + thin per-language dirs.
- **Trap:** non-GDScript projects lacked `window/stretch/mode="canvas_items"`
  + `aspect="keep"` in project.godot → gameplay rendered off-screen. And
  center-text needed explicit `HORIZONTAL_/VERTICAL_ALIGNMENT_CENTER`.
- Godot web exports need COOP/COEP (SharedArrayBuffer) — the reason the whole
  site is cross-origin isolated, which later became the PHP saga (§5).

### Flame · Dart
- `flutter build web` (CanvasKit). 39MB. framec #108 (no public ctor) fixed en route.
- **Trap:** Vite's dev HTML/JS transform injects ESM imports into classic
  `<script>`-loaded `flutter_bootstrap.js` → "Cannot use import statement
  outside a module". Fix: a dev middleware serving bundle `.html`/`.js`/`.mjs`
  verbatim. This one middleware later saved Unity and php-wasm too.

### raylib · C
- The FSM (`asteroids.fc`) is **shared verbatim with the Godot-C port** —
  engine-agnostic by design (own `Vector2`, host = struct of fn pointers).
- **Trap:** raylib 5.5 defines `Vector2` unconditionally → collision with the
  FSM's. Tagging the struct made it worse; the fix was a macro rename in the
  host only: `#define Vector2 FsmVec2` before including the FSM, `#undef` +
  include raylib after.
- **Trap:** emscripten/GLFW doesn't preventDefault arrows/space → the parent
  page scrolls while you play. Fix in shell.html keydown handler.
- Smallest bundle of all: **324KB**.

### Unity · C#
- Batchmode CLI build (`Assets/Editor/BuildScript.cs`), IL2CPP → WebGL,
  Gzip + decompression fallback. framec #116 (C# semicolons) fixed en route;
  float defaults need `f` suffixes (author-side).
- **Trap:** licensing check needs network at build time — a *detached*
  background build lost network and died ("Could not resolve host
  config.uca.cloud.unity3d.com"). Run license-touching builds foreground.
- **Trap:** stale IL2CPP caches silently reuse old wasm — a 3.7s "Build
  succeeded" that shipped week-old bytes. Nuke `Library/Bee`,
  `Library/ScriptAssemblies`, and the output dir when in doubt.
- **Trap:** `GL.LoadPixelMatrix(0,W,H,0)` + `camera.rect` letterboxing
  produced ~4× scale drift. Fix: compute the screen-pixel transform yourself
  (scale = min(sw/W, sh/H), offsets, flip Y) and apply per-vertex + as a
  `GUI.matrix`.

### Ebitengine · Go
- `GOOS=js GOARCH=wasm go build` + `wasm_exec.js` from the toolchain. 15MB.
- Ebiten's `Layout()` gives the 800×600 letterbox for free — nicest
  scaling story of any engine. Live-state via `syscall/js`.
- framec #112/#115/#117 fixed en route. Go conventions: receiver `s`,
  PascalCase interface methods, `for` not `while`.

### LÖVE · Lua
- `npx love.js` packages a prebuilt LÖVE wasm. ~5MB.
- framec #120/#122/#124 fixed en route. Lua model: brace-translated bodies
  (`if{}` → `if then end`), 1-based indexing.
- **Trap:** love.js's default theme (pink page, fullscreen button) is wrong
  for an iframe — hand-write a minimal shell, but keep its exact
  `INITIAL_MEMORY` (a mismatched value hard-fails).
- Only port with **no live-state** (no JS bridge into LÖVE's VM worth the cost).

### Pygame · Python
- pygbag → CPython 3.12 wasm. Needs a py3.12 venv (homebrew 3.14 is
  PEP-668-managed); `pygame-ce` + `pygbag`.
- **Trap:** pygbag's `--build` fetches its HTML template from
  `pygame-web.github.io` at build time; a detached process without network
  hangs forever *holding a lock* — a later foreground run then can't proceed
  either. Kill stale processes; pre-fetch `default.tmpl` and pass
  `--template`.
- **The trade nobody advertises:** the pygbag bundle is 44KB but the *runtime*
  loads from the pygame-web CDN — the only non-self-contained port.
- Host must be `async def main()` + `await asyncio.sleep(0)` per frame.
  Live-state via pygbag's `platform.window` JS bridge.

### three.js · TypeScript
- The first **3D** port (tumbling wireframe icosahedrons). esbuild bundle,
  514KB, zero drama — TS is native-passthrough; no new framec bug.
- **Trap (self-inflicted):** `new THREE.EdgesGeometry(new THREE.BufferGeometry())`
  on an empty geometry throws deep inside three.js ("reading 'count'").

### ruby.wasm · Ruby
- `@ruby/wasm-wasi` npm packages; the 15.8MB no-stdlib `ruby.wasm` suffices.
  The **entire host is written in Ruby** via the `js` interop gem
  (`ctx.call(:method, ...)`, `JS.global`, rAF closures as Ruby lambdas).
- Import-path trap: the package's `exports` map wants
  `@ruby/wasm-wasi/dist/browser` (not `.../dist/esm/browser`).
- Serve `.wasm` as `application/wasm` or `compileStreaming` fails.
- framec #141 found here.

### php-wasm · PHP — see §5 (the COEP saga)
- `vrzno` is the JS-interop extension: `new Vrzno()` proxies `globalThis`
  (property get/set both work — critical for `ctx->fillStyle = ...`),
  `vrzno_await()` suspends PHP on a JS promise (that's the rAF loop),
  `vrzno_eval()` for a JS prelude (input queue, BroadcastChannel).
  API discovered *deterministically in Node* via `PhpNode` + Reflection —
  much faster than headless-browser guessing.
- framec #144 found here.

### TeaVM · Java
- Maven + `teavm-maven-plugin` 0.15.0 → **548KB of plain, self-contained JS**.
  JSO bindings for canvas/DOM; a 3-line `@JSBody` bridge for BroadcastChannel.
- `@@system private` required for non-main systems (framec E430 — one public
  class per Java file; a *good* diagnostic).
- The cleanest typed backend: **zero new framec bugs**.

### Kotlin/JS · Kotlin
- Gradle + KMP `js(IR).browser` + kotlinx.browser → **68KB** bundle, the
  smallest JS of any port. Same FSM passes the JVM smoke — one file, two
  platforms (after #157).
- framec #147 + #157 found here.

### SwiftWasm · Swift
- The fussiest toolchain, all version-exactness:
  1. Host Swift via `swiftly` — but the SwiftWasm SDK must match the
     toolchain **exactly**: SDK `swift-wasm-6.3-RELEASE` refuses Swift
     6.3.**3** ("module compiled with Swift 6.3 cannot be imported by the
     Swift 6.3.3 compiler"). Pin 6.3.0; commit a `.swift-version`.
  2. SwiftPM *plugins* compile against the **host** SDK: a 2020-era Command
     Line Tools installation broke JavaScriptKit's plugin on
     `URL.appending(path:)` (macOS 13+ API). Fix: update CLT — and the
     `softwareupdate` catalog only lists CLT after
     `touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress`.
  3. Choose the **single-threaded** wasip1 SDK (not `-threads`): no
     SharedArrayBuffer requirement → embeds under COEP without ceremony.
  4. JavaScriptKit's PackageToJS (`swift package js`) emits an ESM runtime
     that imports `@bjorn3/browser_wasi_shim` as a **bare specifier** — it
     expects a bundler. esbuild with the wasm marked external.
  5. Modern JavaScriptKit: JSValue dynamic members are *non-optional*
     callables — no `!` on `addEventListener` etc.
- FSM preamble portability: import libm via
  `#if canImport(Darwin) / #elseif canImport(WASILibc)` — not Foundation.
- framec #156 found here. 9.0MB wasm + 88KB bundle.

### Erlang (paused) — the shape of the problem
- Wildest backend by far: a Frame system becomes a **gen_statem process**
  (interface calls = `gen_statem:call`), and `if`-braces become `case`
  expressions with the immutable `Data` record threaded through (`Data1`,
  `Data2`, ...). Open #125 lives exactly in that threading (else-if arm +
  trailing mutations → stray comma + wrong Data generation used).
- Feeding it imperative pseudocode (`var x = 0` / `while ... {`) produces
  verbatim garbage: bodies must be **native Erlang** — single-assignment
  capitalized locals, `lists:*` for iteration. A faithful port means
  *rewriting the FSM functionally* (list rebuilds instead of element
  mutation), which is a design exercise, not a transcription. Parked.

## 4. The verification matrix (headless Chrome as CI)

`chrome --headless=new --enable-unsafe-swiftshader --use-angle=swiftshader
--virtual-time-budget=N --screenshot` became the standard verifier, with an
`#autostart` URL-hash hook compiled into every host (dev/headless only) so
screenshots capture *gameplay*, not the attract screen. Results split cleanly:

| Renders + loop advances headless | Renders one frame only | Stalls at loader |
|---|---|---|
| three.js/TS, Ruby, Java, Kotlin, Swift, Flame, raylib, Ebiten (plain JS/wasm + rAF) | php-wasm (Asyncify loop never resumes under virtual time) | Unity, LÖVE, Pygame (heavy engine loaders in software-WebGL) |

Rules of thumb discovered:
- Virtual-time budgets don't reliably wait on *large network fetches* or
  Asyncify resumptions; localhost fetches are fine.
- SwiftShader renders plain WebGL (three.js) happily; it chokes on the big
  emscripten engine loaders.
- A JS **frame-counter log** (`PHP_FRAME 30 state=Playing`) is a better
  headless signal than a screenshot — screenshots can capture the one frame
  that *did* draw and lie about liveness.
- Beware `cmd | grep | head` around long builds: `head` exiting SIGPIPEs the
  build mid-flight. Log to a file; grep the file.

## 5. The COEP saga (php-wasm) — the best article material here

**Problem.** The site is cross-origin isolated (COOP `same-origin` + COEP
`require-corp`) because Godot's threads need SharedArrayBuffer. php-wasm
**silently does nothing** when `crossOriginIsolated === true` — `php.run()`
resolves with zero output. Diagnosed by bisecting servers: identical bundle
renders on a plain static server, blanks under COOP/COEP, and a
`vrzno_eval`-stage diag showed execution never starts.

**Dead end that looks right:** serve the PHP iframe *same-origin* without
COEP. Doesn't help — **a same-origin iframe inherits the parent's isolation**
regardless of its own headers. Measured: `IFRAME crossOriginIsolated=true`.

**The actual escape hatch:** the `credentialless` iframe attribute + a
**different origin**:
- a COEP:`require-corp` parent normally refuses to embed a no-CORP frame;
  `credentialless` exempts the embed,
- and a *cross-origin* credentialless frame is **not isolated**
  (`crossOriginIsolated === false`) while the parent stays isolated.
- Measured end-to-end; and crucially, **the embedded origin needs zero special
  headers** — a bare `python3 -m http.server` worked, so any dumb static host
  qualifies.

**Production shape:** GitHub Pages *under a different account*
(`cogiton.github.io/frame-games-php`) — because github.io origins split per
**owner**, not per repo, a second repo in the same org would NOT be a second
origin. GH Pages conveniently serves `access-control-allow-origin: *` (probe
fetches work) and correct `application/wasm`. One landmine: php-wasm ships
`_Event.mjs`, and Jekyll silently drops underscore files — `.nojekyll` is
mandatory. Site side: the iframe gets `credentialless` only when the entry is
cross-origin, and the base-path helper must pass fully-qualified URLs through
untouched.

**Contrast:** ruby.wasm runs fine *inside* isolation, and SwiftWasm was
deliberately built single-threaded to stay COEP-compatible. The isolation
requirement is per-runtime, not per-wasm — worth a compatibility table in any
article.

## 6. Infrastructure findings worth keeping

- **Probe files, not entries.** Vite's SPA fallback returns 200 + HTML for
  any path, so HEAD-probing an entry `index.html` lies. Probe a build-only
  artifact (`.wasm`, `.pck`, the bundle `.js`) and reject `text/html`.
- **Live-state bus.** Every port publishes `{AsteroidsGame, Ship,
  AsteroidField}` to `BroadcastChannel("frame-games:state:asteroids")` for the
  site's FSM diagram panel. Bridge per runtime: Godot JS eval, Flame
  `package:web`, emscripten `emscripten_run_script`, Go `syscall/js`, Unity
  `.jslib`, pygbag `platform.window`, Ruby `JS.global`, PHP `vrzno_eval`
  prelude, Java `@JSBody`, Kotlin `js()` dynamic, Swift `JSObject.global`.
  Only LÖVE went without.
- **Letterboxing**: fixed 800×600 design surface everywhere; scale by
  `min(sw/w, sh/h)`. Godot: stretch config. Ebiten: `Layout()`. Unity: manual
  transform. Everyone else: CSS `object-fit: contain` on the canvas.
- **Multi-identity git**: gh authed as one user, git's HTTPS credential
  helper as another → pushes 403 as the wrong user. `git -c
  credential.helper='!gh auth git-credential' push` forces gh's identity.
  Large first pushes may also need `http.postBuffer` raised.
- **Bundle-size league table** (same game, same FSM): Kotlin/JS 68KB · raylib
  324KB · three.js 514KB · TeaVM 548KB · LÖVE 4.9MB · Unity 6.1MB · Swift
  9.0MB · Ebiten 15MB · Ruby 16MB · PHP 21MB · Flame 39MB · Pygame 44KB+CDN.
  A tidy proxy for "how much runtime does this language drag along?"

## 7. Process notes (what made this work)

- **Fixtures + docs before code.** Each port started by reading
  `frame_language.md` and the backend's test fixtures, then probing a tiny
  system through the target's own compiler. When we skipped this (early PHP,
  first Kotlin attempt), we burned cycles distinguishing our own non-canonical
  source from real bugs.
- **Native-toolchain FSM validation before any browser work.** javac/kotlinc/
  swiftc/ruby -c/php -l/py_compile + the same five-line smoke script
  everywhere (`init → start → split → hyperspace → pause/resume`). Browser
  hosts only after the FSM is proven; separates "framec bug" from "engine
  integration bug" completely.
- **Minimal repro or it didn't happen.** Every filed issue: a ≤25-line .frm,
  the exact emitted line, the compiler's verdict, the expected emission, and
  cross-backend comparisons (which sibling targets are immune and why). Every
  fix got a validated-fixed comment same-day: minimal repro AND the full
  regenerated port re-smoked.
- **The no-workarounds rule had teeth.** Twice a port simply *stopped* for a
  fix (#144 PHP, #147/#156/#157 Kotlin/Swift) rather than shipping a patched
  generated file — and every one of those fixes landed within a day, which is
  the whole argument for the discipline.
