import java.util.Locale
const val DT = 1.0 / 64.0
var step = 0
var wavesBuilt = 0
var ef = 0; var bsingle = 0; var bspread = 0; var bspray = 0
lateinit var g: Shooter
fun pad(s: String, w: Int): String { val b = StringBuilder(s); while (b.length < w) b.append(' '); return b.toString() }
fun buildWave() {
    wavesBuilt++
    if (wavesBuilt == 1) { g.add_enemy(Enemy.__create(0, 2, 0.0, 100)); g.add_enemy(Enemy.__create(1, 3, 0.75, 150)) }
    else { g.add_enemy(Enemy.__create(wavesBuilt % 3, 1, 0.0, 10)); g.add_enemy(Enemy.__create((wavesBuilt + 1) % 3, 1, 0.0, 10)) }
}
fun pump(n: Int) {
    repeat(n) {
        g.tick(DT)
        if (g.should_spawn_wave()) { g.consume_wave(); buildWave() }
        if (g.should_spawn_boss()) { g.consume_boss_spawn() }
        for (e in 0 until g.enemy_count()) { val en = g.enemies[e]; if (en.wants_to_fire()) { en.consume_fire(); ef++ } }
        if (g.boss.wants_to_fire_single()) { g.boss.consume_fire(); bsingle++ }
        if (g.boss.wants_to_fire_spread()) { g.boss.consume_fire(); bspread++ }
        if (g.boss.wants_to_fire_spray())  { g.boss.consume_fire(); bspray++ }
        g.clear_dead_enemies()
    }
}
fun snap(label: String) {
    val e0 = if (g.enemy_count() > 0) g.enemies[0].get_state() else "-"
    val e1 = if (g.enemy_count() > 1) g.enemies[1].get_state() else "-"
    println(String.format(Locale.ROOT,
        "%03d %s st=%s score=%4d lives=%d n=%d e0=%s e1=%s boss=%s bhp=%2d pl=%s fire[e=%d s=%d d=%d y=%d] waves=%d",
        step, pad(label, 30), pad(g.get_state(), 10), g.get_score(), g.get_lives(), g.enemy_count(),
        pad(e0, 8), pad(e1, 8), pad(g.boss.get_state(), 11), g.boss.get_hp(), pad(g.player.get_state(), 12),
        ef, bsingle, bspread, bspray, wavesBuilt))
    step++
}
fun run(n: Int, label: String) { pump(n); snap("pump x$n ($label)") }
fun main() {
    g = Shooter.__create()
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
    val g2 = Shooter.__create(); g2.start()
    for (w in 0 until 10) { repeat(129) { g2.tick(DT) }; if (g2.should_spawn_wave()) g2.consume_wave() }
    repeat(65) { g2.tick(DT) }
    println("Q00 quirk: state=${g2.get_state()} boss=${g2.boss.get_state()}")
    g2.boss_hit(90)
    println("Q01 quirk: one 90-dmg hit in P1 -> boss=${g2.boss.get_state()} hp=${g2.boss.get_hp()} (phase two, not dying)")
    g2.boss_hit(1)
    println("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss=${g2.boss.get_state()} hp=${g2.boss.get_hp()} (phase three)")
    g2.boss_hit(1)
    println("Q03 quirk: 1-dmg hit in P3 -> boss=${g2.boss.get_state()} (finally dying)")
}
