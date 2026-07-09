mod breakout; use breakout::*;
const DT: f64 = 1.0 / 64.0;
fn padr(s: &str, w: usize) -> String { let mut o=s.to_string(); while o.chars().count()<w { o.push(' '); } o }
fn padl(s: String, w: usize) -> String { let mut o=s; while o.chars().count()<w { o.insert(0,' '); } o }
fn mu(x: f64) -> i64 { (x*1000.0).round() as i64 }
fn snap(g:&mut Breakout, label:&str, step:&mut i32) {
    let rp = if g.get_state()=="playing" { padl(mu(g.ball_respawn_progress()).to_string(),4) } else { padl("-".to_string(),4) };
    println!("{:03} {} st={} sc={} lv={} lvl={} br={} | ball={} vx={} vy={} rp={}",
        step, padr(label,34), padr(&g.get_state(),11), padl(g.get_score().to_string(),4), g.get_lives(), g.get_level(),
        padl(g.bricks_remaining().to_string(),2), padr(&g.ball_state(),9), padl(mu(g.ball_vx()).to_string(),6), padl(mu(g.ball_vy()).to_string(),6), rp);
    *step+=1;
}
fn main() {
    let mut step=0; let mut g = Breakout::__create();
    macro_rules! snap { ($l:expr) => { snap(&mut g,$l,&mut step); } }
    macro_rules! run { ($n:expr,$l:expr) => { for _ in 0..$n { g.tick(DT); } snap!(&format!("pump x{} ({})",$n,$l)); } }
    snap!("created"); g.start(); snap!("start -> playing, ball attached");
    println!("OP  get_current_state_name={}", g.get_current_state_name());
    g.launch_ball(3.5,-4.25); snap!("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
    g.wall_bounce_x(); snap!("wall_bounce_x -> vx negated");
    g.wall_bounce_y(); snap!("wall_bounce_y -> vy negated");
    g.paddle_hit(2.75,-5.5); snap!("paddle_hit -> set_velocity(2.75,-5.5)");
    g.brick_hit(0); snap!("brick_hit(0): +10, vy flip, broken");
    g.brick_hit(0); g.brick_hit(999); g.brick_hit(-1); snap!("brick_hit dead/oob: NO score change");
    g.brick_hit(1); g.brick_hit(2); snap!("brick_hit(1,2): +20");
    g.pause(); snap!("pause during PLAYING (push)"); run!(64,"1.0s paused: ball frozen"); g.resume(); snap!("resume (pop -> playing)");
    g.ball_fell_off(); snap!("ball_fell_off -> lives-1, ball lost");
    run!(64,"1.0s: respawn progress ~0.5"); run!(63,"just before 2.0s: still lost"); run!(1,"tick 2.0s: ball -> attached");
    g.launch_ball(3.5,-4.25); snap!("re-launch (fresh in_flight)");
    for i in 3..40 { g.brick_hit(i); } snap!("cleared wall -> level_clear (lvl 2)");
    g.start(); snap!("start -> playing, fresh wall of 40");
    g.ball_fell_off(); snap!("fell off -> lives 1"); g.ball_fell_off(); snap!("fell off -> lives 0 -> game_over");
    g.restart(); snap!("restart -> attract (reset)");
    let mut g2 = Breakout::__create(); g2.start(); g2.launch_ball(1.0,-1.0); g2.ball_fell_off();
    for _ in 0..32 { g2.tick(DT); } let rpb = mu(g2.ball_respawn_progress()); g2.pause();
    for _ in 0..128 { g2.tick(DT); } g2.resume(); let rpa = mu(g2.ball_respawn_progress());
    println!("PAUSE respawn frozen: before={} after={} ball={} (paused ticks must not advance the ball)", rpb, rpa, g2.ball_state());
    let mut g3 = Breakout::__create(); g3.start();
    println!("BRICK is_broken: fresh0={} oobNeg={} oobBig={} (expect false, true, true)", g3.is_brick_broken(0), g3.is_brick_broken(-1), g3.is_brick_broken(999));
}
