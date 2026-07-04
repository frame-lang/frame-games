// Pac-Man cross-language oracle — Dart driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
import 'pacman.dart';

const dt = 1.0 / 64.0;
int step = 0;
late GhostGame g;

String pad(String s, int w) => s.length >= w ? s : s.padRight(w);

void snap(String label) {
  final gs = ['-', '-', '-', '-'];
  final flags = ['--', '--', '--', '--'];
  final n = g.ghost_count();
  for (var i = 0; i < n; i++) {
    gs[i] = g.ghost_state(i);
    flags[i] = (g.ghost_is_dangerous(i) ? 'D' : '.') + (g.ghost_is_edible(i) ? 'E' : '.');
  }
  final stepStr = step.toString().padLeft(3, '0');
  final fright = g.frighten_seconds_left().toStringAsFixed(3).padLeft(7);
  final score = g.get_score().toString().padLeft(4);
  print('$stepStr ${pad(label, 28)} phase=${pad(g.get_phase(), 10)} fright=$fright score=$score '
      'g=[${pad(gs[0], 10)} ${pad(gs[1], 10)} ${pad(gs[2], 10)} ${pad(gs[3], 10)}] '
      'f=[${flags[0]} ${flags[1]} ${flags[2]} ${flags[3]}]');
  step++;
}

void tick(int n, String label) {
  for (var i = 0; i < n; i++) {
    g.tick(dt);
  }
  snap('tick x$n ($label)');
}

void main() {
  g = GhostGame.create();
  final names = ['blinky', 'pinky', 'inky', 'clyde'];
  final corners = [Vector2(680, 40), Vector2(40, 40), Vector2(680, 440), Vector2(40, 440)];

  snap('created');
  for (var i = 0; i < 4; i++) {
    g.add_ghost(Ghost.create(names[i], corners[i], i));
  }
  snap('add_ghost x4');
  g.start();
  snap('start');

  tick(64, '1.0s: pen not due');
  tick(80, '2.25s: 1st release');
  tick(128, '4.25s: 2nd release');
  tick(128, '6.25s: 3rd release');
  tick(64, '7.25s: scatter(7s) over');

  g.power_pellet_picked_up();
  snap('pellet during CHASE (push)');
  tick(64, '1.0s frightened');
  g.ghost_caught(0);
  snap('caught blinky (+200)');
  g.ghost_caught(0);
  snap('caught blinky again (no-op)');
  g.ghost_caught(1);
  snap('caught pinky (+200)');
  tick(64, '2.0s frightened');
  g.ghost_arrived_at_pen(0);
  snap('blinky arrived at pen');
  tick(256, '6.0s: frighten expires');
  tick(64, 'chase resumed 1.0s');

  g.power_pellet_picked_up();
  snap('pellet during CHASE #2 (push)');
  g.power_pellet_picked_up();
  snap('pellet WHILE frightened (re-enter)');
  tick(320, '5.0s of re-frighten');
  tick(96, '6.5s total: expires again');

  tick(1152, 'chase(20s) over -> scatter');
  g.power_pellet_picked_up();
  snap('pellet during SCATTER (push)');
  tick(416, '6.5s: expires -> scatter');
  tick(320, 'scatter(5s) over -> chase');

  snap('final');
}
