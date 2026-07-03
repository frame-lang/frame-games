// Pac-Man cross-language oracle — Kotlin driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
import java.util.Locale

const val DT = 1.0 / 64.0
var step = 0
lateinit var g: GhostGame

fun pad(s: String, w: Int): String {
    val b = StringBuilder(s)
    while (b.length < w) b.append(' ')
    return b.toString()
}

fun snap(label: String) {
    val gs = arrayOf("-", "-", "-", "-")
    val flags = arrayOf("--", "--", "--", "--")
    val n = g.ghost_count()
    for (i in 0 until n) {
        gs[i] = g.ghost_state(i)
        flags[i] = (if (g.ghost_is_dangerous(i)) "D" else ".") + (if (g.ghost_is_edible(i)) "E" else ".")
    }
    println(String.format(Locale.ROOT,
        "%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]",
        step, pad(label, 28), pad(g.get_phase(), 10),
        g.frighten_seconds_left(), g.get_score(),
        pad(gs[0], 10), pad(gs[1], 10), pad(gs[2], 10), pad(gs[3], 10),
        flags[0], flags[1], flags[2], flags[3]))
    step++
}

fun tick(n: Int, label: String) {
    repeat(n) { g.tick(DT) }
    snap("tick x$n ($label)")
}

fun main() {
    g = GhostGame.__create()
    val names = arrayOf("blinky", "pinky", "inky", "clyde")
    val corners = arrayOf(Vector2(680.0, 40.0), Vector2(40.0, 40.0), Vector2(680.0, 440.0), Vector2(40.0, 440.0))

    snap("created")
    for (i in 0 until 4) g.add_ghost(Ghost.__create(names[i], corners[i], i))
    snap("add_ghost x4")
    g.start()
    snap("start")

    tick(64, "1.0s: pen not due")
    tick(80, "2.25s: 1st release")
    tick(128, "4.25s: 2nd release")
    tick(128, "6.25s: 3rd release")
    tick(64, "7.25s: scatter(7s) over")

    g.power_pellet_picked_up()
    snap("pellet during CHASE (push)")
    tick(64, "1.0s frightened")
    g.ghost_caught(0)
    snap("caught blinky (+200)")
    g.ghost_caught(0)
    snap("caught blinky again (no-op)")
    g.ghost_caught(1)
    snap("caught pinky (+200)")
    tick(64, "2.0s frightened")
    g.ghost_arrived_at_pen(0)
    snap("blinky arrived at pen")
    tick(256, "6.0s: frighten expires")
    tick(64, "chase resumed 1.0s")

    g.power_pellet_picked_up()
    snap("pellet during CHASE #2 (push)")
    g.power_pellet_picked_up()
    snap("pellet WHILE frightened (re-enter)")
    tick(320, "5.0s of re-frighten")
    tick(96, "6.5s total: expires again")

    tick(1152, "chase(20s) over -> scatter")
    g.power_pellet_picked_up()
    snap("pellet during SCATTER (push)")
    tick(416, "6.5s: expires -> scatter")
    tick(320, "scatter(5s) over -> chase")

    snap("final")
}
