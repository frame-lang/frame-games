// Stealth cross-language oracle — Kotlin driver. Mirrors run-oracle.mjs.
import java.util.Locale

const val DT = 1.0 / 64.0
var step = 0
lateinit var g: Stealth
val FAR = Vector2(500.0, 500.0)
var pos1 = FAR
var pos2 = FAR
var pos3 = FAR

fun P(x: Double, y: Double) = Vector2(x, y)
fun route(vararg v: Vector2): MutableList<Vector2> = v.toMutableList()
fun pad(s: String, w: Int): String {
    val b = StringBuilder(s); while (b.length < w) b.append(' '); return b.toString()
}
fun flags(gd: Guard) = "" + (if (gd.is_aware()) 1 else 0) + (if (gd.is_alerted()) 1 else 0) + (if (gd.should_move()) 1 else 0)
fun gcol(gd: Guard): String {
    val t = gd.get_target()
    return String.format(Locale.ROOT, "%s/%s tgt=(%d,%d)", gd.get_state(), flags(gd), Math.round(t.x), Math.round(t.y))
}
fun snapOf(m: Stealth, label: String, tag: String) {
    println(String.format(Locale.ROOT, "%s%03d %s st=%s t=%4d by=%2d | g1=%s | g2=%s | g3=%s",
        tag, step, pad(label, 38), pad(m.get_state(), 8),
        Math.round(m.get_elapsed() * 64), m.get_caught_by(),
        pad(gcol(m.guard1), 28), pad(gcol(m.guard2), 28), pad(gcol(m.guard3), 28)))
    step++
}
fun snap(label: String) = snapOf(g, label, "")
fun pump(n: Int) { for (i in 0 until n) g.tick(DT, pos1, pos2, pos3) }
fun run(n: Int, label: String) { pump(n); snap(String.format(Locale.ROOT, "pump x%d (%s)", n, label)) }

fun main() {
    val P1 = route(P(0.0, 0.0), P(64.0, 0.0), P(64.0, 64.0))
    val P2 = route(P(0.0, 0.0), P(96.0, 0.0))
    val P3 = route(P(0.0, 0.0), P(96.0, 96.0))
    g = Stealth()

    snap("created (guards idle)")
    g.start(P1, P2, P3)
    snap("start -> playing, guards patrol wp0")
    println("OP  get_current_state_name=" + g.get_current_state_name())

    run(32, "0.5s: nobody arrives (FAR)")
    pos1 = P(1.0, 1.0); run(1, "g1 arrives wp0 -> tgt wp1")
    pos1 = P(63.0, 1.0); run(1, "g1 arrives wp1 -> tgt wp2")
    pos1 = P(63.0, 63.0); run(1, "g1 arrives wp2 -> WRAP tgt wp0")
    pos1 = FAR

    g.guard1.hear_sound(P(50.0, 50.0))
    g.guard2.hear_sound(P(10.0, 90.0))
    snap("g1+g2 hear_sound -> investigating")
    run(95, "1.484s: both still investigating")
    run(1, "tick 96 = 1.5s: both pop\$ -> patrol")

    g.guard3.spot_player(P(80.0, 80.0))
    snap("g3 spotted (patrolling->alerted)")
    g.guard3.hear_sound(P(5.0, 5.0))
    snap("g3 hear_sound while alerted: NO-OP")

    run(200, "3.125s chasing (far, no arrive)")
    g.guard3.spot_player(P(80.0, 80.0))
    snap("re-spot at 3.125s: chase timer RESET")
    run(200, "3.125s more: still alerted (reset)")
    run(56, "chase clock hits 4.0s -> searching")
    pos3 = P(90.0, 90.0); run(192, "3.0s search over -> NEAREST wp1")
    pos3 = FAR

    g.guard1.hear_sound(P(50.0, 50.0))
    snap("g1 investigating again (push #2)")
    g.guard1.spot_player(P(30.0, 30.0))
    snap("spot DURING investigate -> alerted")
    pos1 = P(29.0, 29.0); run(1, "g1 arrives last_known -> searching")
    pos1 = P(1.0, 1.0); run(192, "3.0s search over -> patrolling")
    g.guard1.hear_sound(P(40.0, 40.0))
    snap("g1 push #3 (orphan below on stack)")
    run(96, "1.5s: pop\$ is LIFO -> patrolling")
    pos1 = FAR

    g.guard2.hear_sound(P(10.0, 90.0))
    snap("g2 investigating (timer at 0)")
    g.pause()
    snap("pause during playing (push)")
    run(192, "3.0s paused: g2 timer FROZEN")
    g.resume()
    snap("resume (pop -> playing)")
    run(96, "1.5s after resume: g2 pops now")

    g.guard_caught_player(1)
    snap("g2 touches player -> caught")

    g.restart()
    snap("restart -> attract (counters reset)")

    val esc = Stealth()
    esc.start(P1, P2, P3)
    for (i in 0 until 64) esc.tick(DT, FAR, FAR, FAR)
    esc.player_at_exit()
    println(String.format(Locale.ROOT, "ESC escape path: st=%s by=%d t=%d",
        esc.get_state(), esc.get_caught_by(), Math.round(esc.get_elapsed() * 64)))

    g.start(P2, P3, P1)
    snap("Q: start after restart: init DROPPED")

    step = 0
    val s = Stealth()
    s.start(P1, P2, P3)
    for (i in 0 until 32) s.tick(DT, P(1.0, 1.0), FAR, FAR)
    s.guard1.hear_sound(P(50.0, 50.0))
    s.guard2.spot_player(P(80.0, 80.0))
    for (i in 0 until 32) s.tick(DT, FAR, FAR, FAR)
    snapOf(s, "SAVE POINT (push live, alerted, mid)", "S")
    val blob = s.save_state()
    val r = Stealth()
    r.restore_state(blob)
    snapOf(r, "restored copy, same tick", "S")
    step--
    val ns = intArrayOf(64, 224, 192)
    val labels = arrayOf("invest pops on both", "chase times out on both", "search resumes patrol on both")
    for (k in 0 until 3) {
        for (i in 0 until ns[k]) s.tick(DT, FAR, FAR, FAR)
        for (i in 0 until ns[k]) r.tick(DT, FAR, FAR, FAR)
        snapOf(s, String.format(Locale.ROOT, "orig  +%d (%s)", ns[k], labels[k]), "S")
        step--
        snapOf(r, String.format(Locale.ROOT, "rest  +%d (%s)", ns[k], labels[k]), "S")
    }
    s.pause()
    val blob2 = s.save_state()
    val r2 = Stealth()
    r2.restore_state(blob2)
    r2.resume()
    println(String.format(Locale.ROOT, "SP  paused save -> restore -> resume: st=%s t=%d",
        r2.get_state(), Math.round(r2.get_elapsed() * 64)))
}
