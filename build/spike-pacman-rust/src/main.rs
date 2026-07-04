// Pac-Man cross-language oracle — Rust driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
mod pacman;
use pacman::*;
use std::cell::RefCell;
use std::rc::Rc;

const DT: f64 = 1.0 / 64.0;

fn pad(s: &str, w: usize) -> String {
    let mut out = s.to_string();
    while out.len() < w {
        out.push(' ');
    }
    out
}

struct Ctx {
    g: GhostGame,
    step: i32,
}

impl Ctx {
    fn snap(&mut self, label: &str) {
        let mut gs = vec!["-".to_string(), "-".to_string(), "-".to_string(), "-".to_string()];
        let mut flags = vec!["--".to_string(); 4];
        let n = self.g.ghost_count();
        for i in 0..n {
            gs[i as usize] = self.g.ghost_state(i);
            let d = if self.g.ghost_is_dangerous(i) { "D" } else { "." };
            let e = if self.g.ghost_is_edible(i) { "E" } else { "." };
            flags[i as usize] = format!("{}{}", d, e);
        }
        println!(
            "{:03} {} phase={} fright={:7.3} score={:4} g=[{} {} {} {}] f=[{} {} {} {}]",
            self.step,
            pad(label, 28),
            pad(&self.g.get_phase(), 10),
            self.g.frighten_seconds_left(),
            self.g.get_score(),
            pad(&gs[0], 10), pad(&gs[1], 10), pad(&gs[2], 10), pad(&gs[3], 10),
            flags[0], flags[1], flags[2], flags[3]
        );
        self.step += 1;
    }

    fn tick(&mut self, n: i32, label: &str) {
        for _ in 0..n {
            self.g.tick(DT);
        }
        self.snap(&format!("tick x{} ({})", n, label));
    }
}

fn main() {
    let mut c = Ctx { g: GhostGame::__create(), step: 0 };
    let names = ["blinky", "pinky", "inky", "clyde"];
    let corners = [
        Vector2 { x: 680.0, y: 40.0 },
        Vector2 { x: 40.0, y: 40.0 },
        Vector2 { x: 680.0, y: 440.0 },
        Vector2 { x: 40.0, y: 440.0 },
    ];

    c.snap("created");
    for i in 0..4 {
        c.g.add_ghost(Rc::new(RefCell::new(Ghost::__create(
            names[i].to_string(), corners[i], i as i32,
        ))));
    }
    c.snap("add_ghost x4");
    c.g.start();
    c.snap("start");

    c.tick(64, "1.0s: pen not due");
    c.tick(80, "2.25s: 1st release");
    c.tick(128, "4.25s: 2nd release");
    c.tick(128, "6.25s: 3rd release");
    c.tick(64, "7.25s: scatter(7s) over");

    c.g.power_pellet_picked_up();
    c.snap("pellet during CHASE (push)");
    c.tick(64, "1.0s frightened");
    c.g.ghost_caught(0);
    c.snap("caught blinky (+200)");
    c.g.ghost_caught(0);
    c.snap("caught blinky again (no-op)");
    c.g.ghost_caught(1);
    c.snap("caught pinky (+200)");
    c.tick(64, "2.0s frightened");
    c.g.ghost_arrived_at_pen(0);
    c.snap("blinky arrived at pen");
    c.tick(256, "6.0s: frighten expires");
    c.tick(64, "chase resumed 1.0s");

    c.g.power_pellet_picked_up();
    c.snap("pellet during CHASE #2 (push)");
    c.g.power_pellet_picked_up();
    c.snap("pellet WHILE frightened (re-enter)");
    c.tick(320, "5.0s of re-frighten");
    c.tick(96, "6.5s total: expires again");

    c.tick(1152, "chase(20s) over -> scatter");
    c.g.power_pellet_picked_up();
    c.snap("pellet during SCATTER (push)");
    c.tick(416, "6.5s: expires -> scatter");
    c.tick(320, "scatter(5s) over -> chase");

    c.snap("final");
}
