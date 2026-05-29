import Phaser from "phaser";
import { breakout } from "../vendor/frame-arcade-js/src/games/breakout";
import { FsmPanel, liveState, type MachineView } from "./fsm-panel";

// A GameDef from the frame-arcade-js submodule (the JS runtime version) plus the
// frame-games-specific bits: how to render each of its machines, and where the
// Godot-WASM build lives. As more games come online, add entries here.
interface GameEntry {
  def: typeof breakout;
  machineViews: (machine: unknown) => MachineView[];
  godot?: { entry: string }; // path to the exported Godot HTML5/WASM index.html
}

const REGISTRY: Record<string, GameEntry> = {
  breakout: {
    def: breakout,
    machineViews: (m) => {
      const sub = m as { ball: unknown; bricks: unknown };
      return [
        {
          system: "Breakout",
          title: "Breakout — the orchestrator",
          blurb:
            "The top-level game. It owns a Ball and a BrickField and never lets the driver touch them directly — it routes collision events inward, updates score / lives / level, and decides when a round is cleared or lost. Paused is pushed onto the state stack so resume returns exactly where you left off.",
          getState: () => liveState(m),
        },
        {
          system: "Ball",
          title: "Ball",
          blurb:
            "The ball's three modes: attached to the paddle, in flight, or lost off the bottom. Velocity is a state variable that exists only while InFlight — so every launch is a fresh serve with no stale velocity.",
          getState: () => liveState(sub.ball),
        },
        {
          system: "BrickField",
          title: "BrickField",
          blurb:
            "A deliberately tiny, one-state system. It exists only to own the brick list behind a clean interface — proof that a participant in a composition needn't itself be a complex machine.",
          getState: () => liveState(sub.bricks),
        },
      ];
    },
    godot: { entry: "/games/breakout/versions/godot-wasm/index.html" },
  },
};

const titleEl = document.getElementById("game-title")!;
const teachesEl = document.getElementById("game-teaches")!;
const controlsEl = document.getElementById("controls")!;
const tabsEl = document.getElementById("version-tabs")!;
const jsStage = document.getElementById("js-stage")!;
const godotStage = document.getElementById("godot-stage")!;
const panelEl = document.getElementById("fsm-panel")!;

const requestedId = new URLSearchParams(location.search).get("game") ?? "breakout";
const entry = REGISTRY[requestedId] ?? REGISTRY.breakout;
const def = entry.def;

let godotLoaded = false;

function renderTabs(active: "js" | "godot"): void {
  const versions: Array<{ v: "js" | "godot"; label: string }> = [
    { v: "js", label: "JavaScript" },
    { v: "godot", label: "Godot (WASM)" },
  ];
  tabsEl.replaceChildren(
    ...versions.map(({ v, label }) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = "tab" + (v === active ? " active" : "");
      b.dataset.v = v;
      b.onclick = () => showVersion(v);
      return b;
    }),
  );
}

function showVersion(v: "js" | "godot"): void {
  jsStage.classList.toggle("hidden", v !== "js");
  godotStage.classList.toggle("hidden", v !== "godot");
  renderTabs(v);
  if (v === "godot" && !godotLoaded) void loadGodot();
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
  const src = entry.godot?.entry;
  if (!src) return godotNote("No Godot build is configured for this game.");
  try {
    const res = await fetch(src, { method: "HEAD" });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    return godotNote("Godot WASM build not generated yet — run `npm run build:godot`.");
  }
  const frame = document.createElement("iframe");
  frame.src = src;
  frame.className = "godot-frame";
  frame.title = `${def.title} — Godot (WASM)`;
  godotStage.replaceChildren(frame);
}

async function main(): Promise<void> {
  titleEl.textContent = def.title;
  teachesEl.textContent = def.teaches;
  controlsEl.textContent = def.controls;
  renderTabs("js");

  // --- JS version: machine + Phaser scene + live FSM panel ---
  const machine = def.createMachine();

  const panel = new FsmPanel(panelEl);
  await panel.render(def.dot, entry.machineViews(machine));

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: jsStage,
    width: def.width ?? 720,
    height: def.height ?? 480,
    backgroundColor: "#0b0e14",
    scene: new def.Scene(machine),
  });

  const tick = (): void => {
    panel.tick();
    requestAnimationFrame(tick);
  };
  tick();
}

void main();
