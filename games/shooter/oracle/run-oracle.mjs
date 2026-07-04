// The Shooter cross-language oracle — JS side.
//
// Same contract as games/pacman/oracle: runs a canonical scenario against the
// JS baseline and prints one line per step; the committed output
// (expected-trace.txt) is the byte-exact behavioral contract for every other
// language port. dt = 1/64 keeps timer math bit-identical across languages.
//
// What this scenario exercises that Pac-Man's couldn't:
//   - DYNAMIC instance lifecycle: enemies are constructed by the driver on
//     should_spawn_wave(), run $Spawning(0.5s) -> $Active -> $Dying(0.4s) ->
//     $Gone, and are then DESTROYED by clear_dead_enemies() (the runtime's
//     teardown path — list splice of live compartment sets).
//   - Per-instance state-var machinery under load: fire-rate accumulators on
//     enemies, one-shot $.fired latches on boss attack leaves.
//   - The three-phase Boss HSM: phase parents own hit()/thresholds
//     (90 -> <=59.4 -> phase 2 -> <=29.7 -> phase 3 -> <=0 -> dying), leaves
//     run idle/fire attack cycles ($P1Idle 1.8s / $P1Firing 0.4s single;
//     $P2Idle 1.3s / $P2Spread 0.5s; $P3Idle 0.6s / $P3Spray 0.8s with a
//     0.12s spray accumulator).
//   - Pause as a push$/pop$ interrupt from BOTH combat states; $Paused does
//     not tick children, so every entity's timers freeze and resume exactly.
//   - The player damage loop: Alive -> Exploding(1.0s, then lives-1) ->
//     Invulnerable(2.0s) -> Alive, with can_be_hit() gating no-op hits.
//
// The pump() mirrors the scene's per-frame contract: tick, then honor the
// FSM's spawn/fire signals (consume_wave -> construct enemies; consume_boss;
// count every consumed fire signal into cumulative counters), then cleanup.
//
// Usage: node games/shooter/oracle/run-oracle.mjs > games/shooter/oracle/expected-trace.txt
import { Shooter, Enemy } from "../src/shooter.machine.js";

const DT = 1 / 64;
const g = Shooter._create();

let step = 0;
let wavesBuilt = 0;
// cumulative consumed-fire counters (enemy, boss single/spread/spray)
let ef = 0, bsingle = 0, bspread = 0, bspray = 0;

function buildWave() {
  wavesBuilt++;
  // Deterministic wave contents. Wave 1 carries the designated shooter
  // (fire_rate 0.75) we watch fire; later waves are silent 10-pointers so the
  // rush to the boss keeps score arithmetic legible.
  if (wavesBuilt === 1) {
    g.add_enemy(Enemy._create(0, 2, 0.0, 100));
    g.add_enemy(Enemy._create(1, 3, 0.75, 150));
  } else {
    g.add_enemy(Enemy._create(wavesBuilt % 3, 1, 0.0, 10));
    g.add_enemy(Enemy._create((wavesBuilt + 1) % 3, 1, 0.0, 10));
  }
}

function pump(n) {
  for (let i = 0; i < n; i++) {
    g.tick(DT);
    if (g.should_spawn_wave()) {
      g.consume_wave();
      buildWave();
    }
    if (g.should_spawn_boss()) {
      g.consume_boss_spawn();
    }
    // fire signals — consume and count (the scene would spawn bullets here)
    for (let e = 0; e < g.enemy_count(); e++) {
      const en = g.enemies[e];
      if (en.wants_to_fire()) { en.consume_fire(); ef++; }
    }
    if (g.boss.wants_to_fire_single()) { g.boss.consume_fire(); bsingle++; }
    if (g.boss.wants_to_fire_spread()) { g.boss.consume_fire(); bspread++; }
    if (g.boss.wants_to_fire_spray())  { g.boss.consume_fire(); bspray++; }
    g.clear_dead_enemies();
  }
}

function snap(label) {
  const e0 = g.enemy_count() > 0 ? g.enemies[0].get_state() : "-";
  const e1 = g.enemy_count() > 1 ? g.enemies[1].get_state() : "-";
  console.log(
    `${String(step).padStart(3, "0")} ${label.padEnd(30)} st=${g.get_state().padEnd(10)} ` +
      `score=${String(g.get_score()).padStart(4)} lives=${g.get_lives()} n=${g.enemy_count()} ` +
      `e0=${e0.padEnd(8)} e1=${e1.padEnd(8)} ` +
      `boss=${g.boss.get_state().padEnd(11)} bhp=${String(g.boss.get_hp()).padStart(2)} ` +
      `pl=${g.player.get_state().padEnd(12)} fire[e=${ef} s=${bsingle} d=${bspread} y=${bspray}] ` +
      `waves=${wavesBuilt}`,
  );
  step++;
}
function run(n, label) {
  pump(n);
  snap(`pump x${n} (${label})`);
}

// ---- the canonical scenario ----
snap("created");
g.start();
snap("start -> playing");

run(129, "2.0s+: wave 1 spawns");           // wave at wave_timer>=2.0
run(32, "0.5s: spawning -> active");
g.enemy_hit(0, 1);
snap("e0 hit 1/2 (still active)");
g.enemy_hit(0, 1);
snap("e0 hit 2/2 -> dying, +100");
run(26, "0.4s: e0 gone + CLEANED UP");      // dying 0.4s -> gone -> splice
run(23, "e1 fire #1 (rate 0.75)");          // fire_timer crosses 0.75
run(48, "e1 fire #2");

g.player_hit();
snap("player hit -> exploding");
g.player_hit();
snap("player hit while exploding (no-op)");
run(64, "1.0s: lives-1 -> invulnerable");
g.player_hit();
snap("player hit while invuln (no-op)");

g.pause();
snap("pause during PLAYING (push)");
run(64, "1.0s paused: everything frozen");
g.resume();
snap("resume (pop -> playing)");
run(128, "2.0s: invuln over + wave 2");

g.enemy_hit(0, 99);
snap("kill the old shooter e0 (+150)");
run(600, "rush: waves 3..6 spawn+decay");
run(600, "rush: waves 7..10 -> BOSS mid-pump");
snap("boss_fight (entered during rush)");

run(116, "boss p1: idle(1.8s) -> firing");
run(26, "p1 firing 0.4s -> idle (1 shot)");
g.boss_hit(10); g.boss_hit(10); g.boss_hit(10);
snap("boss 90->60 (>59.4: still P1)");
g.boss_hit(10);
snap("boss 60->50 <=59.4 -> PHASE 2");

g.pause();
snap("pause during BOSS FIGHT (push)");
run(64, "1.0s paused: boss frozen");
g.resume();
snap("resume (pop -> boss_fight)");

run(84, "p2: idle(1.3s) -> spread");
run(33, "p2 spread 0.5s -> idle (1 shot)");
g.boss_hit(21);
snap("boss 50->29 <=29.7 -> PHASE 3");

run(39, "p3: idle(0.6s) -> spray");
run(52, "p3 spray 0.8s (~6 shots @0.12s)");
g.boss_hit(29);
snap("boss 29->0 in P3 -> DYING");
run(200, "boss dying -> gone -> VICTORY");

snap("final");

// --- pinned quirk: threshold order swallows the death check ---
// A hit in PhaseOne/PhaseTwo that lands at <=0 transitions to the NEXT PHASE
// (the phase-threshold branch runs first), leaving an undying 0-HP boss until
// something hits it again IN phase 3. The trace pins this canonical behavior;
// it mirrors the Godot ch07 reference exactly.
const g2 = Shooter._create();
g2.start();
// drive straight to boss: 10 waves x 2.0s = 128 ticks each, no enemies added
for (let w = 0; w < 10; w++) { for (let i = 0; i < 129; i++) { g2.tick(DT); } if (g2.should_spawn_wave()) g2.consume_wave(); }
for (let i = 0; i < 65; i++) { g2.tick(DT); }
console.log(`Q00 quirk: state=${g2.get_state()} boss=${g2.boss.get_state()}`);
g2.boss_hit(90);
console.log(`Q01 quirk: one 90-dmg hit in P1 -> boss=${g2.boss.get_state()} hp=${g2.boss.get_hp()} (phase two, not dying)`);
g2.boss_hit(1);
console.log(`Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=${g2.boss.get_state()} hp=${g2.boss.get_hp()} (phase three)`);
g2.boss_hit(1);
console.log(`Q03 quirk: 1-dmg hit in P3 -> boss=${g2.boss.get_state()} (finally dying)`);
