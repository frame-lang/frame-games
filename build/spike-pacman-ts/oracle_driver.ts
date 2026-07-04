// Pac-Man cross-language oracle — TypeScript driver. Mirrors
// games/pacman/oracle/run-oracle.mjs step-for-step; output must byte-match
// expected-trace.txt.
import { GhostGame, Ghost } from "./pacman";

const DT = 1 / 64;
const g = (GhostGame as any)._create();
const names = ["blinky", "pinky", "inky", "clyde"];
const corners = [
  { x: 680, y: 40 },
  { x: 40, y: 40 },
  { x: 680, y: 440 },
  { x: 40, y: 440 },
];

let step = 0;
function snap(label: string): void {
  const gs: string[] = [];
  for (let i = 0; i < g.ghost_count(); i++) gs.push(g.ghost_state(i));
  while (gs.length < 4) gs.push("-");
  const flags: string[] = [];
  for (let i = 0; i < g.ghost_count(); i++) {
    flags.push(`${g.ghost_is_dangerous(i) ? "D" : "."}${g.ghost_is_edible(i) ? "E" : "."}`);
  }
  while (flags.length < 4) flags.push("--");
  console.log(
    `${String(step).padStart(3, "0")} ${label.padEnd(28)} phase=${g.get_phase().padEnd(10)} ` +
      `fright=${g.frighten_seconds_left().toFixed(3).padStart(7)} score=${String(g.get_score()).padStart(4)} ` +
      `g=[${gs.map((s) => s.padEnd(10)).join(" ")}] f=[${flags.join(" ")}]`,
  );
  step++;
}
function tick(n: number, label: string): void {
  for (let i = 0; i < n; i++) g.tick(DT);
  snap(`tick x${n} (${label})`);
}

snap("created");
for (let i = 0; i < 4; i++) g.add_ghost((Ghost as any)._create(names[i], corners[i], i));
snap("add_ghost x4");
g.start();
snap("start");

tick(64, "1.0s: pen not due");
tick(80, "2.25s: 1st release");
tick(128, "4.25s: 2nd release");
tick(128, "6.25s: 3rd release");
tick(64, "7.25s: scatter(7s) over");

g.power_pellet_picked_up();
snap("pellet during CHASE (push)");
tick(64, "1.0s frightened");
g.ghost_caught(0);
snap("caught blinky (+200)");
g.ghost_caught(0);
snap("caught blinky again (no-op)");
g.ghost_caught(1);
snap("caught pinky (+200)");
tick(64, "2.0s frightened");
g.ghost_arrived_at_pen(0);
snap("blinky arrived at pen");
tick(256, "6.0s: frighten expires");
tick(64, "chase resumed 1.0s");

g.power_pellet_picked_up();
snap("pellet during CHASE #2 (push)");
g.power_pellet_picked_up();
snap("pellet WHILE frightened (re-enter)");
tick(320, "5.0s of re-frighten");
tick(96, "6.5s total: expires again");

tick(1152, "chase(20s) over -> scatter");
g.power_pellet_picked_up();
snap("pellet during SCATTER (push)");
tick(416, "6.5s: expires -> scatter");
tick(320, "scatter(5s) over -> chase");

snap("final");
