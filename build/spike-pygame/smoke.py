import asteroids as A
log = []
class Host:
    def warp_out(self): log.append("warp_out")
    def warp_in(self): log.append("warp_in")
    def spawn_explosion(self): log.append("spawn_explosion")
    def reset_ship(self): log.append("reset_ship")
g = A.AsteroidsGame._create(Host(), 2)
print("init:", g.get_current_state_name(), "lives", g.get_lives(), "wave", g.get_wave(), "diff", g.get_difficulty())
g.start()
print("start:", g.get_current_state_name(), "count", g.field.count(), "alive", g.field.alive_count())
court = g.last_court_size
for _ in range(3): g.tick(0.016, court)
before = g.get_score(); g.bullet_hit_asteroid(0)
print("split0: score", before, "->", g.get_score(), "count", g.field.count(), "alive", g.field.alive_count())
g.ship_hyperspace()
for _ in range(30): g.tick(0.016, court)
print("hyper: ship", g.ship.get_current_state_name(), "warps", g.ship.get_hyperspaces_remaining(), "host", log)
g.pause(); p = g.is_paused(); g.resume()
print("pause/resume:", p, "->", g.is_paused())
print("PY SMOKE OK")
