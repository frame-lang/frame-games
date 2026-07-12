# frame-games — working instructions

## Mission
These Asteroids language ports exist to **find and fix bugs in framec** (the Frame
transpiler at `/Users/marktruluck/projects/framec`, repo `frame-lang/framec`). Each
new backend is a bug-discovery vehicle. Shipping a playable port is secondary to
surfacing and fixing transpiler defects.

## Absolute rules (from the user, stated repeatedly)
- **NO workarounds. Ever, without explicit permission.** When canonical Frame
  source produces invalid/broken target code, that is a **framec bug** — file it
  and **WAIT for the fix**. Do not change valid source to dodge it. Do not
  hand-edit generated code. "Absolutely no work around… Log bugs and Wait for fixes."
- **Never commit without explicit permission.**
- **Ask before architectural decisions.** Present options, let the user choose.
- Work **methodically and with excellence** — not trial-and-error at lint time.

## Method for a new port (do it in this order)
1. **Read the canonical docs first** — `framec/docs/frame_language.md` (esp.
   "Appendix: Frame Syntax Taxonomy") and `framec/docs/contributing/type-ignorant-codegen.md`.
   Do not guess Frame syntax.
2. **The Frame body model:** a handler line is **native target-language code**;
   Frame only splices in a *closed set* of references/calls:
   - state vars `$.x` (read/write) · return slot `@@:(e)` / `@@:return(e)` (exit) ·
     `@@:system.state.name` · reentrant **self** interface call `@@:self.method(args)`
     (the ONLY thing that emits the `_transitioned` guard) · transitions
     `-> $S`, `=> $^`, `push$`, `-> pop$`.
   - **Everything else is native and written per-target:** domain access
     (`$this->x` / `this.x` / `self.x`), **child-system calls** (`$this->ship->tick($dt);`),
     action/operation calls, locals, `if/while`, terminators. Native `return` exits
     (value lost in handlers — W415); use `@@:(e)` to set a handler's return value.
3. **Per-backend native conventions** (native-passthrough family = js/ts/python/ruby/php/lua):
   PHP → `$vars` + `;` + `if (...) {`; TS → `if (...) {`; Python → `:` + indent;
   Ruby → `if … end`; factory is `_create(args)`. The C-family/Dart translate brace
   control flow instead.
4. **Probe canonical patterns on a tiny system** and confirm with the target's own
   linter/runtime BEFORE writing the full ~400-line FSM.
5. **Validate** the generated FSM with the target toolchain (`php -l`, `ruby -c`,
   `tsc`/esbuild, `py_compile`) + a smoke test, THEN build the host.

## When you hit a defect
- Is it **my non-canonical source**? Fix my source to canonical (per the docs).
- Is it a **genuine framec defect** (canonical source → invalid output)? Create a
  **minimal repro**, `gh issue create -R frame-lang/framec` (account `cogiton`),
  and **stop — the port is blocked pending the fix.** When a fixed `framec` arrives,
  validate (repro + regenerate real port) and post a "validated fixed" comment.

## Port status & bug ledger
Persistent state lives in this project's auto-memory (`MEMORY.md` + files). framec
bugs filed here: #108/#110/#112/#115/#116/#117/#120/#122/#124 (fixed), #126 (not-a-bug),
also #141/#147/#156/#157 (fixed+validated), #144 (php domain initializer — **PHP port
blocked**), #159 (indexed-dispatch family, fixed — birthed E616/E617), #161 (→E616),
plus #164 (OPEN: C typedef-hidden element type silently emits invalid C; needs
E617-style error). Stealth game (first @@[persist] test) surfaced a persist-bug
cluster: #165 (csharp field-loss), #166 (ruby missing require 'json'), #171 (go
missing encoding/json import), #172 (go child save_state casing) — all
FIXED+VALIDATED in local build 4.6.0.x; #174 (python json.dumps of a class —
borderline/likely-wontfix), #175 (swift `init` reserved-keyword — FIXED+validated
4.6.0.8), #176 (dart persist restore blind-cast — FIXED+validated 4.6.0.8),
#178 (swift @@[persist] save/restore mechanism mismatch — FIXED+validated
4.6.0.12). **Stealth matrix = 16/16 byte-identical — COMPLETE** (js ts python
ruby php lua csharp java kotlin go rust c[ASan] cpp[ASan] gdscript dart swift).
Bug harvest: 8 filed / 7 fixed (persist-machinery cluster), #174 borderline. Space Invaders (5th game, orchestrator-as-HSM) = MATRIX 16/16; surfaced+fixed #179 (rust: `-> $Transition` then `@@:return(value)` emitted return before the value assignment — Rust-only, fixed 4.6.0.15). Breakout (6th game, enter-arguments -> (vx,vy) \$InFlight) = MATRIX 16/16, ZERO new bugs — enter-arg marshalling clean across all 16. Lesson: framec C/C++ LOWER @@:self.child.method() so C is a derivation (only list->array is C-specific). Platformer (7th game, ORTHOGONAL COMPOSITION — two peer children loco+power under one orchestrator) = MATRIX 16/16 byte-identical, ZERO new framec bugs; surfaced a per-backend DERIVATION cluster (all my-source, not bugs): child domain fields need a system-type annotation `loco: Locomotion` (Lua needs it for the `:`-call vs nil-`self` crash; typed backends for E605 + child-call lowering); brace backends need `;` on native statements (framec only appends `;` to a handler's LAST stmt → build/addsemi.py); strict int×float casts (Go float64()/Rust as f64/Swift Double()); GDScript systems need `: RefCounted` base + a first `--import` pass. See [[platformer-game]]. Pong (8th + FINAL game, single-system, LABELED transitions `-> "label" $State` + transition-from-an-enter-handler pass-through $PointScored) = MATRIX 16/16 byte-identical + C/C++ ASan-clean, ZERO new framec bugs; new derivation lesson = string comparison is per-target native (Java `==`→`.equals()`, C `==`→`strcmp`, Rust literal→`.to_string()` + String field return→`.clone()`; C++/C#/Kotlin/Swift/Dart/Go `==` value-compare fine). **ALL 8 arcade games now COMPLETE, each MATRIX 16/16 byte-identical.** See [[pong-game]]. Async probe (@@[async], no game) surfaced #181 (reentrant async self-call not awaited — FIXED+validated 4.6.0.20 across all await-backends, incl GDScript runtime add=5/double=10). Two async "suspects" DISPROVEN: C++23 FrameTask leak (ASan+LSan clean, LSan control confirmed active) and GDScript value-drop (runtime correct). Two NEW bugs filed: **#183** (**WONTFIX/by-design** — a user-chosen method name colliding with a target keyword → invalid `int switch()` is name-ignorant passthrough; the TARGET COMPILER is the authority, NOT framec — contrast #175 which was framec's OWN generated `init`. I over-reached filing it; frame is name-ignorant as well as type-ignorant) and **#184** (cpp_23 async `_transitioned` guard after a reentrant self-call emitted bare `return;` in a coroutine, needed `co_return;`; C++ half of #181 missed because #181 was validated by read not compile — **FIXED+VALIDATED 4.6.0.21**: unmodified output compiles+runs `add=5 twice=10`+ASan-clean). **#183 still OPEN** (unchanged in 4.6.0.21).
NOTE: Frame has NO native types — type annotations are opaque passthrough
strings; invalid target code from a type annotation is a wrong source string,
NOT a framec bug (real bugs live in generated machinery). See auto-memory.
