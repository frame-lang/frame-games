var step = 0
lateinit var g: Pong
fun bU(x: Boolean): Int = if (x) 1 else 0
fun padr(s: String, w: Int): String { val b = StringBuilder(s); while (b.length < w) b.append(' '); return b.toString() }
fun padl(o: Any, w: Int): String { val s = o.toString(); val b = StringBuilder(); var i = s.length; while (i < w) { b.append(' '); i++ }; return b.toString() + s }
fun snap(label: String) {
    println(
        String.format("%03d ", step) + padr(label, 38) + " " +
        "st=" + padr(g.get_current_state_name(), 12) + " sl=" + padl(g.get_score_left(), 2) + " sr=" + padl(g.get_score_right(), 2) + " " +
        "serve=" + padl(g.get_serve_direction(), 2) + " play=" + bU(g.is_playing()) + " winner=" + padr(g.get_winner(), 6))
    step++
}
fun pointRight(x: Pong) { x.launch(); x.ball_out_left() }
fun pointLeft(x: Pong) { x.launch(); x.ball_out_right() }

fun main() {
    g = Pong.__create()
    snap("created (AttractMode / 0-0)")
    println("OP  get_current_state_name=" + g.get_current_state_name() + " get_winning_score=" + g.get_winning_score())

    g.start(); snap("start -> Serving")
    g.pause(); snap("pause during Serving (push)")
    g.resume(); snap("resume (pop -> Serving)")
    g.launch(); snap("launch -> InPlay (playing)")
    g.pause(); snap("pause during InPlay (push)")
    g.resume(); snap("resume (pop -> InPlay)")
    g.ball_out_left(); snap("ball_out_left -> right+1, serve -1")
    pointLeft(g); snap("pointLeft -> left+1, serve +1")
    for (i in 0 until 9) pointRight(g)
    snap("right at 10 (one short of 11)")
    pointRight(g); snap("right scores 11 -> GameOver [right wins]")
    println("WIN winner=" + g.get_winner() + " playing=" + bU(g.is_playing()) + " sl=" + g.get_score_left() + " sr=" + g.get_score_right())
    g.restart(); snap("restart -> AttractMode (reset)")

    val g2 = Pong.__create()
    g2.start()
    for (i in 0 until 11) pointLeft(g2)
    println("MIRROR left win: st=" + g2.get_current_state_name() + " winner=" + g2.get_winner() + " sl=" + g2.get_score_left() + " serve=" + g2.get_serve_direction())
}
