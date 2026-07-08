// The Space Invaders cross-language oracle — JS side.
//
// Same contract as the other games' oracles: run a canonical scenario against
// the JS baseline and print one line per step; the committed output
// (expected-trace.txt) is the byte-exact behavioral contract for every other
// language port. dt = 1/64 keeps timer math bit-identical across languages.
//
// What this scenario exercises that the earlier games couldn't:
//   - ORCHESTRATOR-AS-HSM: Invaders' $InGame is a PARENT state; $Playing,
//     $PlayerDying and $WaveComplete are its children and inherit its pause()
//     handler via => $^. The scenario pauses (push$ -> $Paused) from ALL THREE
//     children and resumes (pop$) — each must return to the EXACT child it
//     interrupted. No earlier game put the HSM at the orchestrator level.
//   - A Fleet marching a 5x11 formation: $Marching -> $Stepping (flips
//     direction on entry) -> $Marching, and $Defeated when cleared. Its
//     step_interval speeds up with the surviving fraction — step_interval =
//     min + (initial-min)*(live/total). That `live/total` is int/int: the
//     strict-numeric backends must force float division or the pace diverges.
//     We print step_interval scaled to integer microseconds to catch it (and
//     to avoid float formatting crossing the language boundary).
//   - The wave cycle: clear the fleet -> $WaveComplete -> wave_pause -> wave+1,
//     fleet reset, back to $Playing.
//   - The player damage loop feeding the orchestrator: $Playing -player_hit->
//     $PlayerDying; when the player becomes invulnerable the orchestrator
//     returns to $Playing, when dead it goes to $GameOver.
//
// Usage: node games/invaders/oracle/run-oracle.mjs > games/invaders/oracle/expected-trace.txt
import { Invaders } from "./invaders";

const DT = 1 / 64;
let step = 0;
const g = Invaders._create();

// step_interval as integer microseconds — deterministic across languages
// (IEEE-754 double division is correctly-rounded everywhere) and it surfaces
// any accidental int-division in a strict-numeric port.
function ivus() {
  return Math.round(g.fleet.get_step_interval() * 1e6);
}
function pad(s, w) {
  s = String(s);
  while (s.length < w) s += " ";
  return s;
}
function lpad(s, w) {
  s = String(s);
  while (s.length < w) s = " " + s;
  return s;
}
function snap(label) {
  const fl = g.fleet;
  console.log(
    `${String(step).padStart(3, "0")} ${pad(label, 34)} ` +
      `st=${pad(g.get_state(), 13)} sc=${lpad(g.get_score(), 4)} wv=${g.get_wave()} lv=${g.get_lives()} | ` +
      `fl=${pad(fl.get_state(), 9)} dir=${lpad(fl.get_direction(), 2)} al=${lpad(fl.alive_count(), 2)}/${lpad(fl.total(), 2)} ` +
      `iv=${lpad(ivus(), 6)} lr=${lpad(fl.lowest_row(), 2)} | ` +
      `pl=${pad(g.player.get_state(), 12)} pz=${g.is_paused() ? 1 : 0}`,
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
snap("start -> playing (fleet 55, iv=600000)");
console.log(`OP  get_current_state_name=${g.get_current_state_name()}`);

// fleet marching timer crosses step_interval (0.6s = 38.4 ticks)
run(39, "0.61s: fleet wants_to_step");
console.log(`SIG consume_step=${g.fleet.consume_step()} (timer was >= interval)`);

// kill the three top-left invaders — score + pace speed-up (iv drops)
g.player_killed_invader(0);
snap("kill idx0 (+10, pace up)");
g.player_killed_invader(1);
g.player_killed_invader(2);
snap("kill idx1,2 (+20 more)");
// killing an already-dead / out-of-range index is a no-op (no score)
g.player_killed_invader(1);
g.player_killed_invader(999);
g.player_killed_invader(-1);
snap("kill dead/oob idx: NO score change");

// fleet hits the wall -> $Stepping flips direction, next tick -> $Marching
g.fleet_reached_edge();
snap("fleet_reached_edge -> stepping, dir flip");
run(1, "one tick: stepping -> marching");

// pause from $Playing (inherited $InGame handler), resume pops back to $Playing
g.pause();
snap("pause during PLAYING (push)");
run(64, "1.0s paused: fleet+player frozen");
g.resume();
snap("resume (pop -> playing)");

// clear the rest of the fleet -> orchestrator $WaveComplete, fleet $Defeated
for (let i = 3; i < 55; i++) g.player_killed_invader(i);
snap("cleared fleet -> wave_complete");

// pause from $WaveComplete (inherited), resume pops back to $WaveComplete
g.pause();
snap("pause during WAVE_COMPLETE (push)");
run(64, "1.0s paused: wave timer frozen");
g.resume();
snap("resume (pop -> wave_complete)");

// wave_pause 2.0s (128 ticks) -> wave 2, fleet reset, back to $Playing
run(129, "2.0s: wave 2 begins, fleet reset");

// player hit -> $PlayerDying (player exploding)
g.player_hit();
snap("player_hit -> player_dying");
// hit while exploding is a no-op (can_be_hit false)
g.player_hit();
snap("player_hit while exploding: NO-OP");

// pause from $PlayerDying (inherited), resume pops back to $PlayerDying
g.pause();
snap("pause during PLAYER_DYING (push)");
run(64, "1.0s paused: explosion timer frozen");
g.resume();
snap("resume (pop -> player_dying)");

// exploding 1.2s (76.8 -> 77 ticks): lives-1, invulnerable, orchestrator -> $Playing
run(77, "1.2s: lives-1, invuln, -> playing");
// invulnerable 1.5s -> alive
run(96, "1.5s: invuln over -> alive");

// fleet reaches the bottom from $Playing -> $GameOver
g.fleet_reached_bottom();
snap("fleet_reached_bottom -> game_over");
g.restart();
snap("restart -> attract (reset)");

// --- secondary: player runs out of lives -> $GameOver via $PlayerDying ---
const g2 = Invaders._create();
g2.start();
// drain all 3 lives. Each hit -> exploding 1.2s -> lives-1 -> invulnerable 1.5s.
// Must wait out BOTH (can't be hit while exploding OR invulnerable) before the
// next hit lands; the 3rd completion (lives 0) -> $Dead -> $GameOver.
for (let life = 0; life < 3; life++) {
  g2.player_hit();
  for (let i = 0; i < 180; i++) g2.tick(DT); // exploding(77) + invuln(96) + margin
}
console.log(`DEATH after 3 hits: st=${g2.get_state()} lives=${g2.get_lives()} player=${g2.player.get_state()}`);

// --- secondary: fleet direction after two edge bounces returns to +1 ---
const g3 = Invaders._create();
g3.start();
const d0 = g3.fleet.get_direction();
g3.fleet_reached_edge(); g3.tick(DT);
const d1 = g3.fleet.get_direction();
g3.fleet_reached_edge(); g3.tick(DT);
const d2 = g3.fleet.get_direction();
console.log(`DIR bounces: start=${d0} after1=${d1} after2=${d2}`);
