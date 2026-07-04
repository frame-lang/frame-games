-- Pac-Man cross-language oracle — Lua driver. Mirrors run-oracle.mjs
-- step-for-step; output must byte-match expected-trace.txt.
local M = require("pacman")
local GhostGame = M.GhostGame or GhostGame
local Ghost = M.Ghost or Ghost

local DT = 1.0 / 64.0
local step = 0
local g

local function pad(s, w)
  while #s < w do s = s .. " " end
  return s
end

local function snap(label)
  local gs = {"-", "-", "-", "-"}
  local flags = {"--", "--", "--", "--"}
  local n = g:ghost_count()
  for i = 0, n - 1 do
    gs[i + 1] = g:ghost_state(i)
    local d = g:ghost_is_dangerous(i) and "D" or "."
    local e = g:ghost_is_edible(i) and "E" or "."
    flags[i + 1] = d .. e
  end
  print(string.format("%03d %s phase=%s fright=%7.3f score=%4d g=[%s %s %s %s] f=[%s %s %s %s]",
    step, pad(label, 28), pad(g:get_phase(), 10),
    g:frighten_seconds_left(), g:get_score(),
    pad(gs[1], 10), pad(gs[2], 10), pad(gs[3], 10), pad(gs[4], 10),
    flags[1], flags[2], flags[3], flags[4]))
  step = step + 1
end

local function tick(n, label)
  for _ = 1, n do g:tick(DT) end
  snap(string.format("tick x%d (%s)", n, label))
end

g = GhostGame._create()
local names = {"blinky", "pinky", "inky", "clyde"}
local corners = {{x=680,y=40},{x=40,y=40},{x=680,y=440},{x=40,y=440}}

snap("created")
for i = 1, 4 do g:add_ghost(Ghost._create(names[i], corners[i], i - 1)) end
snap("add_ghost x4")
g:start()
snap("start")

tick(64, "1.0s: pen not due")
tick(80, "2.25s: 1st release")
tick(128, "4.25s: 2nd release")
tick(128, "6.25s: 3rd release")
tick(64, "7.25s: scatter(7s) over")

g:power_pellet_picked_up()
snap("pellet during CHASE (push)")
tick(64, "1.0s frightened")
g:ghost_caught(0)
snap("caught blinky (+200)")
g:ghost_caught(0)
snap("caught blinky again (no-op)")
g:ghost_caught(1)
snap("caught pinky (+200)")
tick(64, "2.0s frightened")
g:ghost_arrived_at_pen(0)
snap("blinky arrived at pen")
tick(256, "6.0s: frighten expires")
tick(64, "chase resumed 1.0s")

g:power_pellet_picked_up()
snap("pellet during CHASE #2 (push)")
g:power_pellet_picked_up()
snap("pellet WHILE frightened (re-enter)")
tick(320, "5.0s of re-frighten")
tick(96, "6.5s total: expires again")

tick(1152, "chase(20s) over -> scatter")
g:power_pellet_picked_up()
snap("pellet during SCATTER (push)")
tick(416, "6.5s: expires -> scatter")
tick(320, "scatter(5s) over -> chase")

snap("final")
