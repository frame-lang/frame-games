// The Breakout cross-language oracle — JS side.
//
// Same contract as the other games' oracles: a canonical scenario against the
// JS baseline, one line per step; the committed output (expected-trace.txt) is
// the byte-exact behavioral contract for every other language port. dt = 1/64.
//
// What this scenario exercises that the earlier five games couldn't:
//   - ENTER-ARGUMENTS threaded through a transition. Ball.launch does
//     `-> (vx, vy) $InFlight`, carrying the velocity into $InFlight's
//     `$>(vx, vy)` handler which seeds the state-local $.vx/$.vy. No earlier
//     game passed values INTO a state on entry — this is the compartment
//     enter-arg marshalling path, per backend.
//   - A Ball sub-machine with a self-driven respawn timer ($Lost, 2.0s) that
//     the orchestrator neither ticks nor knows about beyond a progress query.
//   - A BrickField list + the $Playing -> $LevelClear transition on clear.
//
// Floats (ball velocity, respawn progress) are printed as scaled INTEGERS
// (x1000) so no float formatting crosses the language boundary. Launch
// velocities are exactly-representable binary fractions (3.5, -4.25).
//
// Usage: node games/breakout/oracle/run-oracle.mjs > games/breakout/oracle/expected-trace.txt
import { Breakout } from "./breakout";

const DT = 1 / 64;
let step = 0;
const g = Breakout._create();

const m = (x) => Math.round(x * 1000); // float -> milliunits integer
function pad(s, w) { s = String(s); while (s.length < w) s += " "; return s; }
function lpad(s, w) { s = String(s); while (s.length < w) s = " " + s; return s; }
function snap(label) {
  // ball_respawn_progress() is only defined in $Playing; in other states it is
  // an unhandled interface method whose default return is backend-dependent —
  // so only query it (and print rp) when the game is in $Playing.
  const rp = g.get_state() === "playing" ? lpad(m(g.ball_respawn_progress()), 4) : lpad("-", 4);
  console.log(
    `${String(step).padStart(3, "0")} ${pad(label, 34)} ` +
      `st=${pad(g.get_state(), 11)} sc=${lpad(g.get_score(), 4)} lv=${g.get_lives()} lvl=${g.get_level()} br=${lpad(g.bricks_remaining(), 2)} | ` +
      `ball=${pad(g.ball_state(), 9)} vx=${lpad(m(g.ball_vx()), 6)} vy=${lpad(m(g.ball_vy()), 6)} rp=${rp}`,
  );
  step++;
}
function run(n, label) {
  for (let i = 0; i < n; i++) g.tick(DT);
  snap(`pump x${n} (${label})`);
}

// ---- the canonical scenario ----
snap("created");
g.start();
snap("start -> playing, ball attached");
console.log(`OP  get_current_state_name=${g.get_current_state_name()}`);

// ENTER-ARG showcase: launch(vx,vy) -> (vx,vy) $InFlight seeds $.vx/$.vy
g.launch_ball(3.5, -4.25);
snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
g.wall_bounce_x();
snap("wall_bounce_x -> vx negated");
g.wall_bounce_y();
snap("wall_bounce_y -> vy negated");
g.paddle_hit(2.75, -5.5);
snap("paddle_hit -> set_velocity(2.75,-5.5)");

// break bricks: score + bounce_y each; dedup + oob are no-ops
g.brick_hit(0);
snap("brick_hit(0): +10, vy flip, broken");
g.brick_hit(0);
g.brick_hit(999);
g.brick_hit(-1);
snap("brick_hit dead/oob: NO score change");
g.brick_hit(1);
g.brick_hit(2);
snap("brick_hit(1,2): +20");

// pause push$/pop$ from $Playing
g.pause();
snap("pause during PLAYING (push)");
run(64, "1.0s paused: ball frozen");
g.resume();
snap("resume (pop -> playing)");

// ball falls off -> lose a life, ball -> $Lost (self-respawn timer)
g.ball_fell_off();
snap("ball_fell_off -> lives-1, ball lost");
run(64, "1.0s: respawn progress ~0.5");
run(63, "just before 2.0s: still lost");
run(1, "tick 2.0s: ball -> attached");

// re-launch, then clear the wall -> $LevelClear (level 2)
g.launch_ball(3.5, -4.25);
snap("re-launch (fresh in_flight)");
for (let i = 3; i < 40; i++) g.brick_hit(i);
snap("cleared wall -> level_clear (lvl 2)");
g.start();
snap("start -> playing, fresh wall of 40");

// drain the remaining 2 lives -> $GameOver
g.ball_fell_off();
snap("fell off -> lives 1");
g.ball_fell_off();
snap("fell off -> lives 0 -> game_over");
g.restart();
snap("restart -> attract (reset)");

// --- secondary: pause from during the $Lost respawn window survives ---
const g2 = Breakout._create();
g2.start();
g2.launch_ball(1.0, -1.0);
g2.ball_fell_off();            // ball -> lost, lives 2
for (let i = 0; i < 32; i++) g2.tick(DT);
const rpBefore = Math.round(g2.ball_respawn_progress() * 1000);
g2.pause();
for (let i = 0; i < 128; i++) g2.tick(DT);   // paused: Breakout doesn't tick the ball
g2.resume();
const rpAfter = Math.round(g2.ball_respawn_progress() * 1000);
console.log(`PAUSE respawn frozen: before=${rpBefore} after=${rpAfter} ball=${g2.ball_state()} (paused ticks must not advance the ball)`);

// --- secondary: is_brick_broken semantics (oob reads as broken=true) ---
const g3 = Breakout._create();
g3.start();
console.log(`BRICK is_broken: fresh0=${g3.is_brick_broken(0)} oobNeg=${g3.is_brick_broken(-1)} oobBig=${g3.is_brick_broken(999)} (expect false, true, true)`);
