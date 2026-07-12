import 'pong.dart';

int step = 0;
late Pong g;

int bU(bool x) => x ? 1 : 0;
String padr(String s, int w) { while (s.length < w) s += ' '; return s; }
String lpad(Object o, int w) { var s = o.toString(); while (s.length < w) s = ' ' + s; return s; }

void snap(String label) {
  print(
      '${step.toString().padLeft(3, '0')} ${padr(label, 38)} '
      'st=${padr(g.get_current_state_name(), 12)} sl=${lpad(g.get_score_left(), 2)} sr=${lpad(g.get_score_right(), 2)} '
      'serve=${lpad(g.get_serve_direction(), 2)} play=${bU(g.is_playing())} winner=${padr(g.get_winner(), 6)}');
  step++;
}
void pointRight(Pong x) { x.launch(); x.ball_out_left(); }
void pointLeft(Pong x) { x.launch(); x.ball_out_right(); }

void main() {
  g = Pong.create();
  snap("created (AttractMode / 0-0)");
  print("OP  get_current_state_name=${g.get_current_state_name()} get_winning_score=${g.get_winning_score()}");

  g.start(); snap("start -> Serving");
  g.pause(); snap("pause during Serving (push)");
  g.resume(); snap("resume (pop -> Serving)");
  g.launch(); snap("launch -> InPlay (playing)");
  g.pause(); snap("pause during InPlay (push)");
  g.resume(); snap("resume (pop -> InPlay)");
  g.ball_out_left(); snap("ball_out_left -> right+1, serve -1");
  pointLeft(g); snap("pointLeft -> left+1, serve +1");
  for (var i = 0; i < 9; i++) pointRight(g);
  snap("right at 10 (one short of 11)");
  pointRight(g); snap("right scores 11 -> GameOver [right wins]");
  print("WIN winner=${g.get_winner()} playing=${bU(g.is_playing())} sl=${g.get_score_left()} sr=${g.get_score_right()}");
  g.restart(); snap("restart -> AttractMode (reset)");

  var g2 = Pong.create();
  g2.start();
  for (var i = 0; i < 11; i++) pointLeft(g2);
  print("MIRROR left win: st=${g2.get_current_state_name()} winner=${g2.get_winner()} sl=${g2.get_score_left()} serve=${g2.get_serve_direction()}");
}
