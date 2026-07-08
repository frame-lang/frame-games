import Phaser from "phaser";
import { marked } from "marked";
import { FsmPanel, liveState, splitFrameSystems, type MachineView } from "./fsm-panel";
import { GAMES, channelName, type VersionMeta } from "./games";
import { mountMobileControls } from "./mobile-controls";
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
// Frame sources: each game owns its sources under games/<id>/src (.fjs) and
// games/<id>/frame (.fgd). Vite eager-loads both at build time so the FSM
// panel's per-card source block can render the exact text the diagram was
// generated from.
const FRAME_SOURCES_JS = import.meta.glob<string>(
  "../games/*/src/*.fjs",
  { eager: true, query: "?raw", import: "default" },
);
const FRAME_SOURCES_GODOT = import.meta.glob<string>(
  "../games/*/frame/*.fgd",
  { eager: true, query: "?raw", import: "default" },
);

function findFrameJsSource(gameId: string): string | undefined {
  return FRAME_SOURCES_JS[`../games/${gameId}/src/${gameId}.fjs`];
}

function findGodotSource(gameId: string): string | undefined {
  return FRAME_SOURCES_GODOT[`../games/${gameId}/frame/${gameId}.fgd`];
}

// Per-game live-state accessors. Display metadata (titles, blurbs, push$/pop$
// edges, version entries) lives in games/<id>/game.json; this maps a game id
// to a function that, given the top-level machine instance, returns a getter
// per system. Kept here because it pokes at machine internals (`m.ship`) —
// runtime-only, not part of the shareable manifest.
const STATE_ACCESSORS: Record<
  string,
  (machine: unknown) => Record<string, () => string | null>
> = {
  asteroids: (m) => {
    const sub = m as { ship: unknown };
    return {
      AsteroidsGame: () => liveState(m),
      Ship: () => liveState(sub.ship),
    };
  },
  shooter: (m) => {
    // player/boss are owned children; enemies are driver-populated with a
    // spawn->die lifecycle, so the Enemy card tracks the FIRST live instance
    // (lazily — the list churns during play).
    const sub = m as { player?: unknown; boss?: unknown; enemies?: unknown[] };
    return {
      Shooter: () => liveState(m),
      Player: () => liveState(sub.player),
      Boss: () => liveState(sub.boss),
      Enemy: () => (sub.enemies && sub.enemies.length > 0 ? liveState(sub.enemies[0]) : null),
    };
  },
  stealth: (m) => {
    // guard1/guard2/guard3 are owned children; the Guard card tracks guard1
    // as the representative instance (all three run the same system).
    const sub = m as { guard1?: unknown };
    return {
      Stealth: () => liveState(m),
      Guard: () => liveState(sub.guard1),
    };
  },
  invaders: (m) => {
    // player + fleet are owned children; the orchestrator itself is an HSM
    // ($InGame parent over $Playing/$PlayerDying/$WaveComplete).
    const sub = m as { player?: unknown; fleet?: unknown };
    return {
      Invaders: () => liveState(m),
      Fleet: () => liveState(sub.fleet),
      Player: () => liveState(sub.player),
    };
  },
  pacman: (m) => {
    // Ghosts are driver-populated (the scene add_ghost()s four instances after
    // machine creation), so read the list lazily each tick. The Ghost card
    // tracks Blinky (index 0) as the representative instance; the pen is the
    // scheduler's own child system.
    const sub = m as { ghosts?: unknown[]; pen?: unknown };
    return {
      GhostGame: () => liveState(m),
      Ghost: () => (sub.ghosts && sub.ghosts.length > 0 ? liveState(sub.ghosts[0]) : null),
      GhostPen: () => liveState(sub.pen),
    };
  },
};

const titleEl = document.getElementById("game-title")!;
const controlsEl = document.getElementById("controls")!;
const mobileSlots = {
  left:   document.getElementById("mobile-controls-left")   ?? undefined,
  right:  document.getElementById("mobile-controls-right")  ?? undefined,
  bottom: document.getElementById("mobile-controls")        ?? undefined,
};
const tabsEl = document.getElementById("version-tabs")!;
const jsStage = document.getElementById("js-stage")!;
const godotStage = document.getElementById("godot-stage")!;
const panelEl = document.getElementById("fsm-panel")!;
const articleEl = document.getElementById("article")!;
const fsmAside = document.getElementById("state-machines")!;
const fsmModeBtn = document.getElementById("fsm-mode-toggle") as HTMLButtonElement | null;

const requestedId = new URLSearchParams(location.search).get("game") ?? "asteroids";
const entry = GAMES[requestedId] ?? GAMES.asteroids;
const def = entry.def;
const manifest = entry.manifest;
const accessorsFor = STATE_ACCESSORS[requestedId] ?? STATE_ACCESSORS.asteroids;

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

// A version with an `entry` is an external Godot WASM bundle; one without
// (the "js" entry) is the in-page Phaser runtime. Versions flagged
// `available: false` are wired but not yet built — shown disabled so the
// nav advertises the full language roadmap without offering a dead link.
const isAvailable = (v: VersionMeta): boolean => v.available !== false;

function renderTabs(active: string): void {
  const select = document.createElement("select");
  select.className = "version-select";
  select.id = "version-select";
  select.setAttribute("aria-label", "Implementation");
  for (const v of manifest.versions) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = isAvailable(v) ? v.label : `${v.label} (soon)`;
    opt.disabled = !isAvailable(v);
    if (v.id === active) opt.selected = true;
    select.appendChild(opt);
  }
  select.onchange = () => switchVersion(select.value);
  tabsEl.replaceChildren(select);
}

// Path of the Godot bundle the Godot stage should load. Set before switching
// to the Godot runtime so loadGodot() (driven by the PageController's
// show_godot handler) picks up the right language variant.
let selectedGodotEntry: string | undefined;
let selectedGodotProbe: string | undefined;

function switchVersion(id: string): void {
  if (!ctrl) return; // page controller not ready yet
  const v = manifest.versions.find((x) => x.id === id);
  if (!v) return;
  if (v.entry) {
    // External WASM bundle (Godot or Flame). Loading a different language is
    // just a different bundle in the same iframe — no new PageController state.
    selectedGodotEntry = v.entry;
    selectedGodotProbe = v.probe;
    if (activeRuntime === "godot") {
      // Already showing Godot: swap the bundle in place.
      godotLoaded = false;
      void loadGodot();
    } else {
      ctrl.switch_to_godot(); // show_godot() → loadGodot() reads selectedGodotEntry
    }
  } else {
    ctrl.switch_to_js();
  }
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
  // Fully-qualified entries (the PHP port lives on its own origin — see the
  // credentialless note in loadGodot) pass through untouched.
  if (/^https?:\/\//.test(path)) return path;
  return BASE ? BASE + path : path;
}

// Lazy: only fetch/boot the (heavy) Godot WASM build when its tab is opened.
async function loadGodot(): Promise<void> {
  godotLoaded = true;
  // The language variant chosen in the drop-down; fall back to the first
  // external bundle in the manifest on initial load.
  const found = selectedGodotEntry
    ? manifest.versions.find((v) => v.entry === selectedGodotEntry)
    : manifest.versions.find((v) => v.entry);
  const entry = found?.entry;
  if (!entry) return godotNote("No build is configured for this game.");
  const src = withBase(entry);
  // Probe a build-only artifact — Vite's SPA fallback returns 200 for any
  // unknown index.html, so HEAD on the entry can lie and we'd embed the page
  // inside itself. Default probe is the Godot `.pck`; non-Godot bundles (Flame)
  // declare their own marker via `probe`. The fallback also serves the HTML
  // index for these requests with Content-Type: text/html, so a plain `res.ok`
  // check passes even when no build exists — reject the HTML fallback too.
  const probe = (selectedGodotProbe ?? found?.probe)
    ? withBase((selectedGodotProbe ?? found?.probe)!)
    : src.replace(/\.html(?:\?.*)?$/, ".pck");
  try {
    const res = await fetch(probe, { method: "HEAD" });
    if (!res.ok) throw new Error(String(res.status));
    if ((res.headers.get("content-type") ?? "").includes("text/html")) {
      throw new Error("spa-fallback");
    }
  } catch {
    return godotNote("WASM build not generated yet — run its build script.");
  }
  const frame = document.createElement("iframe");
  // Cross-origin bundles (currently the PHP port) are embedded `credentialless`:
  // the page is cross-origin-isolated (COOP/COEP for the Godot ports'
  // SharedArrayBuffer), and a same-origin iframe inherits that isolation —
  // which php-wasm cannot run under. A *cross-origin* credentialless iframe is
  // allowed into a COEP:require-corp page without CORP headers AND is not
  // isolated itself, so php-wasm works. Same-origin frames are left alone.
  const isCrossOrigin =
    /^https?:\/\//.test(src) && new URL(src).origin !== location.origin;
  if (isCrossOrigin) frame.setAttribute("credentialless", "");
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
  controlsEl.textContent = manifest.controls;
  document.title = `${manifest.title} — Frame Games`;
  renderTabs("js");

  // Touch controls: mount per-game button bar. Each button declares a
  // `position` (left / right / bottom) and the mount routes it to the
  // matching slot. CSS controls visibility — hidden on desktop, shown on
  // devices with no hover + coarse pointer, OR when body.force-touch is
  // set via the ?touch=1 URL param for testing.
  if (manifest.mobileButtons && manifest.mobileButtons.length > 0) {
    mountMobileControls(manifest.mobileButtons, mobileSlots);
  }
  if (new URLSearchParams(location.search).get("touch") === "1") {
    document.body.classList.add("force-touch");
  }

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
  const fjs = findFrameJsSource(manifest.id);
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

  // --- Diagram / code mode toggle. The aside starts in .fsm-mode-diagram
  // (set in game.html). Clicking the button swaps it with .fsm-mode-code,
  // and the CSS hides whichever pane isn't active. The label tracks what
  // the NEXT click will reveal — "Show Code" while diagrams are visible,
  // "Show Diagrams" while code is visible.
  if (fsmModeBtn) {
    fsmModeBtn.onclick = () => {
      const showingDiagram = fsmAside.classList.contains("fsm-mode-diagram");
      fsmAside.classList.toggle("fsm-mode-diagram", !showingDiagram);
      fsmAside.classList.toggle("fsm-mode-code",     showingDiagram);
      fsmModeBtn.textContent = showingDiagram ? "Show Diagrams" : "Show Code";
    };
  }
}

void main();
