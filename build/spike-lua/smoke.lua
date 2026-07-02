math.randomseed(1)
local M = dofile("asteroids.lua")
local log = {}
local host = {
  warp_out = function() log[#log+1]="warp_out" end,
  warp_in = function() log[#log+1]="warp_in" end,
  spawn_explosion = function() log[#log+1]="spawn_explosion" end,
  reset_ship = function() log[#log+1]="reset_ship" end,
}
local g = M.AsteroidsGame._create(host, 2)
print(string.format("init: state=%s lives=%d wave=%d diff=%d", g:get_current_state_name(), g:get_lives(), g:get_wave(), g:get_difficulty()))
g:start()
print(string.format("start: state=%s count=%d alive=%d", g:get_current_state_name(), g.field:count(), g.field:alive_count()))
local court = g.last_court_size
for i=1,3 do g:tick(0.016, court) end
local before = g:get_score()
g:bullet_hit_asteroid(1)
print(string.format("split1: score %d->%d count=%d alive=%d", before, g:get_score(), g.field:count(), g.field:alive_count()))
g:ship_hyperspace()
for i=1,30 do g:tick(0.016, court) end
print(string.format("hyper: ship=%s warps=%d host={%s}", g.ship:get_current_state_name(), g.ship:get_hyperspaces_remaining(), table.concat(log,",")))
g:pause(); local p=g:is_paused(); g:resume()
print(string.format("pause/resume: %s->%s", tostring(p), tostring(g:is_paused())))
print("LUA SMOKE OK")
