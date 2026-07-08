import java.util.Locale
const val DT = 1.0 / 64.0
var step = 0
lateinit var g: Breakout
fun mU(x: Double): Long = Math.round(x * 1000)
fun padr(s: String, w: Int): String { val b = StringBuilder(s); while (b.length < w) b.append(' '); return b.toString() }
fun padl(o: Any, w: Int): String { val s = o.toString(); val b = StringBuilder(); var i = s.length; while (i < w) { b.append(' '); i++ }; return b.toString() + s }
fun snap(label: String) {
    val rp = if (g.get_state() == "playing") padl(mU(g.ball_respawn_progress()), 4) else padl("-", 4)
    println(String.format(Locale.ROOT, "%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s",
        step, padr(label,34), padr(g.get_state(),11), padl(g.get_score(),4), g.get_lives(), g.get_level(),
        padl(g.bricks_remaining(),2), padr(g.ball_state(),9), padl(mU(g.ball_vx()),6), padl(mU(g.ball_vy()),6), rp))
    step++
}
fun run(n: Int, label: String) { for (i in 0 until n) g.tick(DT); snap(String.format(Locale.ROOT,"pump x%d (%s)",n,label)) }
fun main() {
    g = Breakout.__create()
    snap("created"); g.start(); snap("start -> playing, ball attached")
    println("OP  get_current_state_name=" + g.get_current_state_name())
    g.launch_ball(3.5, -4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]")
    g.wall_bounce_x(); snap("wall_bounce_x -> vx negated")
    g.wall_bounce_y(); snap("wall_bounce_y -> vy negated")
    g.paddle_hit(2.75, -5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)")
    g.brick_hit(0); snap("brick_hit(0): +10, vy flip, broken")
    g.brick_hit(0); g.brick_hit(999); g.brick_hit(-1); snap("brick_hit dead/oob: NO score change")
    g.brick_hit(1); g.brick_hit(2); snap("brick_hit(1,2): +20")
    g.pause(); snap("pause during PLAYING (push)"); run(64, "1.0s paused: ball frozen"); g.resume(); snap("resume (pop -> playing)")
    g.ball_fell_off(); snap("ball_fell_off -> lives-1, ball lost")
    run(64, "1.0s: respawn progress ~0.5"); run(63, "just before 2.0s: still lost"); run(1, "tick 2.0s: ball -> attached")
    g.launch_ball(3.5, -4.25); snap("re-launch (fresh in_flight)")
    for (i in 3 until 40) g.brick_hit(i); snap("cleared wall -> level_clear (lvl 2)")
    g.start(); snap("start -> playing, fresh wall of 40")
    g.ball_fell_off(); snap("fell off -> lives 1"); g.ball_fell_off(); snap("fell off -> lives 0 -> game_over")
    g.restart(); snap("restart -> attract (reset)")
    val g2 = Breakout.__create(); g2.start(); g2.launch_ball(1.0,-1.0); g2.ball_fell_off()
    for (i in 0 until 32) g2.tick(DT); val rpb = mU(g2.ball_respawn_progress()); g2.pause()
    for (i in 0 until 128) g2.tick(DT); g2.resume(); val rpa = mU(g2.ball_respawn_progress())
    println(String.format(Locale.ROOT,"PAUSE respawn frozen: before=%d after=%d ball=%s (paused ticks must not advance the ball)", rpb, rpa, g2.ball_state()))
    val g3 = Breakout.__create(); g3.start()
    println(String.format(Locale.ROOT,"BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)", g3.is_brick_broken(0), g3.is_brick_broken(-1), g3.is_brick_broken(999)))
}
