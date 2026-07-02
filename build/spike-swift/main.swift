var hostLog: [String] = []
class Host: IShipHost {
    func warp_out() { hostLog.append("warp_out") }
    func warp_in() { hostLog.append("warp_in") }
    func spawn_explosion() { hostLog.append("spawn_explosion") }
    func reset_ship() { hostLog.append("reset_ship") }
}
let g = AsteroidsGame.__create(Host(), 2)
print("init: \(g.get_current_state_name()) lives \(g.get_lives()) wave \(g.get_wave()) diff \(g.get_difficulty())")
g.start()
print("start: \(g.get_current_state_name()) count \(g.field.count()) alive \(g.field.alive_count())")
let court = g.last_court_size
for _ in 0..<3 { g.tick(0.016, court) }
let before = g.get_score(); g.bullet_hit_asteroid(0)
print("split0: score \(before) -> \(g.get_score()) count \(g.field.count()) alive \(g.field.alive_count())")
g.ship_hyperspace()
for _ in 0..<30 { g.tick(0.016, court) }
print("hyper: ship \(g.ship.get_current_state_name()) warps \(g.ship.get_hyperspaces_remaining()) host \(hostLog)")
g.pause(); let p = g.is_paused(); g.resume()
print("pause/resume: \(p) -> \(g.is_paused())")
print("SWIFT SMOKE OK")
