// Stealth cross-language oracle — Rust driver. Mirrors run-oracle.mjs.
mod stealth;
use stealth::*;

const DT: f64 = 1.0 / 64.0;

fn pad(s: &str, w: usize) -> String {
    let mut o = s.to_string();
    while o.chars().count() < w { o.push(' '); }
    o
}
fn lpad(s: String, w: usize) -> String {
    let mut o = s;
    while o.chars().count() < w { o.insert(0, ' '); }
    o
}
fn flags(gd: &mut Guard) -> String {
    format!("{}{}{}", if gd.is_aware() {1} else {0}, if gd.is_alerted() {1} else {0}, if gd.should_move() {1} else {0})
}
fn gcol(gd: &mut Guard) -> String {
    let t = gd.get_target();
    format!("{}/{} tgt=({},{})", gd.get_state(), flags(gd), t.x.round() as i64, t.y.round() as i64)
}
fn snap_of(m: &mut Stealth, label: &str, tag: &str, step: &mut i32) {
    let tks = (m.get_elapsed() * 64.0).round() as i64;
    let st = m.get_state();
    let cb = m.get_caught_by();
    let g1 = gcol(&mut m.guard1);
    let g2 = gcol(&mut m.guard2);
    let g3 = gcol(&mut m.guard3);
    println!("{}{:03} {} st={} t={} by={} | g1={} | g2={} | g3={}",
        tag, step, pad(label, 38), pad(&st, 8), lpad(tks.to_string(), 4), lpad(cb.to_string(), 2),
        pad(&g1, 28), pad(&g2, 28), pad(&g3, 28));
    *step += 1;
}

fn main() {
    let p1 = vec![Vector2::new(0.0, 0.0), Vector2::new(64.0, 0.0), Vector2::new(64.0, 64.0)];
    let p2 = vec![Vector2::new(0.0, 0.0), Vector2::new(96.0, 0.0)];
    let p3 = vec![Vector2::new(0.0, 0.0), Vector2::new(96.0, 96.0)];
    let far = Vector2::new(500.0, 500.0);
    let (mut pos1, mut pos2, mut pos3) = (far, far, far);
    let mut step: i32 = 0;
    let mut g = Stealth::__create();

    macro_rules! snap { ($lbl:expr) => { snap_of(&mut g, $lbl, "", &mut step); } }
    macro_rules! pump { ($n:expr) => { for _ in 0..$n { g.tick(DT, pos1, pos2, pos3); } } }
    macro_rules! run { ($n:expr, $lbl:expr) => { pump!($n); snap!(&format!("pump x{} ({})", $n, $lbl)); } }

    snap!("created (guards idle)");
    g.start(p1.clone(), p2.clone(), p3.clone());
    snap!("start -> playing, guards patrol wp0");
    println!("OP  get_current_state_name={}", g.get_current_state_name());

    run!(32, "0.5s: nobody arrives (FAR)");
    pos1 = Vector2::new(1.0, 1.0); run!(1, "g1 arrives wp0 -> tgt wp1");
    pos1 = Vector2::new(63.0, 1.0); run!(1, "g1 arrives wp1 -> tgt wp2");
    pos1 = Vector2::new(63.0, 63.0); run!(1, "g1 arrives wp2 -> WRAP tgt wp0");
    pos1 = far;

    g.guard1.hear_sound(Vector2::new(50.0, 50.0));
    g.guard2.hear_sound(Vector2::new(10.0, 90.0));
    snap!("g1+g2 hear_sound -> investigating");
    run!(95, "1.484s: both still investigating");
    run!(1, "tick 96 = 1.5s: both pop$ -> patrol");

    g.guard3.spot_player(Vector2::new(80.0, 80.0));
    snap!("g3 spotted (patrolling->alerted)");
    g.guard3.hear_sound(Vector2::new(5.0, 5.0));
    snap!("g3 hear_sound while alerted: NO-OP");

    run!(200, "3.125s chasing (far, no arrive)");
    g.guard3.spot_player(Vector2::new(80.0, 80.0));
    snap!("re-spot at 3.125s: chase timer RESET");
    run!(200, "3.125s more: still alerted (reset)");
    run!(56, "chase clock hits 4.0s -> searching");
    pos3 = Vector2::new(90.0, 90.0); run!(192, "3.0s search over -> NEAREST wp1");
    pos3 = far;

    g.guard1.hear_sound(Vector2::new(50.0, 50.0));
    snap!("g1 investigating again (push #2)");
    g.guard1.spot_player(Vector2::new(30.0, 30.0));
    snap!("spot DURING investigate -> alerted");
    pos1 = Vector2::new(29.0, 29.0); run!(1, "g1 arrives last_known -> searching");
    pos1 = Vector2::new(1.0, 1.0); run!(192, "3.0s search over -> patrolling");
    g.guard1.hear_sound(Vector2::new(40.0, 40.0));
    snap!("g1 push #3 (orphan below on stack)");
    run!(96, "1.5s: pop$ is LIFO -> patrolling");
    pos1 = far;

    g.guard2.hear_sound(Vector2::new(10.0, 90.0));
    snap!("g2 investigating (timer at 0)");
    g.pause();
    snap!("pause during playing (push)");
    run!(192, "3.0s paused: g2 timer FROZEN");
    g.resume();
    snap!("resume (pop -> playing)");
    run!(96, "1.5s after resume: g2 pops now");

    g.guard_caught_player(1);
    snap!("g2 touches player -> caught");

    g.restart();
    snap!("restart -> attract (counters reset)");

    let mut esc = Stealth::__create();
    esc.start(p1.clone(), p2.clone(), p3.clone());
    for _ in 0..64 { esc.tick(DT, far, far, far); }
    esc.player_at_exit();
    println!("ESC escape path: st={} by={} t={}", esc.get_state(), esc.get_caught_by(), (esc.get_elapsed() * 64.0).round() as i64);

    g.start(p2.clone(), p3.clone(), p1.clone());
    snap!("Q: start after restart: init DROPPED");

    // ---- S-section ----
    step = 0;
    let mut s = Stealth::__create();
    s.start(p1.clone(), p2.clone(), p3.clone());
    for _ in 0..32 { s.tick(DT, Vector2::new(1.0, 1.0), far, far); }
    s.guard1.hear_sound(Vector2::new(50.0, 50.0));
    s.guard2.spot_player(Vector2::new(80.0, 80.0));
    for _ in 0..32 { s.tick(DT, far, far, far); }
    snap_of(&mut s, "SAVE POINT (push live, alerted, mid)", "S", &mut step);
    let blob = s.save_state();
    let mut r = Stealth::__create();
    r.restore_state(blob);
    snap_of(&mut r, "restored copy, same tick", "S", &mut step);
    step -= 1;
    let plan: [(i32, &str); 3] = [(64, "invest pops on both"), (224, "chase times out on both"), (192, "search resumes patrol on both")];
    for (n, label) in plan.iter() {
        for _ in 0..*n { s.tick(DT, far, far, far); }
        for _ in 0..*n { r.tick(DT, far, far, far); }
        snap_of(&mut s, &format!("orig  +{} ({})", n, label), "S", &mut step);
        step -= 1;
        snap_of(&mut r, &format!("rest  +{} ({})", n, label), "S", &mut step);
    }
    s.pause();
    let blob2 = s.save_state();
    let mut r2 = Stealth::__create();
    r2.restore_state(blob2);
    r2.resume();
    println!("SP  paused save -> restore -> resume: st={} t={}", r2.get_state(), (r2.get_elapsed() * 64.0).round() as i64);
}
