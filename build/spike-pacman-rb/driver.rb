# Pac-Man cross-language oracle — Ruby driver. Mirrors run-oracle.mjs
# step-for-step; output must byte-match expected-trace.txt.
require_relative "pacman"

DT = 1.0 / 64.0
$g = GhostGame._create
$step = 0
NAMES = %w[blinky pinky inky clyde]
CORNERS = [{"x" => 680, "y" => 40}, {"x" => 40, "y" => 40}, {"x" => 680, "y" => 440}, {"x" => 40, "y" => 440}]

def snap(label)
  gs = []
  flags = []
  n = $g.ghost_count
  (0...n).each do |i|
    gs << $g.ghost_state(i)
    flags << (($g.ghost_is_dangerous(i) ? "D" : ".") + ($g.ghost_is_edible(i) ? "E" : "."))
  end
  gs << "-" while gs.length < 4
  flags << "--" while flags.length < 4
  printf("%03d %s phase=%s fright=%7.3f score=%4d g=[%s] f=[%s]\n",
         $step, label.ljust(28), $g.get_phase.ljust(10),
         $g.frighten_seconds_left, $g.get_score,
         gs.map { |s| s.ljust(10) }.join(" "), flags.join(" "))
  $step += 1
end

def tick(n, label)
  n.times { $g.tick(DT) }
  snap("tick x#{n} (#{label})")
end

snap("created")
4.times { |i| $g.add_ghost(Ghost._create(NAMES[i], CORNERS[i], i)) }
snap("add_ghost x4")
$g.start
snap("start")

tick(64, "1.0s: pen not due")
tick(80, "2.25s: 1st release")
tick(128, "4.25s: 2nd release")
tick(128, "6.25s: 3rd release")
tick(64, "7.25s: scatter(7s) over")

$g.power_pellet_picked_up
snap("pellet during CHASE (push)")
tick(64, "1.0s frightened")
$g.ghost_caught(0)
snap("caught blinky (+200)")
$g.ghost_caught(0)
snap("caught blinky again (no-op)")
$g.ghost_caught(1)
snap("caught pinky (+200)")
tick(64, "2.0s frightened")
$g.ghost_arrived_at_pen(0)
snap("blinky arrived at pen")
tick(256, "6.0s: frighten expires")
tick(64, "chase resumed 1.0s")

$g.power_pellet_picked_up
snap("pellet during CHASE #2 (push)")
$g.power_pellet_picked_up
snap("pellet WHILE frightened (re-enter)")
tick(320, "5.0s of re-frighten")
tick(96, "6.5s total: expires again")

tick(1152, "chase(20s) over -> scatter")
$g.power_pellet_picked_up
snap("pellet during SCATTER (push)")
tick(416, "6.5s: expires -> scatter")
tick(320, "scatter(5s) over -> chase")

snap("final")
