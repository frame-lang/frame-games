import java.util.Locale

const val DT = 1.0 / 64.0
var step = 0
lateinit var g: Invaders

fun ivus(): Long = Math.round(g.fleet.get_step_interval() * 1e6)
fun pad(s: String, w: Int): String { val b = StringBuilder(s); while (b.length < w) b.append(' '); return b.toString() }
fun lpad(o: Any, w: Int): String { val s = o.toString(); val b = StringBuilder(); var i = s.length; while (i < w) { b.append(' '); i++ }; return b.toString() + s }
fun snap(label: String) {
    val fl = g.fleet
    println(String.format(Locale.ROOT,
        "%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d",
        step, pad(label, 34), pad(g.get_state(), 13), lpad(g.get_score(), 4), g.get_wave(), g.get_lives(),
        pad(fl.get_state(), 9), lpad(fl.get_direction(), 2), lpad(fl.alive_count(), 2), lpad(fl.total(), 2),
        lpad(ivus(), 6), lpad(fl.lowest_row(), 2), pad(g.player.get_state(), 12), if (g.is_paused()) 1 else 0))
    step++
}
fun run(n: Int, label: String) { for (i in 0 until n) g.tick(DT); snap(String.format(Locale.ROOT, "pump x%d (%s)", n, label)) }

fun main() {
    g = Invaders()
    snap("created")
    g.start()
    snap("start -> playing (fleet 55, iv=600000)")
    println("OP  get_current_state_name=" + g.get_current_state_name())

    run(39, "0.61s: fleet wants_to_step")
    println("SIG consume_step=" + (if (g.fleet.consume_step()) "true" else "false") + " (timer was >= interval)")

    g.player_killed_invader(0)
    snap("kill idx0 (+10, pace up)")
    g.player_killed_invader(1)
    g.player_killed_invader(2)
    snap("kill idx1,2 (+20 more)")
    g.player_killed_invader(1)
    g.player_killed_invader(999)
    g.player_killed_invader(-1)
    snap("kill dead/oob idx: NO score change")

    g.fleet_reached_edge()
    snap("fleet_reached_edge -> stepping, dir flip")
    run(1, "one tick: stepping -> marching")

    g.pause()
    snap("pause during PLAYING (push)")
    run(64, "1.0s paused: fleet+player frozen")
    g.resume()
    snap("resume (pop -> playing)")

    for (i in 3 until 55) g.player_killed_invader(i)
    snap("cleared fleet -> wave_complete")

    g.pause()
    snap("pause during WAVE_COMPLETE (push)")
    run(64, "1.0s paused: wave timer frozen")
    g.resume()
    snap("resume (pop -> wave_complete)")

    run(129, "2.0s: wave 2 begins, fleet reset")

    g.player_hit()
    snap("player_hit -> player_dying")
    g.player_hit()
    snap("player_hit while exploding: NO-OP")

    g.pause()
    snap("pause during PLAYER_DYING (push)")
    run(64, "1.0s paused: explosion timer frozen")
    g.resume()
    snap("resume (pop -> player_dying)")

    run(77, "1.2s: lives-1, invuln, -> playing")
    run(96, "1.5s: invuln over -> alive")

    g.fleet_reached_bottom()
    snap("fleet_reached_bottom -> game_over")
    g.restart()
    snap("restart -> attract (reset)")

    val g2 = Invaders()
    g2.start()
    for (life in 0 until 3) { g2.player_hit(); for (i in 0 until 180) g2.tick(DT) }
    println(String.format(Locale.ROOT, "DEATH after 3 hits: st=%s lives=%d player=%s", g2.get_state(), g2.get_lives(), g2.player.get_state()))

    val g3 = Invaders()
    g3.start()
    val d0 = g3.fleet.get_direction()
    g3.fleet_reached_edge(); g3.tick(DT)
    val d1 = g3.fleet.get_direction()
    g3.fleet_reached_edge(); g3.tick(DT)
    val d2 = g3.fleet.get_direction()
    println(String.format(Locale.ROOT, "DIR bounces: start=%d after1=%d after2=%d", d0, d1, d2))
}
