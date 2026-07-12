const val DT = 1.0 / 64.0
var step = 0
lateinit var g: Platformer
fun mU(x: Double): Long = Math.round(x * 1000)
fun bU(x: Boolean): Int = if (x) 1 else 0
fun padr(s: String, w: Int): String { val b = StringBuilder(s); while (b.length < w) b.append(' '); return b.toString() }
fun padl(o: Any, w: Int): String { val s = o.toString(); val b = StringBuilder(); var i = s.length; while (i < w) { b.append(' '); i++ }; return b.toString() + s }
fun snap(label: String) {
    println(
        String.format("%03d ", step) + padr(label, 40) + " " +
        "st=" + padr(g.get_current_state_name(), 7) + " loco=" + padr(g.locomotion_state(), 8) + " form=" + padr(g.form(), 5) + " " +
        "vx=" + padl(mU(g.wants_velocity_x()), 7) + " face=" + padl(g.facing(), 2) + " " +
        "gnd=" + bU(g.is_grounded()) + " air=" + bU(g.is_in_air()) + " jimp=" + bU(g.wants_jump_impulse()) + " " +
        "hbox=" + padl(g.hit_box_height(), 2) + " shoot=" + bU(g.can_shoot()) + " paused=" + bU(g.is_paused()))
    step++
}
fun run(n: Int, label: String) { for (i in 0 until n) g.tick(DT); snap("pump x$n ($label)") }

fun main() {
    g = Platformer.__create()
    snap("created (Playing / idle / small)")
    println("OP  get_current_state_name=" + g.get_current_state_name())

    g.press_right(); snap("press_right -> walking, face+1")
    g.press_sprint(); snap("press_sprint -> running (vx 260)")
    g.release_sprint(); snap("release_sprint -> walking (vx 140)")
    g.press_left(); snap("press_left -> face-1, vx -140")
    g.release_horizontal(); snap("release_horizontal -> idle")

    g.press_jump(); snap("press_jump -> jumping, jimp=1")
    g.consume_jump_impulse(); snap("consume_jump_impulse -> jimp=0")
    g.press_right(); snap("press_right in air -> vx 180 (air_speed)")
    run(22, "0.34s held: still jumping")
    run(1, "tick 23 (0.35s) -> falling")

    g.ground_contact(); snap("ground_contact -> landing")
    run(5, "0.078s: still landing")
    run(1, "tick 6 (0.08s): input_x!=0 -> walking")
    g.release_horizontal(); snap("release_horizontal -> idle")

    g.press_jump(); snap("press_jump -> jumping (fresh)")
    g.release_jump(); snap("release_jump -> timer frozen")
    run(40, "0.625s released: STILL jumping (no auto-fall)")
    g.ground_contact(); snap("ground_contact -> landing (input_x=0)")
    run(6, "0.08s: input_x==0 -> idle")

    g.left_ground(); snap("left_ground -> falling (walked off)")
    g.ground_contact(); snap("ground_contact -> landing")
    run(6, "recover -> idle")

    g.pickup_mushroom(); snap("pickup_mushroom -> big (hbox 48)")
    g.pickup_flower(); snap("pickup_flower -> fiery (can_shoot 1)")
    g.take_damage(); snap("take_damage -> big [ret-then-transition]")
    g.take_damage(); snap("take_damage -> small (hbox 24)")
    g.take_damage(); snap("take_damage in small -> no transition")
    g.pickup_flower(); snap("pickup_flower from small -> fiery")

    println("RET take_damage(fiery)=" + bU(g.take_damage()) + " form_now=" + g.form() + " (expect 1 / big)")
    println("RET take_damage(big)=" + bU(g.take_damage()) + " form_now=" + g.form() + " (expect 1 / small)")
    println("RET take_damage(small)=" + bU(g.take_damage()) + " form_now=" + g.form() + " (expect 0 / small)")

    g.pickup_mushroom(); g.press_right(); snap("re-arm: big + walking before pause")
    g.pause(); snap("pause -> Paused (push), paused=1")
    run(64, "1.0s paused: locomotion frozen")
    g.resume(); snap("resume -> Playing (pop), paused=0")

    val g2 = Platformer.__create()
    g2.press_right(); g2.press_sprint()
    val loco_before = g2.locomotion_state()
    g2.pickup_mushroom(); g2.pickup_flower()
    val loco_after = g2.locomotion_state()
    println("ORTHO loco stable across powerups: before=$loco_before after=$loco_after form=${g2.form()} (expect running/running/fiery)")

    val g3 = Platformer.__create()
    g3.press_jump()
    for (i in 0 until 10) g3.tick(DT)
    g3.pause()
    for (i in 0 until 128) g3.tick(DT)
    g3.resume()
    val loco_resumed = g3.locomotion_state()
    for (i in 0 until 12) g3.tick(DT)
    val still_jumping = g3.locomotion_state()
    g3.tick(DT)
    val now_falling = g3.locomotion_state()
    println("PAUSE ticks dropped: resumed=$loco_resumed at22=$still_jumping at23=$now_falling (expect jumping/jumping/falling)")
}
