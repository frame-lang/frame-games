# Pac-Man cross-language oracle — Python driver. Mirrors run-oracle.mjs
# step-for-step; output must byte-match expected-trace.txt.
from pacman import GhostGame, Ghost

DT = 1.0 / 64.0
g = GhostGame._create()
names = ["blinky", "pinky", "inky", "clyde"]
corners = [{"x": 680, "y": 40}, {"x": 40, "y": 40}, {"x": 680, "y": 440}, {"x": 40, "y": 440}]

step = 0

def snap(label):
    global step
    gs, flags = [], []
    n = g.ghost_count()
    for i in range(n):
        gs.append(g.ghost_state(i))
        flags.append(("D" if g.ghost_is_dangerous(i) else ".") + ("E" if g.ghost_is_edible(i) else "."))
    while len(gs) < 4:
        gs.append("-")
    while len(flags) < 4:
        flags.append("--")
    print(f"{step:03d} {label.ljust(28)} phase={g.get_phase().ljust(10)} "
          f"fright={g.frighten_seconds_left():7.3f} score={g.get_score():4d} "
          f"g=[{' '.join(s.ljust(10) for s in gs)}] f=[{' '.join(flags)}]")
    step += 1

def tick(n, label):
    for _ in range(n):
        g.tick(DT)
    snap(f"tick x{n} ({label})")

snap("created")
for i in range(4):
    g.add_ghost(Ghost._create(names[i], corners[i], i))
snap("add_ghost x4")
g.start()
snap("start")

tick(64, "1.0s: pen not due")
tick(80, "2.25s: 1st release")
tick(128, "4.25s: 2nd release")
tick(128, "6.25s: 3rd release")
tick(64, "7.25s: scatter(7s) over")

g.power_pellet_picked_up()
snap("pellet during CHASE (push)")
tick(64, "1.0s frightened")
g.ghost_caught(0)
snap("caught blinky (+200)")
g.ghost_caught(0)
snap("caught blinky again (no-op)")
g.ghost_caught(1)
snap("caught pinky (+200)")
tick(64, "2.0s frightened")
g.ghost_arrived_at_pen(0)
snap("blinky arrived at pen")
tick(256, "6.0s: frighten expires")
tick(64, "chase resumed 1.0s")

g.power_pellet_picked_up()
snap("pellet during CHASE #2 (push)")
g.power_pellet_picked_up()
snap("pellet WHILE frightened (re-enter)")
tick(320, "5.0s of re-frighten")
tick(96, "6.5s total: expires again")

tick(1152, "chase(20s) over -> scatter")
g.power_pellet_picked_up()
snap("pellet during SCATTER (push)")
tick(416, "6.5s: expires -> scatter")
tick(320, "scatter(5s) over -> chase")

snap("final")
