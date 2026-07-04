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
E617-style error) and #165 (OPEN: csharp @@[persist] drops field-based user types,
silent — **C# Stealth column blocked**).
