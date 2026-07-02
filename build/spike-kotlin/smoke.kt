val log = mutableListOf<String>()
class Host : IShipHost {
    override fun warp_out() { log.add("warp_out") }
    override fun warp_in() { log.add("warp_in") }
    override fun spawn_explosion() { log.add("spawn_explosion") }
    override fun reset_ship() { log.add("reset_ship") }
}
fun main() {
    val g = AsteroidsGame.__create(Host(), 2)
    println("init: ${g.get_current_state_name()} lives ${g.get_lives()} wave ${g.get_wave()} diff ${g.get_difficulty()}")
    g.start()
    println("start: ${g.get_current_state_name()} count ${g.field.count()} alive ${g.field.alive_count()}")
    val court = g.last_court_size
    for (i in 0 until 3) g.tick(0.016, court)
    val before = g.get_score(); g.bullet_hit_asteroid(0)
    println("split0: score $before -> ${g.get_score()} count ${g.field.count()} alive ${g.field.alive_count()}")
    g.ship_hyperspace()
    for (i in 0 until 30) g.tick(0.016, court)
    println("hyper: ship ${g.ship.get_current_state_name()} warps ${g.ship.get_hyperspaces_remaining()} host $log")
    g.pause(); val p = g.is_paused(); g.resume()
    println("pause/resume: $p -> ${g.is_paused()}")
    println("KT SMOKE OK")
}
