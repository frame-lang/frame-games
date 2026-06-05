import Phaser from "phaser";
import { marked } from "marked";
import { FsmPanel, liveState, splitFrameSystems, type MachineView } from "./fsm-panel";
import { GAMES, channelName, versionEntry } from "./games";
import { PageController } from "./page.machine.js";

// Per-game long-form articles. Vite eager-loads every games/<id>/article.md as
// raw text at build time so the loader is sync + the article section is
// optional — a game without an article.md just keeps the section hidden.
const ARTICLES = import.meta.glob<string>("../games/*/article.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

// Per-game Frame source, rendered below the FSM panel so readers can see the
// controller that produced those diagrams. Two glob sets — the .fjs that
// drives the JS runtime and the .fgd that drives the Godot runtime. Same
// system names + transitions on both sides (the diagrams come from the .fjs
// DOT either way), but the source TEXT differs: target attribute, sometimes
// per-target type annotations, sometimes minor target-specific tweaks. We
// swap the source displayed under each card when the active runtime
// changes, while leaving the chart SVGs untouched.
const FRAME_SOURCES_JS = import.meta.glob<string>(
  "../vendor/frame-arcade-js/src/games/*/*.fjs",
  { eager: true, query: "?raw", import: "default" },
);
const FRAME_SOURCES_GODOT = import.meta.glob<string>(
  "../vendor/frame-arcade/*/frame/*.fgd",
  { eager: true, query: "?raw", import: "default" },
);
// The Godot chapter dirs are named ch01-pong / ch02-breakout / ..., so we
// can't key by gameId directly. Pick the .fgd whose filename basename matches.
function findGodotSource(gameId: string): string | undefined {
  const suffix = `/${gameId}.fgd`;
  for (const [path, src] of Object.entries(FRAME_SOURCES_GODOT)) {
    if (path.endsWith(suffix)) return src;
  }
  return undefined;
}

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
  invaders: (m) => {
    const sub = m as { player: unknown; fleet: unknown };
    return {
      Invaders: () => liveState(m),
      Player: () => liveState(sub.player),
      Fleet: () => liveState(sub.fleet),
    };
  },
  asteroids: (m) => {
    const sub = m as { ship: unknown };
    return {
      AsteroidsGame: () => liveState(m),
      Ship: () => liveState(sub.ship),
    };
  },
  pacman: (m) => {
    // Four ghosts run the same FSM; the panel visualizes the first one (the
    // others are state-equivalent for diagram purposes, just differently
    // parameterized — Blinky / Pinky / Inky / Clyde).
    const sub = m as { ghosts: unknown[] };
    return {
      GhostGame: () => liveState(m),
      Ghost: () => liveState(sub.ghosts[0]),
    };
  },
  platformer: (m) => {
    const sub = m as { loco: unknown; power: unknown };
    return {
      Platformer: () => liveState(m),
      Locomotion: () => liveState(sub.loco),
      PowerUp: () => liveState(sub.power),
    };
  },
  shooter: (m) => {
    // Many enemies run concurrently and are spawned dynamically — the panel
    // tracks the first one. enemies[] is empty in Attract; null falls through
    // to no highlight, which is correct (no enemy live in that phase).
    const sub = m as { player: unknown; boss: unknown; enemies: unknown[] };
    return {
      Shooter: () => liveState(m),
      Player: () => liveState(sub.player),
      Boss: () => liveState(sub.boss),
      Enemy: () => liveState(sub.enemies[0]),
    };
  },
  stealth: (m) => {
    // Three guards run the same FSM independently; the panel tracks the
    // first one. (guard1 / guard2 / guard3 — named fields, not an array.)
    const sub = m as { guard1: unknown };
    return {
      Stealth: () => liveState(m),
      Guard: () => liveState(sub.guard1),
    };
  },
};

const titleEl = document.getElementById("game-title")!;
const teachesEl = document.getElementById("game-teaches")!;
const controlsEl = document.getElementById("controls")!;
const tabsEl = document.getElementById("version-tabs")!;
const jsStage = document.getElementById("js-stage")!;
const godotStage = document.getElementById("godot-stage")!;
const panelEl = document.getElementById("fsm-panel")!;
const popoutBtn = document.getElementById("popout") as HTMLButtonElement | null;
const articleEl = document.getElementById("article")!;

const requestedId = new URLSearchParams(location.search).get("game") ?? "breakout";
const entry = GAMES[requestedId] ?? GAMES.breakout;
const def = entry.def;
const manifest = entry.manifest;
const accessorsFor = STATE_ACCESSORS[requestedId] ?? STATE_ACCESSORS.breakout;

let godotLoaded = false;

// The PageController Frame machine (src/page.fjs) drives every tab change.
// It owns two states ($JavaScript / $Godot); the host object's show_*/hide_*
// methods are called from the state's $>() / <$() handlers to actually
// mount and tear down each runtime. ctrl is created after Phaser is ready
// so the initial $JavaScript.$>() handler has a working game instance.
type PageCtrl = { switch_to_js: () => void; switch_to_godot: () => void };
let ctrl: PageCtrl | null = null;
// Tracks which runtime the PageController is currently in. Used by the RAF
// tick (skip panel.tick() when Godot is driving) and the BroadcastChannel
// listener (apply snapshots from the Godot autoload when active).
let activeRuntime: "js" | "godot" = "js";

function renderTabs(active: string): void {
  tabsEl.replaceChildren(
    ...manifest.versions.map((v) => {
      const b = document.createElement("button");
      b.textContent = v.label;
      b.className = "tab" + (v.id === active ? " active" : "");
      b.dataset.v = v.id;
      b.onclick = () => switchVersion(v.id);
      return b;
    }),
  );
}

function switchVersion(id: string): void {
  if (!ctrl) return; // page controller not ready yet
  if (id === "js") ctrl.switch_to_js();
  else if (id === "godot-wasm") ctrl.switch_to_godot();
  renderTabs(id);
}

function godotNote(msg: string): void {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = msg;
  godotStage.replaceChildren(p);
}

// Vite's BASE_URL — "/" in dev, "/frame-games/" in production. Used to
// rewrite absolute "/games/..." URLs that come from authored content
// (game.json's Godot entry, article markdown image refs) so they resolve
// correctly when the site is served from a subpath.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function withBase(path: string): string {
  return BASE ? BASE + path : path;
}

// Lazy: only fetch/boot the (heavy) Godot WASM build when its tab is opened.
async function loadGodot(): Promise<void> {
  godotLoaded = true;
  const entry = versionEntry(manifest, "godot-wasm")?.entry;
  if (!entry) return godotNote("No Godot build is configured for this game.");
  const src = withBase(entry);
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
  // Pull focus into the iframe once Godot's HTML loads so keyboard events
  // route to the WASM canvas (otherwise SPACE/arrows might stay on the
  // outer page and never reach Godot).
  frame.addEventListener("load", () => frame.focus());
  godotStage.replaceChildren(frame);
}

async function main(): Promise<void> {
  titleEl.textContent = manifest.title;
  teachesEl.textContent = manifest.teaches;
  controlsEl.textContent = manifest.controls;
  document.title = `${manifest.title} — Frame Games`;
  renderTabs("js");

  // Long-form article (optional): hidden unless games/<id>/article.md exists.
  // Markdown image refs like ![](/games/asteroids/images/x.svg) are static
  // strings — rewrite them at parse time to respect the deployed subpath.
  const articleMd = ARTICLES[`../games/${manifest.id}/article.md`];
  if (articleMd) {
    const html = (marked.parse(articleMd) as string).replace(
      /(\s(?:src|href)=)"\/games\//g,
      `$1"${BASE}/games/`,
    );
    articleEl.innerHTML = html;
    articleEl.classList.remove("hidden");
  }


  // --- JS version: machine + Phaser scene + live FSM panel ---
  //
  // Some games' FSMs push one-shot effects to the scene via host callbacks
  // (e.g. Ship.$Exploding.$>() calls host.spawn_explosion()). The scene IS
  // the host, but it isn't constructed yet — so we hand the FSM a Proxy
  // whose property accesses forward to `sceneRef.current` once it's set
  // below. No host method can fire during machine construction (initial
  // states have no $> handlers that touch the host), so the deferred wire
  // is safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef: { current: any } = { current: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneHost = new Proxy({} as any, {
    get: (_, prop: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: unknown[]) => sceneRef.current?.[prop]?.(...args),
  });
  const machine = def.createMachine(sceneHost);
  const accessors = accessorsFor(machine);

  // Per-system Frame source: split each Frame file once, look up by system
  // name. Two maps — the active runtime's wins on initial render and on
  // tab change. If a runtime's source file isn't available, switching to it
  // is a no-op (the previous source stays visible) rather than blanking
  // the panel.
  const fjs = FRAME_SOURCES_JS[`../vendor/frame-arcade-js/src/games/${manifest.id}/${manifest.id}.fjs`];
  const fgd = findGodotSource(manifest.id);
  const sourcesByRuntime: Record<"js" | "godot", Map<string, string>> = {
    js: new Map((fjs ? splitFrameSystems(fjs) : []).map((s) => [s.system, s.source])),
    godot: new Map((fgd ? splitFrameSystems(fgd) : []).map((s) => [s.system, s.source])),
  };

  // Compose live MachineViews from the manifest metadata + the runtime
  // accessors. Initial source = JS (the PageController starts in $JavaScript);
  // host.show_godot() / show_js() swap them via panel.setSources().
  const views: MachineView[] = manifest.machines.map((m) => ({
    ...m,
    getState: accessors[m.system],
    source: sourcesByRuntime.js.get(m.system),
  }));

  const panel = new FsmPanel(panelEl);
  await panel.render(def.dot, views);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: jsStage,
    width: def.width ?? 720,
    height: def.height ?? 480,
    backgroundColor: "#0b0e14",
    // FIT scales the canvas to fill the parent while preserving aspect ratio —
    // the game keeps its logical 720x480 coordinate system internally, so
    // game code doesn't need to change for different display sizes.
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: (() => {
      // Construct the scene FIRST so we can register it as the host target
      // before any FSM event fires. Phaser still drives its lifecycle —
      // we're just placing the instance in the config.
      const sceneInstance = new def.Scene(machine);
      sceneRef.current = sceneInstance;
      return sceneInstance;
    })(),
  });

  // Tell Phaser to capture (preventDefault) the keys the game uses, so the
  // browser doesn't scroll the page on SPACE / arrows. Phaser preventDefaults
  // captured keys INSIDE its own keydown handler — after it queues the event —
  // so the scene still receives them. A naive window-level preventDefault
  // listener would break this: Phaser's keydown handler bails when it sees
  // event.defaultPrevented, and the canvas would receive nothing.
  game.events.once("ready", () => {
    game.input.keyboard?.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT"]);

    // Wire the PageController. The state's $>() / <$() handlers call into
    // this host to actually mount / tear down each runtime — pause Phaser
    // + disable its keyboard when leaving JS (so SPACE/arrows reach the
    // Godot iframe), destroy the iframe when leaving Godot (frees WASM
    // and avoids the running game capturing focus). The initial state is
    // $JavaScript, so show_js() fires once on create — its actions are
    // no-ops since the JS stage is already visible + the loop already
    // awake on page load.
    const host = {
      show_js() {
        activeRuntime = "js";
        jsStage.classList.remove("hidden");
        godotStage.classList.add("hidden");
        if (game.input.keyboard) game.input.keyboard.enabled = true;
        game.loop.wake();
        if (sourcesByRuntime.js.size > 0) panel.setSources(sourcesByRuntime.js);
      },
      hide_js() {
        jsStage.classList.add("hidden");
        if (game.input.keyboard) game.input.keyboard.enabled = false;
        game.loop.sleep();
      },
      show_godot() {
        activeRuntime = "godot";
        godotStage.classList.remove("hidden");
        jsStage.classList.add("hidden");
        if (!godotLoaded) void loadGodot();
        // Falls back to leaving the JS source visible when no .fgd exists.
        if (sourcesByRuntime.godot.size > 0) panel.setSources(sourcesByRuntime.godot);
      },
      hide_godot() {
        godotStage.classList.add("hidden");
        godotStage.replaceChildren(); // destroy the iframe → free WASM
        godotLoaded = false;
      },
    };
    ctrl = PageController._create(host);
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
    if (e.data === "ping") {
      sendSnapshot(true);
      return;
    }
    // Foreign snapshot (e.g., the Godot autoload publishing while the
    // Godot tab is active). Drive the local FSM panel from it so the
    // diagrams sync with whatever runtime is currently playing.
    if (activeRuntime === "godot" && typeof e.data === "object" && e.data !== null) {
      panel.applyStates(e.data as Record<string, string>);
    }
  };

  const tick = (): void => {
    // Skip the local-machine read when Godot is driving — the panel is
    // already being updated by applyStates() from the BroadcastChannel
    // listener above, and re-reading the (paused) JS machine each frame
    // would just paint over the Godot state with stale JS state.
    if (activeRuntime === "js") {
      panel.tick();
      sendSnapshot(false);
    }
    requestAnimationFrame(tick);
  };
  tick();

  // --- Resize handle: drag the grip up to shrink the game, down to grow it.
  // The CSS uses `--play-h` to derive width (with aspect-ratio deriving the
  // final height); a ResizeObserver on the stage triggers Phaser to refit
  // its canvas continuously as the drag progresses.
  const handle = document.getElementById("resize-handle");
  const playStage = document.querySelector(".play-stage") as HTMLElement | null;
  if (handle && playStage) {
    let dragging = false;
    let startY = 0;
    let startH = 0;
    const MIN_H = 180;
    const MAX_H = 900;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      startH = playStage.offsetHeight;
      handle.classList.add("dragging");
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      const newH = Math.max(MIN_H, Math.min(MAX_H, startH + dy));
      // Write to documentElement so the anchor scroll-margins on
      // #state-machines / #article (which use var(--play-h)) update too.
      document.documentElement.style.setProperty("--play-h", `${newH}px`);
    });
    const endDrag = (): void => {
      dragging = false;
      handle.classList.remove("dragging");
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    // Refit Phaser's canvas whenever the stage's box changes (drag, window
    // resize, devicePixelRatio change, etc).
    new ResizeObserver(() => game.scale.refresh()).observe(playStage);
  }

  // --- Pop-out button: opens fsm.html in a named window (reuses if already open).
  if (popoutBtn) {
    popoutBtn.onclick = () => {
      window.open(
        `${import.meta.env.BASE_URL}fsm.html?game=${encodeURIComponent(manifest.id)}`,
        `fsm-${manifest.id}`,
        "width=1400,height=900",
      );
    };
  }
}

void main();
