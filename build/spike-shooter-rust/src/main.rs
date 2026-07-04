// Shooter cross-language oracle — Rust driver. Mirrors run-oracle.mjs.
mod shooter;
use shooter::*;
use std::cell::RefCell;
use std::rc::Rc;

const DT: f64 = 1.0 / 64.0;

fn pad(s: &str, w: usize) -> String {
    let mut out = s.to_string();
    while out.len() < w { out.push(' '); }
    out
}

struct Ctx { g: Shooter, step: i32, waves: i32, ef: i32, bs: i32, bd: i32, by: i32 }

impl Ctx {
    fn build_wave(&mut self) {
        self.waves += 1;
        if self.waves == 1 {
            self.g.add_enemy(Rc::new(RefCell::new(Enemy::__create(0, 2, 0.0, 100))));
            self.g.add_enemy(Rc::new(RefCell::new(Enemy::__create(1, 3, 0.75, 150))));
        } else {
            self.g.add_enemy(Rc::new(RefCell::new(Enemy::__create(self.waves % 3, 1, 0.0, 10))));
            self.g.add_enemy(Rc::new(RefCell::new(Enemy::__create((self.waves + 1) % 3, 1, 0.0, 10))));
        }
    }
    fn pump(&mut self, n: i32) {
        for _ in 0..n {
            self.g.tick(DT);
            if self.g.should_spawn_wave() { self.g.consume_wave(); self.build_wave(); }
            if self.g.should_spawn_boss() { self.g.consume_boss_spawn(); }
            for e in 0..self.g.enemy_count() {
                let en = self.g.enemies[e as usize].clone();
                let wants = en.borrow_mut().wants_to_fire();
                if wants { en.borrow_mut().consume_fire(); self.ef += 1; }
            }
            if self.g.boss.wants_to_fire_single() { self.g.boss.consume_fire(); self.bs += 1; }
            if self.g.boss.wants_to_fire_spread() { self.g.boss.consume_fire(); self.bd += 1; }
            if self.g.boss.wants_to_fire_spray()  { self.g.boss.consume_fire(); self.by += 1; }
            self.g.clear_dead_enemies();
        }
    }
    fn snap(&mut self, label: &str) {
        let e0 = if self.g.enemy_count() > 0 { self.g.enemies[0].borrow_mut().get_state() } else { "-".to_string() };
        let e1 = if self.g.enemy_count() > 1 { self.g.enemies[1].borrow_mut().get_state() } else { "-".to_string() };
        println!("{:03} {} st={} score={:4} lives={} n={} e0={} e1={} boss={} bhp={:2} pl={} fire[e={} s={} d={} y={}] waves={}",
            self.step, pad(label, 30), pad(&self.g.get_state(), 10),
            self.g.get_score(), self.g.get_lives(), self.g.enemy_count(),
            pad(&e0, 8), pad(&e1, 8), pad(&self.g.boss.get_state(), 11), self.g.boss.get_hp(),
            pad(&self.g.player.get_state(), 12), self.ef, self.bs, self.bd, self.by, self.waves);
        self.step += 1;
    }
    fn run(&mut self, n: i32, label: &str) { self.pump(n); self.snap(&format!("pump x{} ({})", n, label)); }
}

fn main() {
    let mut c = Ctx { g: Shooter::__create(), step: 0, waves: 0, ef: 0, bs: 0, bd: 0, by: 0 };
    c.snap("created"); c.g.start(); c.snap("start -> playing");
    c.run(129, "2.0s+: wave 1 spawns"); c.run(32, "0.5s: spawning -> active");
    c.g.enemy_hit(0, 1); c.snap("e0 hit 1/2 (still active)");
    c.g.enemy_hit(0, 1); c.snap("e0 hit 2/2 -> dying, +100");
    c.run(26, "0.4s: e0 gone + CLEANED UP"); c.run(23, "e1 fire #1 (rate 0.75)"); c.run(48, "e1 fire #2");
    c.g.player_hit(); c.snap("player hit -> exploding");
    c.g.player_hit(); c.snap("player hit while exploding (no-op)");
    c.run(64, "1.0s: lives-1 -> invulnerable");
    c.g.player_hit(); c.snap("player hit while invuln (no-op)");
    c.g.pause(); c.snap("pause during PLAYING (push)");
    c.run(64, "1.0s paused: everything frozen");
    c.g.resume(); c.snap("resume (pop -> playing)");
    c.run(128, "2.0s: invuln over + wave 2");
    c.g.enemy_hit(0, 99); c.snap("kill the old shooter e0 (+150)");
    c.run(600, "rush: waves 3..6 spawn+decay"); c.run(600, "rush: waves 7..10 -> BOSS mid-pump");
    c.snap("boss_fight (entered during rush)");
    c.run(116, "boss p1: idle(1.8s) -> firing"); c.run(26, "p1 firing 0.4s -> idle (1 shot)");
    c.g.boss_hit(10); c.g.boss_hit(10); c.g.boss_hit(10); c.snap("boss 90->60 (>59.4: still P1)");
    c.g.boss_hit(10); c.snap("boss 60->50 <=59.4 -> PHASE 2");
    c.g.pause(); c.snap("pause during BOSS FIGHT (push)");
    c.run(64, "1.0s paused: boss frozen");
    c.g.resume(); c.snap("resume (pop -> boss_fight)");
    c.run(84, "p2: idle(1.3s) -> spread"); c.run(33, "p2 spread 0.5s -> idle (1 shot)");
    c.g.boss_hit(21); c.snap("boss 50->29 <=29.7 -> PHASE 3");
    c.run(39, "p3: idle(0.6s) -> spray"); c.run(52, "p3 spray 0.8s (~6 shots @0.12s)");
    c.g.boss_hit(29); c.snap("boss 29->0 in P3 -> DYING");
    c.run(200, "boss dying -> gone -> VICTORY");
    c.snap("final");

    let mut g2 = Shooter::__create();
    g2.start();
    for _ in 0..10 { for _ in 0..129 { g2.tick(DT); } if g2.should_spawn_wave() { g2.consume_wave(); } }
    for _ in 0..65 { g2.tick(DT); }
    println!("Q00 quirk: state={} boss={}", g2.get_state(), g2.boss.get_state());
    g2.boss_hit(90);
    println!("Q01 quirk: one 90-dmg hit in P1 -> boss={} hp={} (phase two, not dying)", g2.boss.get_state(), g2.boss.get_hp());
    g2.boss_hit(1);
    println!("Q02 quirk: 1-dmg hit in P2 at 0hp -> boss={} hp={} (phase three)", g2.boss.get_state(), g2.boss.get_hp());
    g2.boss_hit(1);
    println!("Q03 quirk: 1-dmg hit in P3 -> boss={} (finally dying)", g2.boss.get_state());
}
