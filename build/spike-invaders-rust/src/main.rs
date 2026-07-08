mod invaders;
use invaders::*;

const DT: f64 = 1.0 / 64.0;

fn pad(s: &str, w: usize) -> String { let mut o = s.to_string(); while o.chars().count() < w { o.push(' '); } o }
fn lpad(s: String, w: usize) -> String { let mut o = s; while o.chars().count() < w { o.insert(0, ' '); } o }

fn snap(g: &mut Invaders, label: &str, step: &mut i32) {
    let ivus = (g.fleet.get_step_interval() * 1e6).round() as i64;
    let st = g.get_state(); let sc = g.get_score(); let wv = g.get_wave(); let lv = g.get_lives();
    let fst = g.fleet.get_state(); let dir = g.fleet.get_direction();
    let al = g.fleet.alive_count(); let tot = g.fleet.total(); let lr = g.fleet.lowest_row();
    let pl = g.player.get_state(); let pz = if g.is_paused() {1} else {0};
    println!("{:03} {} st={} sc={} wv={} lv={} | fl={} dir={} al={}/{} iv={} lr={} | pl={} pz={}",
        step, pad(label, 34), pad(&st, 13), lpad(sc.to_string(), 4), wv, lv,
        pad(&fst, 9), lpad(dir.to_string(), 2), lpad(al.to_string(), 2), lpad(tot.to_string(), 2),
        lpad(ivus.to_string(), 6), lpad(lr.to_string(), 2), pad(&pl, 12), pz);
    *step += 1;
}

fn main() {
    let mut step: i32 = 0;
    let mut g = Invaders::new();
    macro_rules! snap { ($l:expr) => { snap(&mut g, $l, &mut step); } }
    macro_rules! run { ($n:expr, $l:expr) => { for _ in 0..$n { g.tick(DT); } snap!(&format!("pump x{} ({})", $n, $l)); } }

    snap!("created");
    g.start();
    snap!("start -> playing (fleet 55, iv=600000)");
    println!("OP  get_current_state_name={}", g.get_current_state_name());

    run!(39, "0.61s: fleet wants_to_step");
    println!("SIG consume_step={} (timer was >= interval)", if g.fleet.consume_step() {"true"} else {"false"});

    g.player_killed_invader(0);
    snap!("kill idx0 (+10, pace up)");
    g.player_killed_invader(1);
    g.player_killed_invader(2);
    snap!("kill idx1,2 (+20 more)");
    g.player_killed_invader(1);
    g.player_killed_invader(999);
    g.player_killed_invader(-1);
    snap!("kill dead/oob idx: NO score change");

    g.fleet_reached_edge();
    snap!("fleet_reached_edge -> stepping, dir flip");
    run!(1, "one tick: stepping -> marching");

    g.pause();
    snap!("pause during PLAYING (push)");
    run!(64, "1.0s paused: fleet+player frozen");
    g.resume();
    snap!("resume (pop -> playing)");

    for i in 3..55 { g.player_killed_invader(i); }
    snap!("cleared fleet -> wave_complete");

    g.pause();
    snap!("pause during WAVE_COMPLETE (push)");
    run!(64, "1.0s paused: wave timer frozen");
    g.resume();
    snap!("resume (pop -> wave_complete)");

    run!(129, "2.0s: wave 2 begins, fleet reset");

    g.player_hit();
    snap!("player_hit -> player_dying");
    g.player_hit();
    snap!("player_hit while exploding: NO-OP");

    g.pause();
    snap!("pause during PLAYER_DYING (push)");
    run!(64, "1.0s paused: explosion timer frozen");
    g.resume();
    snap!("resume (pop -> player_dying)");

    run!(77, "1.2s: lives-1, invuln, -> playing");
    run!(96, "1.5s: invuln over -> alive");

    g.fleet_reached_bottom();
    snap!("fleet_reached_bottom -> game_over");
    g.restart();
    snap!("restart -> attract (reset)");

    let mut g2 = Invaders::new();
    g2.start();
    for _ in 0..3 { g2.player_hit(); for _ in 0..180 { g2.tick(DT); } }
    println!("DEATH after 3 hits: st={} lives={} player={}", g2.get_state(), g2.get_lives(), g2.player.get_state());

    let mut g3 = Invaders::new();
    g3.start();
    let d0 = g3.fleet.get_direction();
    g3.fleet_reached_edge(); g3.tick(DT);
    let d1 = g3.fleet.get_direction();
    g3.fleet_reached_edge(); g3.tick(DT);
    let d2 = g3.fleet.get_direction();
    println!("DIR bounces: start={} after1={} after2={}", d0, d1, d2);
}
