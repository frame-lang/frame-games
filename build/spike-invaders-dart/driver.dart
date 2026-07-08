import 'invaders.dart';

const DT = 1.0 / 64.0;
int step = 0;
late Invaders g;

int ivus() => (g.fleet.get_step_interval() * 1e6).round();
String padr(String s, int w) => s.length < w ? s + ' ' * (w - s.length) : s;
String padl(Object o, int w) { var s = '$o'; return s.length < w ? ' ' * (w - s.length) + s : s; }
void snap(String label) {
  final fl = g.fleet;
  print('${step.toString().padLeft(3, '0')} ${padr(label, 34)} '
      'st=${padr(g.get_state(), 13)} sc=${padl(g.get_score(), 4)} wv=${g.get_wave()} lv=${g.get_lives()} | '
      'fl=${padr(fl.get_state(), 9)} dir=${padl(fl.get_direction(), 2)} al=${padl(fl.alive_count(), 2)}/${padl(fl.total(), 2)} '
      'iv=${padl(ivus(), 6)} lr=${padl(fl.lowest_row(), 2)} | '
      'pl=${padr(g.player.get_state(), 12)} pz=${g.is_paused() ? 1 : 0}');
  step++;
}
void run(int n, String label) { for (var i = 0; i < n; i++) g.tick(DT); snap('pump x$n ($label)'); }

void main() {
  g = Invaders.create();
  snap("created");
  g.start();
  snap("start -> playing (fleet 55, iv=600000)");
  print("OP  get_current_state_name=${g.get_current_state_name()}");

  run(39, "0.61s: fleet wants_to_step");
  print("SIG consume_step=${g.fleet.consume_step() ? 'true' : 'false'} (timer was >= interval)");

  g.player_killed_invader(0);
  snap("kill idx0 (+10, pace up)");
  g.player_killed_invader(1);
  g.player_killed_invader(2);
  snap("kill idx1,2 (+20 more)");
  g.player_killed_invader(1);
  g.player_killed_invader(999);
  g.player_killed_invader(-1);
  snap("kill dead/oob idx: NO score change");

  g.fleet_reached_edge();
  snap("fleet_reached_edge -> stepping, dir flip");
  run(1, "one tick: stepping -> marching");

  g.pause();
  snap("pause during PLAYING (push)");
  run(64, "1.0s paused: fleet+player frozen");
  g.resume();
  snap("resume (pop -> playing)");

  for (var i = 3; i < 55; i++) g.player_killed_invader(i);
  snap("cleared fleet -> wave_complete");

  g.pause();
  snap("pause during WAVE_COMPLETE (push)");
  run(64, "1.0s paused: wave timer frozen");
  g.resume();
  snap("resume (pop -> wave_complete)");

  run(129, "2.0s: wave 2 begins, fleet reset");

  g.player_hit();
  snap("player_hit -> player_dying");
  g.player_hit();
  snap("player_hit while exploding: NO-OP");

  g.pause();
  snap("pause during PLAYER_DYING (push)");
  run(64, "1.0s paused: explosion timer frozen");
  g.resume();
  snap("resume (pop -> player_dying)");

  run(77, "1.2s: lives-1, invuln, -> playing");
  run(96, "1.5s: invuln over -> alive");

  g.fleet_reached_bottom();
  snap("fleet_reached_bottom -> game_over");
  g.restart();
  snap("restart -> attract (reset)");

  final g2 = Invaders.create();
  g2.start();
  for (var life = 0; life < 3; life++) { g2.player_hit(); for (var i = 0; i < 180; i++) g2.tick(DT); }
  print("DEATH after 3 hits: st=${g2.get_state()} lives=${g2.get_lives()} player=${g2.player.get_state()}");

  final g3 = Invaders.create();
  g3.start();
  final d0 = g3.fleet.get_direction();
  g3.fleet_reached_edge(); g3.tick(DT);
  final d1 = g3.fleet.get_direction();
  g3.fleet_reached_edge(); g3.tick(DT);
  final d2 = g3.fleet.get_direction();
  print("DIR bounces: start=$d0 after1=$d1 after2=$d2");
}
