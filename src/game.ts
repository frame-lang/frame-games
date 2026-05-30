import Phaser from "phaser";
import { FsmPanel, liveState, type MachineView } from "./fsm-panel";
import { GAMES, channelName, versionEntry } from "./games";

// Per-game live-state accessors. Display metadata (titles, blurbs, push$/pop$
// edges, version entries) lives in games/<id>/game.json; this maps a game id
// to a function that, given the top-level machine instance, returns a getter
// per system. Kept here because it pokes at machine internals (`m.ball`,
// `m.bricks`) — runtime-only, not part of the shareable manifest.
const STATE_ACCESSORS: Record<
  string,
  (machine: unknown) => Record<string, () => string | null>
> = {
  breakout: (m) => {
    const sub = m as { ball: unknown; bricks: unknown };
    return {
      Breakout: () => liveState(m),
      Ball: () => liveState(sub.ball),
      BrickField: () => liveState(sub.bricks),
    };
  },
  pong: (m) => ({
    Pong: () => liveState(m),
  }),
};

const titleEl = document.getElementById("game-title")!;
const teachesEl = document.getElementById("game-teaches")!;
const controlsEl = document.getElementById("controls")!;
const tabsEl = document.getElementById("version-tabs")!;
const jsStage = document.getElementById("js-stage")!;
const godotStage = document.getElementById("godot-stage")!;
const panelEl = document.getElementById("fsm-panel")!;
const popoutBtn = document.getElementById("popout") as HTMLButtonElement | null;

const requestedId = new URLSearchParams(location.search).get("game") ?? "breakout";
const entry = GAMES[requestedId] ?? GAMES.breakout;
const def = entry.def;
const manifest = entry.manifest;
const accessorsFor = STATE_ACCESSORS[requestedId] ?? STATE_ACCESSORS.breakout;

let godotLoaded = false;

function renderTabs(active: string): void {
  tabsEl.replaceChildren(
    ...manifest.versions.map((v) => {
      const b = document.createElement("button");
      b.textContent = v.label;
      b.className = "tab" + (v.id === active ? " active" : "");
      b.dataset.v = v.id;
      b.onclick = () => showVersion(v.id);
      return b;
    }),
  );
}

function showVersion(id: string): void {
  jsStage.classList.toggle("hidden", id !== "js");
  godotStage.classList.toggle("hidden", id !== "godot-wasm");
  renderTabs(id);
  if (id === "godot-wasm" && !godotLoaded) void loadGodot();
}

function godotNote(msg: string): void {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = msg;
  godotStage.replaceChildren(p);
}

// Lazy: only fetch/boot the (heavy) Godot WASM build when its tab is opened.
async function loadGodot(): Promise<void> {
  godotLoaded = true;
  const src = versionEntry(manifest, "godot-wasm")?.entry;
  if (!src) return godotNote("No Godot build is configured for this game.");
  // Probe a Godot-only artifact (the .pck) — Vite's SPA fallback returns 200
  // for any unknown index.html, so HEAD on the entry can lie and we'd embed
  // the page inside itself. The .pck only exists when the real export ran.
  // Vite's fallback also serves the HTML index for .pck requests with
  // Content-Type: text/html, so a plain `res.ok` check passes even when no
  // build exists — reject the HTML fallback explicitly.
  const pckProbe = src.replace(/\.html(?:\?.*)?$/, ".pck");
  try {
    const res = await fetch(pckProbe, { method: "HEAD" });
    if (!res.ok) throw new Error(String(res.status));
    if ((res.headers.get("content-type") ?? "").includes("text/html")) {
      throw new Error("spa-fallback");
    }
  } catch {
    return godotNote("Godot WASM build not generated yet — run `npm run build:godot`.");
  }
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.className = "godot-frame";
  frame.title = `${manifest.title} — Godot (WASM)`;
  godotStage.replaceChildren(frame);
}

async function main(): Promise<void> {
  titleEl.textContent = manifest.title;
  teachesEl.textContent = manifest.teaches;
  controlsEl.textContent = manifest.controls;
  document.title = `${manifest.title} — Frame Games`;
  renderTabs("js");

  // --- JS version: machine + Phaser scene + live FSM panel ---
  const machine = def.createMachine();
  const accessors = accessorsFor(machine);

  // Compose live MachineViews from the manifest metadata + the runtime accessors.
  const views: MachineView[] = manifest.machines.map((m) => ({
    ...m,
    getState: accessors[m.system],
  }));

  const panel = new FsmPanel(panelEl);
  await panel.render(def.dot, views);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: jsStage,
    width: def.width ?? 720,
    height: def.height ?? 480,
    backgroundColor: "#0b0e14",
    scene: new def.Scene(machine),
  });

  // Tell Phaser to capture (preventDefault) the keys the game uses, so the
  // browser doesn't scroll the page on SPACE / arrows. Phaser preventDefaults
  // captured keys INSIDE its own keydown handler — after it queues the event —
  // so the scene still receives them. A naive window-level preventDefault
  // listener would break this: Phaser's keydown handler bails when it sees
  // event.defaultPrevented, and the canvas would receive nothing.
  game.events.once("ready", () => {
    game.input.keyboard?.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT"]);
  });

  // --- BroadcastChannel: publish state snapshots for the pop-out FSM viewer.
  // Sent on change, plus on demand when a viewer pings — so a late-joining
  // window lights up immediately instead of waiting for the next transition.
  const channel = new BroadcastChannel(channelName(manifest.id));
  let lastJson = "";
  const sendSnapshot = (force: boolean): void => {
    // When the Godot tab is active, the iframe's own publisher drives the
    // channel; broadcasting from the hidden JS game on top would race and
    // make the diagrams flicker between the two engines' states.
    if (jsStage.classList.contains("hidden")) return;
    const snapshot: Record<string, string> = {};
    for (const [sys, get] of Object.entries(accessors)) {
      const s = get();
      if (s) snapshot[sys] = s;
    }
    const json = JSON.stringify(snapshot);
    if (force || json !== lastJson) {
      channel.postMessage(snapshot);
      lastJson = json;
    }
  };
  channel.onmessage = (e) => {
    if (e.data === "ping") sendSnapshot(true);
  };

  const tick = (): void => {
    panel.tick();
    sendSnapshot(false);
    requestAnimationFrame(tick);
  };
  tick();

  // --- Pop-out button: opens fsm.html in a named window (reuses if already open).
  if (popoutBtn) {
    popoutBtn.onclick = () => {
      window.open(
        `/fsm.html?game=${encodeURIComponent(manifest.id)}`,
        `fsm-${manifest.id}`,
        "width=1400,height=900",
      );
    };
  }
}

void main();
