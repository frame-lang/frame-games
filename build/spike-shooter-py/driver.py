# Shooter cross-language oracle — Python driver. Mirrors run-oracle.mjs.
from shooter import Shooter, Enemy

DT = 1.0 / 64.0
g = Shooter._create()
step = 0
wavesBuilt = 0
ef = bsingle = bspread = bspray = 0

def build_wave():
    global wavesBuilt
    wavesBuilt += 1
    if wavesBuilt == 1:
        g.add_enemy(Enemy._create(0, 2, 0.0, 100))
        g.add_enemy(Enemy._create(1, 3, 0.75, 150))
    else:
        g.add_enemy(Enemy._create(wavesBuilt % 3, 1, 0.0, 10))
        g.add_enemy(Enemy._create((wavesBuilt + 1) % 3, 1, 0.0, 10))

def pump(n):
    global ef, bsingle, bspread, bspray
    for _ in range(n):
        g.tick(DT)
        if g.should_spawn_wave():
            g.consume_wave(); build_wave()
        if g.should_spawn_boss():
            g.consume_boss_spawn()
        for e in range(g.enemy_count()):
            en = g.enemies[e]
            if en.wants_to_fire():
                en.consume_fire(); ef += 1
        if g.boss.wants_to_fire_single(): g.boss.consume_fire(); bsingle += 1
        if g.boss.wants_to_fire_spread(): g.boss.consume_fire(); bspread += 1
        if g.boss.wants_to_fire_spray():  g.boss.consume_fire(); bspray += 1
        g.clear_dead_enemies()

def snap(label):
    global step
    e0 = g.enemies[0].get_state() if g.enemy_count() > 0 else "-"
    e1 = g.enemies[1].get_state() if g.enemy_count() > 1 else "-"
    print(f"{step:03d} {label.ljust(30)} st={g.get_state().ljust(10)} "
          f"score={g.get_score():4d} lives={g.get_lives()} n={g.enemy_count()} "
          f"e0={e0.ljust(8)} e1={e1.ljust(8)} "
          f"boss={g.boss.get_state().ljust(11)} bhp={g.boss.get_hp():2d} "
          f"pl={g.player.get_state().ljust(12)} fire[e={ef} s={bsingle} d={bspread} y={bspray}] "
          f"waves={wavesBuilt}")
    step += 1

def run(n, label):
    pump(n); snap(f"pump x{n} ({label})")

snap("created"); g.start(); snap("start -> playing")
run(129, "2.0s+: wave 1 spawns"); run(32, "0.5s: spawning -> active")
g.enemy_hit(0, 1); snap("e0 hit 1/2 (still active)")
g.enemy_hit(0, 1); snap("e0 hit 2/2 -> dying, +100")
run(26, "0.4s: e0 gone + CLEANED UP"); run(23, "e1 fire #1 (rate 0.75)"); run(48, "e1 fire #2")
g.player_hit(); snap("player hit -> exploding")
g.player_hit(); snap("player hit while exploding (no-op)")
run(64, "1.0s: lives-1 -> invulnerable")
g.player_hit(); snap("player hit while invuln (no-op)")
g.pause(); snap("pause during PLAYING (push)")
run(64, "1.0s paused: everything frozen")
g.resume(); snap("resume (pop -> playing)")
run(128, "2.0s: invuln over + wave 2")
g.enemy_hit(0, 99); snap("kill the old shooter e0 (+150)")
run(600, "rush: waves 3..6 spawn+decay"); run(600, "rush: waves 7..10 -> BOSS mid-pump")
snap("boss_fight (entered during rush)")
run(116, "boss p1: idle(1.8s) -> firing"); run(26, "p1 firing 0.4s -> idle (1 shot)")
g.boss_hit(10); g.boss_hit(10); g.boss_hit(10); snap("boss 90->60 (>59.4: still P1)")
g.boss_hit(10); snap("boss 60->50 <=59.4 -> PHASE 2")
g.pause(); snap("pause during BOSS FIGHT (push)")
run(64, "1.0s paused: boss frozen")
g.resume(); snap("resume (pop -> boss_fight)")
run(84, "p2: idle(1.3s) -> spread"); run(33, "p2 spread 0.5s -> idle (1 shot)")
g.boss_hit(21); snap("boss 50->29 <=29.7 -> PHASE 3")
run(39, "p3: idle(0.6s) -> spray"); run(52, "p3 spray 0.8s (~6 shots @0.12s)")
g.boss_hit(29); snap("boss 29->0 in P3 -> DYING")
run(200, "boss dying -> gone -> VICTORY")
snap("final")

g2 = Shooter._create()
g2.start()
for w in range(10):
    for _ in range(129):
        g2.tick(DT)
    if g2.should_spawn_wave():
        g2.consume_wave()
for _ in range(65):
    g2.tick(DT)
print(f"Q00 quirk: state={g2.get_state()} boss={g2.boss.get_state()}")
g2.boss_hit(90)
print(f"Q01 quirk: one 90-dmg hit in P1 -> boss={g2.boss.get_state()} hp={g2.boss.get_hp()} (phase two, not dying)")
g2.boss_hit(1)
print(f"Q02 quirk: 1-dmg hit in P2 at 0hp -> boss={g2.boss.get_state()} hp={g2.boss.get_hp()} (phase three)")
g2.boss_hit(1)
print(f"Q03 quirk: 1-dmg hit in P3 -> boss={g2.boss.get_state()} (finally dying)")
