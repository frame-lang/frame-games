import 'breakout.dart';
const DT = 1.0 / 64.0;
int step = 0;
late Breakout g;
int mU(double x) => (x * 1000).round();
String padr(String s, int w) => s.length < w ? s + ' ' * (w - s.length) : s;
String padl(Object o, int w) { var s = '$o'; return s.length < w ? ' ' * (w - s.length) + s : s; }
void snap(String label) {
  final rp = g.get_state() == "playing" ? padl(mU(g.ball_respawn_progress()), 4) : padl("-", 4);
  print('${step.toString().padLeft(3,'0')} ${padr(label,34)} '
      'st=${padr(g.get_state(),11)} sc=${padl(g.get_score(),4)} lv=${g.get_lives()} lvl=${g.get_level()} br=${padl(g.bricks_remaining(),2)} | '
      'ball=${padr(g.ball_state(),9)} vx=${padl(mU(g.ball_vx()),6)} vy=${padl(mU(g.ball_vy()),6)} rp=$rp');
  step++;
}
void run(int n, String label) { for (var i=0;i<n;i++) g.tick(DT); snap('pump x$n ($label)'); }
void main() {
  g = Breakout.create();
  snap("created"); g.start(); snap("start -> playing, ball attached");
  print("OP  get_current_state_name=${g.get_current_state_name()}");
  g.launch_ball(3.5, -4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
  g.wall_bounce_x(); snap("wall_bounce_x -> vx negated");
  g.wall_bounce_y(); snap("wall_bounce_y -> vy negated");
  g.paddle_hit(2.75, -5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)");
  g.brick_hit(0); snap("brick_hit(0): +10, vy flip, broken");
  g.brick_hit(0); g.brick_hit(999); g.brick_hit(-1); snap("brick_hit dead/oob: NO score change");
  g.brick_hit(1); g.brick_hit(2); snap("brick_hit(1,2): +20");
  g.pause(); snap("pause during PLAYING (push)"); run(64, "1.0s paused: ball frozen"); g.resume(); snap("resume (pop -> playing)");
  g.ball_fell_off(); snap("ball_fell_off -> lives-1, ball lost");
  run(64, "1.0s: respawn progress ~0.5"); run(63, "just before 2.0s: still lost"); run(1, "tick 2.0s: ball -> attached");
  g.launch_ball(3.5, -4.25); snap("re-launch (fresh in_flight)");
  for (var i=3;i<40;i++) g.brick_hit(i); snap("cleared wall -> level_clear (lvl 2)");
  g.start(); snap("start -> playing, fresh wall of 40");
  g.ball_fell_off(); snap("fell off -> lives 1"); g.ball_fell_off(); snap("fell off -> lives 0 -> game_over");
  g.restart(); snap("restart -> attract (reset)");
  final g2 = Breakout.create(); g2.start(); g2.launch_ball(1.0,-1.0); g2.ball_fell_off();
  for (var i=0;i<32;i++) g2.tick(DT); final rpb = mU(g2.ball_respawn_progress()); g2.pause();
  for (var i=0;i<128;i++) g2.tick(DT); g2.resume(); final rpa = mU(g2.ball_respawn_progress());
  print("PAUSE respawn frozen: before=$rpb after=$rpa ball=${g2.ball_state()} (paused ticks must not advance the ball)");
  final g3 = Breakout.create(); g3.start();
  print("BRICK is_broken: fresh0=${g3.is_brick_broken(0)} oobNeg=${g3.is_brick_broken(-1)} oobBig=${g3.is_brick_broken(999)} (expect false, true, true)");
}
