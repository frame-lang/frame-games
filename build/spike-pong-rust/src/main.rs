mod pong; use pong::*;
fn padr(s: &str, w: usize) -> String { let mut o=s.to_string(); while o.chars().count()<w { o.push(' '); } o }
fn padl(s: String, w: usize) -> String { let mut o=s; while o.chars().count()<w { o.insert(0,' '); } o }
fn bu(x: bool) -> i32 { if x {1} else {0} }
fn snap(g:&mut Pong, label:&str, step:&mut i32) {
    println!("{:03} {} st={} sl={} sr={} serve={} play={} winner={}",
        step, padr(label,38), padr(&g.get_current_state_name(),12), padl(g.get_score_left().to_string(),2), padl(g.get_score_right().to_string(),2),
        padl(g.get_serve_direction().to_string(),2), bu(g.is_playing()), padr(&g.get_winner(),6));
    *step+=1;
}
fn point_right(x:&mut Pong) { x.launch(); x.ball_out_left(); }
fn point_left(x:&mut Pong) { x.launch(); x.ball_out_right(); }

fn main() {
    let mut step=0; let mut g = Pong::__create();
    macro_rules! snap { ($l:expr) => { snap(&mut g,$l,&mut step); } }

    snap!("created (AttractMode / 0-0)");
    println!("OP  get_current_state_name={} get_winning_score={}", g.get_current_state_name(), g.get_winning_score());

    g.start(); snap!("start -> Serving");
    g.pause(); snap!("pause during Serving (push)");
    g.resume(); snap!("resume (pop -> Serving)");
    g.launch(); snap!("launch -> InPlay (playing)");
    g.pause(); snap!("pause during InPlay (push)");
    g.resume(); snap!("resume (pop -> InPlay)");
    g.ball_out_left(); snap!("ball_out_left -> right+1, serve -1");
    point_left(&mut g); snap!("pointLeft -> left+1, serve +1");
    for _ in 0..9 { point_right(&mut g); }
    snap!("right at 10 (one short of 11)");
    point_right(&mut g); snap!("right scores 11 -> GameOver [right wins]");
    println!("WIN winner={} playing={} sl={} sr={}", g.get_winner(), bu(g.is_playing()), g.get_score_left(), g.get_score_right());
    g.restart(); snap!("restart -> AttractMode (reset)");

    let mut g2 = Pong::__create();
    g2.start();
    for _ in 0..11 { point_left(&mut g2); }
    println!("MIRROR left win: st={} winner={} sl={} serve={}", g2.get_current_state_name(), g2.get_winner(), g2.get_score_left(), g2.get_serve_direction());
}
