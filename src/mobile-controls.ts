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

function fireKey(type: "keydown" | "keyup", code: string): void {
  const keyCode = codeToKeyCode(code);
  // Some browsers ignore keyCode passed in the init dict (it's a legacy
  // property). Construct the event then force keyCode + which via
  // Object.defineProperty so Phaser sees the right value on either path.
  const ev = new KeyboardEvent(type, {
    code,
    key: code,
    keyCode,
    bubbles: true,
    cancelable: true,
  });
  try {
    Object.defineProperty(ev, "keyCode", { get: () => keyCode });
    Object.defineProperty(ev, "which",   { get: () => keyCode });
  } catch { /* read-only on some platforms — init-dict value will have to do */ }
  window.dispatchEvent(ev);
}

export function mountMobileControls(
  buttons: readonly MobileButton[],
  into: HTMLElement,
): void {
  into.replaceChildren();
  for (const cfg of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mobile-control" + (cfg.hold ? " mobile-control-hold" : "");
    btn.textContent = cfg.label;
    btn.setAttribute("aria-label", cfg.label);

    const press = (): void => fireKey("keydown", cfg.key);
    const release = (): void => fireKey("keyup", cfg.key);

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch { /* no-op */ }
      btn.classList.add("active");
      press();
      if (!cfg.hold) release();
    });
    const up = (e: PointerEvent): void => {
      btn.classList.remove("active");
      if (btn.hasPointerCapture(e.pointerId)) {
        try { btn.releasePointerCapture(e.pointerId); } catch { /* no-op */ }
      }
      if (cfg.hold) release();
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);

    into.appendChild(btn);
  }
}
