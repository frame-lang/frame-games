import type { MobileButton } from "./games";

/**
 * Renders the per-game touch-control bar into `into`, replacing prior
 * contents. Each button dispatches synthetic KeyboardEvents on the window so
 * the scene's existing keyboard input code runs unchanged — Phaser's
 * keyboard plugin listens on window and reads `.code` from the dispatched
 * event, so the polled key state (keys.LEFT.isDown) and discrete
 * keydown-SPACE listeners both fire as if a real key was pressed.
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

    const press = (): void => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: cfg.key, key: cfg.key, bubbles: true }),
      );
    };
    const release = (): void => {
      window.dispatchEvent(
        new KeyboardEvent("keyup", { code: cfg.key, key: cfg.key, bubbles: true }),
      );
    };

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
