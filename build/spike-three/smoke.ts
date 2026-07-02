import { AsteroidsGame } from "./asteroids";
const log: string[] = [];
const host = {
  warpOut() { log.push("warpOut"); },
  warpIn() { log.push("warpIn"); },
  spawnExplosion() { log.push("spawnExplosion"); },
  resetShip() { log.push("resetShip"); },
};
const g = (AsteroidsGame as any)._create(host, 2);
console.log("init:", g.get_current_state_name(), "lives", g.get_lives(), "wave", g.get_wave(), "diff", g.get_difficulty());
g.start();
console.log("start:", g.get_current_state_name(), "count", g.field.count(), "alive", g.field.alive_count());
const court = g.last_court_size;
for (let i=0;i<3;i++) g.tick(0.016, court);
const before = g.get_score(); g.bullet_hit_asteroid(0);
console.log("split0: score", before, "->", g.get_score(), "count", g.field.count(), "alive", g.field.alive_count());
g.ship_hyperspace();
for (let i=0;i<30;i++) g.tick(0.016, court);
console.log("hyper: ship", g.ship.get_current_state_name(), "warps", g.ship.get_hyperspaces_remaining(), "host", log);
g.pause(); const p = g.is_paused(); g.resume();
console.log("pause/resume:", p, "->", g.is_paused());
console.log("TS SMOKE OK");
