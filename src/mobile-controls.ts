import type { MobileButton } from "./games";

/**
 * Renders the per-game touch-control bar into `into`, replacing prior
 * contents. Each button dispatches synthetic KeyboardEvents on the window so
 * the scene's existing keyboard input code runs unchanged — Phaser's
 * keyboard plugin listens on window and matches keys by `event.keyCode`
 * (the legacy numeric, not `event.code`), so the polled key state
 * (keys.LEFT.isDown) and discrete keydown-SPACE listeners both fire as if
 * a real key was pressed.
 *
 * Multi-touch is supported via setPointerCapture: each button captures its
 * own pointerId so simultaneous presses (e.g. ▶ + ▲ for turn-and-thrust)
 * don't interfere.
 *
 * Hold-style buttons keep the key pressed between pointerdown and pointerup
 * (the polled keys.*.isDown stays true). Tap-style buttons fire keydown +
 * keyup back-to-back on pointerdown — the underlying scene event handlers
 * (keydown-SPACE etc.) fire once per tap.
 */

// Map KeyboardEvent.code → legacy numeric keyCode. Phaser 3.x dispatches
// keyboard events by keyCode internally (see Phaser.Input.Keyboard.KeyCodes),
// and a KeyboardEvent constructed via `new KeyboardEvent(...)` defaults to
// keyCode 0 unless explicitly set in the init dict.
const SPECIAL_KEY_CODES: Record<string, number> = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Space: 32,
  Enter: 13,
  Escape: 27,
  Tab: 9,
  Backspace: 8,
};

function codeToKeyCode(code: string): number {
  if (code in SPECIAL_KEY_CODES) return SPECIAL_KEY_CODES[code];
  if (code.length === 4 && code.startsWith("Key")) {
    return code.charCodeAt(3); // KeyA..KeyZ -> 65..90
  }
  if (code.length === 6 && code.startsWith("Digit")) {
    return code.charCodeAt(5); // Digit0..Digit9 -> 48..57
  }
  return 0;
}

// Build a KeyboardEvent in a specific realm (window context). Cross-realm
// dispatch is fragile — events constructed in the parent realm but
// dispatched on an iframe's contentWindow may be rejected as "wrong
// document," so we use the iframe's own KeyboardEvent constructor when
// forwarding into it.
function buildKeyEvent(
  Ctor: typeof KeyboardEvent,
  type: "keydown" | "keyup",
  code: string,
  keyCode: number,
): KeyboardEvent {
  const ev = new Ctor(type, {
    code, key: code, keyCode,
    bubbles: true, cancelable: true,
  });
  // Some browsers ignore keyCode passed in the init dict (it's a legacy
  // property). Force keyCode + which via defineProperty so Phaser sees
  // the right value on either path.
  try {
    Object.defineProperty(ev, "keyCode", { get: () => keyCode });
    Object.defineProperty(ev, "which",   { get: () => keyCode });
  } catch { /* read-only on some platforms — init-dict value will have to do */ }
  return ev;
}

function fireKey(type: "keydown" | "keyup", code: string): void {
  const keyCode = codeToKeyCode(code);

  // Parent window: Phaser listens here.
  window.dispatchEvent(buildKeyEvent(KeyboardEvent, type, code, keyCode));

  // Forward into any same-origin iframe (the Godot WASM build is embedded
  // as an iframe — its keyboard listeners live in that frame's realm, so
  // events dispatched on the parent window never reach them). Cross-origin
  // frames throw on contentWindow access; swallow and move on.
  const frames = document.getElementsByTagName("iframe");
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    try {
      const cw = f.contentWindow;
      const cd = f.contentDocument;
      if (!cw || !cd) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor: typeof KeyboardEvent = ((cw as any).KeyboardEvent ?? KeyboardEvent);
      const dispatchOn = (target: EventTarget): void => {
        target.dispatchEvent(buildKeyEvent(Ctor, type, code, keyCode));
      };
      // Godot's Emscripten HTML5 backend may have wired its listeners on
      // the canvas, the document, or the window — dispatch on all three
      // (no-op on whichever isn't listening). Canvas first for specificity.
      const canvas = cd.querySelector("canvas");
      if (canvas) dispatchOn(canvas);
      dispatchOn(cd);
      dispatchOn(cw);
    } catch { /* cross-origin / detached frame */ }
  }
}

/** Mount points for the touch buttons. A button's `position` field
 * (defaulting to "bottom") picks which slot it lands in. Missing slots are
 * tolerated — buttons targeting an unmounted slot are silently skipped. */
export interface MobileSlots {
  left?: HTMLElement;
  right?: HTMLElement;
  bottom?: HTMLElement;
}

// Tracks which hold buttons are currently considered "pressed" — we use
// it to defend against the stuck-key race: rapid double-taps on a hold
// button can dispatch a second pointerdown before the first pointerup
// resolves, which without this map would leave one synthetic keydown
// outstanding with no matching keyup, freezing turn/thrust on until the
// next manual press. On every pointerdown we check this map and force a
// release if the button is still marked pressed.
const pressedButtons = new Map<HTMLElement, string>();

function releaseButtonKey(btn: HTMLElement): void {
  const code = pressedButtons.get(btn);
  if (code == null) return;
  btn.classList.remove("active");
  fireKey("keyup", code);
  pressedButtons.delete(btn);
}

function releaseAllPressedButtons(): void {
  for (const btn of Array.from(pressedButtons.keys())) {
    releaseButtonKey(btn);
  }
}

// Wire global safety nets once (module-level). Backgrounding the page or
// losing focus (e.g., the user pulls up Control Centre mid-thrust) should
// release every held key so we don't return to a stuck state.
if (typeof window !== "undefined") {
  window.addEventListener("blur", releaseAllPressedButtons);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAllPressedButtons();
  });
}

function buildButton(cfg: MobileButton): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mobile-control" + (cfg.hold ? " mobile-control-hold" : "");
  // Single-codepoint icons (↻ / ⏸ / ⚡ etc.) get the U+FE0E variation
  // selector appended so iOS Safari renders them as text-style glyphs
  // instead of colored emoji. font-variant-emoji: text in CSS handles
  // most modern browsers, but the variation selector works universally
  // and costs nothing for non-emoji characters.
  btn.textContent = cfg.label.length === 1 ? cfg.label + "︎" : cfg.label;
  btn.setAttribute("aria-label", cfg.label);

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    // Defensive release: if a previous pointerdown's keydown hasn't been
    // matched by a keyup yet (lost pointerup, rapid double-tap, etc.),
    // release it before starting a new press to avoid stuck-down keys.
    if (pressedButtons.has(btn)) {
      releaseButtonKey(btn);
    }
    try { btn.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    btn.classList.add("active");
    fireKey("keydown", cfg.key);
    if (cfg.hold) {
      pressedButtons.set(btn, cfg.key);
    } else {
      // Tap buttons: hold the synthetic key down for ~80ms before releasing.
      // Phaser fires its discrete `keydown-SPACE` listener the moment the
      // event arrives, so it doesn't care about hold duration — but Godot's
      // GDScript polls Input.is_key_pressed() each _physics_process frame
      // and uses rising-edge detection (`if pressed and not _was_down`). A
      // synchronous keydown+keyup on the same tick is invisible to that
      // poll: the next physics frame already sees pressed=false. 80ms gives
      // Godot ~5 frames of pressed state, plenty for the edge to register.
      window.setTimeout(() => fireKey("keyup", cfg.key), 80);
    }
  });
  const up = (e: PointerEvent): void => {
    if (btn.hasPointerCapture(e.pointerId)) {
      try { btn.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
    }
    // Only hold buttons have an outstanding keydown to release here. Tap
    // buttons release themselves via setTimeout above; we still clear the
    // .active class for visual feedback.
    if (cfg.hold) {
      releaseButtonKey(btn);
    } else {
      btn.classList.remove("active");
    }
  };
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  // lostpointercapture fires whenever the browser drops the capture (e.g.
  // OS gesture interrupts, dialog opens). Treat it as a release so we
  // don't end up with an unmatched keydown.
  btn.addEventListener("lostpointercapture", () => releaseButtonKey(btn));

  return btn;
}

export function mountMobileControls(
  buttons: readonly MobileButton[],
  slots: MobileSlots,
): void {
  // Clear every provided slot first so re-mounts don't accumulate.
  for (const slot of [slots.left, slots.right, slots.bottom]) {
    slot?.replaceChildren();
  }
  for (const cfg of buttons) {
    const where = cfg.position ?? "bottom";
    const target = slots[where];
    if (!target) continue;
    target.appendChild(buildButton(cfg));
  }
}
