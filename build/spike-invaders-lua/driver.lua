local M = require("invaders")
local Invaders = M.Invaders

local DT = 1.0 / 64.0
local step = 0
local g

local function padr(s, w) s = tostring(s); while #s < w do s = s .. " " end return s end
local function padl(s, w) s = tostring(s); while #s < w do s = " " .. s end return s end
local function iv() return math.floor(g.fleet:get_step_interval() * 1e6 + 0.5) end
local function snap(label)
  local fl = g.fleet
  print(string.format("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d",
    step, padr(label, 34), padr(g:get_state(), 13), padl(g:get_score(), 4), g:get_wave(), g:get_lives(),
    padr(fl:get_state(), 9), padl(fl:get_direction(), 2), padl(fl:alive_count(), 2), padl(fl:total(), 2),
    padl(iv(), 6), padl(fl:lowest_row(), 2), padr(g.player:get_state(), 12), g:is_paused() and 1 or 0))
  step = step + 1
end
local function run(n, label) for _ = 1, n do g:tick(DT) end snap(string.format("pump x%d (%s)", n, label)) end

g = Invaders._create()
snap("created")
g:start()
snap("start -> playing (fleet 55, iv=600000)")
print("OP  get_current_state_name=" .. g:get_current_state_name())

run(39, "0.61s: fleet wants_to_step")
print("SIG consume_step=" .. (g.fleet:consume_step() and "true" or "false") .. " (timer was >= interval)")

g:player_killed_invader(0)
snap("kill idx0 (+10, pace up)")
g:player_killed_invader(1)
g:player_killed_invader(2)
snap("kill idx1,2 (+20 more)")
g:player_killed_invader(1)
g:player_killed_invader(999)
g:player_killed_invader(-1)
snap("kill dead/oob idx: NO score change")

g:fleet_reached_edge()
snap("fleet_reached_edge -> stepping, dir flip")
run(1, "one tick: stepping -> marching")

g:pause()
snap("pause during PLAYING (push)")
run(64, "1.0s paused: fleet+player frozen")
g:resume()
snap("resume (pop -> playing)")

for i = 3, 54 do g:player_killed_invader(i) end
snap("cleared fleet -> wave_complete")

g:pause()
snap("pause during WAVE_COMPLETE (push)")
run(64, "1.0s paused: wave timer frozen")
g:resume()
snap("resume (pop -> wave_complete)")

run(129, "2.0s: wave 2 begins, fleet reset")

g:player_hit()
snap("player_hit -> player_dying")
g:player_hit()
snap("player_hit while exploding: NO-OP")

g:pause()
snap("pause during PLAYER_DYING (push)")
run(64, "1.0s paused: explosion timer frozen")
g:resume()
snap("resume (pop -> player_dying)")

run(77, "1.2s: lives-1, invuln, -> playing")
run(96, "1.5s: invuln over -> alive")

g:fleet_reached_bottom()
snap("fleet_reached_bottom -> game_over")
g:restart()
snap("restart -> attract (reset)")

local g2 = Invaders._create()
g2:start()
for _ = 1, 3 do g2:player_hit(); for _ = 1, 180 do g2:tick(DT) end end
print(string.format("DEATH after 3 hits: st=%s lives=%d player=%s", g2:get_state(), g2:get_lives(), g2.player:get_state()))

local g3 = Invaders._create()
g3:start()
local d0 = g3.fleet:get_direction()
g3:fleet_reached_edge(); g3:tick(DT)
local d1 = g3.fleet:get_direction()
g3:fleet_reached_edge(); g3:tick(DT)
local d2 = g3.fleet:get_direction()
print(string.format("DIR bounces: start=%d after1=%d after2=%d", d0, d1, d2))
