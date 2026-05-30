// The pop-out FSM viewer. Renders the same FsmPanel as the game page, but the
// state highlights are driven by BroadcastChannel snapshots from a separate
// window that's running the game. On boot it pings the channel so any active
// game page replies with its current snapshot — late-joiners light up
// immediately instead of waiting for the next state transition.
import { FsmPanel, type MachineView } from "./fsm-panel";
import { GAMES, channelName } from "./games";

const titleEl = document.getElementById("game-title")!;
const teachesEl = document.getElementById("game-teaches")!;
const panelEl = document.getElementById("fsm-panel")!;
const statusEl = document.getElementById("status")!;

const requestedId = new URLSearchParams(location.search).get("game") ?? "breakout";
const entry = GAMES[requestedId] ?? GAMES.breakout;
const def = entry.def;

titleEl.textContent = `${def.title} — state machines`;
teachesEl.textContent = def.teaches;
document.title = `${def.title} state machines — Frame Games`;

// No getState callbacks here — the panel is driven entirely by applyStates()
// from incoming broadcasts. The metadata (titles, blurbs, push$/pop$ edges)
// comes straight from the shared games registry.
const views: MachineView[] = entry.machines.map((m) => ({ ...m }));

const panel = new FsmPanel(panelEl, true);
await panel.render(def.dot, views);

const channel = new BroadcastChannel(channelName(def.id));

channel.onmessage = (e) => {
  if (typeof e.data !== "object" || e.data === null) return;
  panel.applyStates(e.data as Record<string, string>);
  statusEl.textContent = `Live · updated ${new Date().toLocaleTimeString()}`;
};

// Ask any open game page to broadcast its current snapshot immediately.
channel.postMessage("ping");

// If nothing answers within a second, the game isn't open.
window.setTimeout(() => {
  if (statusEl.textContent?.startsWith("Waiting")) {
    statusEl.textContent = "No game window detected — open the game and play.";
  }
}, 1000);
