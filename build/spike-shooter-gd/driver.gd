# Shooter cross-language oracle — GDScript driver. Mirrors run-oracle.mjs;
# trace lines filtered by ^\d{3}|^Q from the banner before diffing.
extends SceneTree

const DT := 1.0 / 64.0
var step_n := 0
var waves_built := 0
var ef := 0
var bsingle := 0
var bspread := 0
var bspray := 0
var g

func pad(s: String, w: int) -> String:
    return s.rpad(w) if s.length() < w else s

func build_wave(P) -> void:
    waves_built += 1
    if waves_built == 1:
        g.add_enemy(P.Enemy._create(0, 2, 0.0, 100))
        g.add_enemy(P.Enemy._create(1, 3, 0.75, 150))
    else:
        g.add_enemy(P.Enemy._create(waves_built % 3, 1, 0.0, 10))
        g.add_enemy(P.Enemy._create((waves_built + 1) % 3, 1, 0.0, 10))

func pump(n: int, P) -> void:
    for i in range(n):
        g.tick(DT)
        if g.should_spawn_wave():
            g.consume_wave()
            build_wave(P)
        if g.should_spawn_boss():
            g.consume_boss_spawn()
        for e in range(g.enemy_count()):
            var en = g.enemies[e]
            if en.wants_to_fire():
                en.consume_fire()
                ef += 1
        if g.boss.wants_to_fire_single():
            g.boss.consume_fire()
            bsingle += 1
        if g.boss.wants_to_fire_spread():
            g.boss.consume_fire()
            bspread += 1
        if g.boss.wants_to_fire_spray():
            g.boss.consume_fire()
            bspray += 1
        g.clear_dead_enemies()

func snap(label: String) -> void:
    var e0 := "-"
    var e1 := "-"
    if g.enemy_count() > 0:
        e0 = g.enemies[0].get_state()
    if g.enemy_count() > 1:
        e1 = g.enemies[1].get_state()
    print("%03d %s st=%s score=%4d lives=%d n=%d e0=%s e1=%s boss=%s bhp=%2d pl=%s fire[e=%d s=%d d=%d y=%d] waves=%d" % [
        step_n, pad(label, 30), pad(g.get_state(), 10),
        g.get_score(), g.get_lives(), g.enemy_count(),
        pad(e0, 8), pad(e1, 8), pad(g.boss.get_state(), 11), g.boss.get_hp(),
        pad(g.player.get_state(), 12), ef, bsingle, bspread, bspray, waves_built])
    step_n += 1

func run_n(n: int, label: String, P) -> void:
    pump(n, P)
    snap("pump x%d (%s)" % [n, label])

func _init() -> void:
    var P = load("res://shooter.gd")
    g = P._create()
    snap("created")
    g.start()
    snap("start -> playing")
    run_n(129, "2.0s+: wave 1 spawns", P)
    run_n(32, "0.5s: spawning -> active", P)
    g.enemy_hit(0, 1)
    snap("e0 hit 1/2 (still active)")
    g.enemy_hit(0, 1)
    snap("e0 hit 2/2 -> dying, +100")
    run_n(26, "0.4s: e0 gone + CLEANED UP", P)
    run_n(23, "e1 fire #1 (rate 0.75)", P)
    run_n(48, "e1 fire #2", P)
    g.player_hit()
    snap("player hit -> exploding")
    g.player_hit()
    snap("player hit while exploding (no-op)")
    run_n(64, "1.0s: lives-1 -> invulnerable", P)
    g.player_hit()
    snap("player hit while invuln (no-op)")
    g.pause()
    snap("pause during PLAYING (push)")
    run_n(64, "1.0s paused: everything frozen", P)
    g.resume()
    snap("resume (pop -> playing)")
    run_n(128, "2.0s: invuln over + wave 2", P)
    g.enemy_hit(0, 99)
    snap("kill the old shooter e0 (+150)")
    run_n(600, "rush: waves 3..6 spawn+decay", P)
    run_n(600, "rush: waves 7..10 -> BOSS mid-pump", P)
    snap("boss_fight (entered during rush)")
    run_n(116, "boss p1: idle(1.8s) -> firing", P)
    run_n(26, "p1 firing 0.4s -> idle (1 shot)", P)
    g.boss_hit(10)
    g.boss_hit(10)
    g.boss_hit(10)
    snap("boss 90->60 (>59.4: still P1)")
    g.boss_hit(10)
    snap("boss 60->50 <=59.4 -> PHASE 2")
    g.pause()
    snap("pause during BOSS FIGHT (push)")
    run_n(64, "1.0s paused: boss frozen", P)
    g.resume()
    snap("resume (pop -> boss_fight)")
    run_n(84, "p2: idle(1.3s) -> spread", P)
    run_n(33, "p2 spread 0.5s -> idle (1 shot)", P)
    g.boss_hit(21)
    snap("boss 50->29 <=29.7 -> PHASE 3")
    run_n(39, "p3: idle(0.6s) -> spray", P)
    run_n(52, "p3 spray 0.8s (~6 shots @0.12s)", P)
    g.boss_hit(29)
    snap("boss 29->0 in P3 -> DYING")
    run_n(200, "boss dying -> gone -> VICTORY", P)
    snap("final")

    var g2 = P._create()
    g2.start()
    for w in range(10):
        for i in range(129):
            g2.tick(DT)
        if g2.should_spawn_wave():
            g2.consume_wave()
    for i in range(65):
        g2.tick(DT)
    print("Q00 quirk: state=%s boss=%s" % [g2.get_state(), g2.boss.get_state()])
    g2.boss_hit(90)
    print("Q01 quirk: one 90-dmg hit in P1 -> boss=%s hp=%d (phase two, not dying)" % [g2.boss.get_state(), g2.boss.get_hp()])
    g2.boss_hit(1)
    print("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=%s hp=%d (phase three)" % [g2.boss.get_state(), g2.boss.get_hp()])
    g2.boss_hit(1)
    print("Q03 quirk: 1-dmg hit in P3 -> boss=%s (finally dying)" % [g2.boss.get_state()])
    quit()
