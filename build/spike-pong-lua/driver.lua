local M = require("pong")
local Pong = M.Pong
local step = 0
local g
local function bU(x) if x then return 1 else return 0 end end
local function padr(s, w) s = tostring(s); while #s < w do s = s .. " " end return s end
local function padl(s, w) s = tostring(s); while #s < w do s = " " .. s end return s end
local function snap(label)
  print(string.format("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s",
    step, padr(label, 38), padr(g:get_current_state_name(), 12), padl(g:get_score_left(), 2), padl(g:get_score_right(), 2),
    padl(g:get_serve_direction(), 2), bU(g:is_playing()), padr(g:get_winner(), 6)))
  step = step + 1
end
local function point_right(x) x = x or g; x:launch(); x:ball_out_left() end
local function point_left(x) x = x or g; x:launch(); x:ball_out_right() end

g = Pong._create()
snap("created (AttractMode / 0-0)")
print("OP  get_current_state_name=" .. g:get_current_state_name() .. " get_winning_score=" .. g:get_winning_score())

g:start(); snap("start -> Serving")
g:pause(); snap("pause during Serving (push)")
g:resume(); snap("resume (pop -> Serving)")
g:launch(); snap("launch -> InPlay (playing)")
g:pause(); snap("pause during InPlay (push)")
g:resume(); snap("resume (pop -> InPlay)")
g:ball_out_left(); snap("ball_out_left -> right+1, serve -1")
point_left(); snap("pointLeft -> left+1, serve +1")
for _ = 1, 9 do point_right() end
snap("right at 10 (one short of 11)")
point_right(); snap("right scores 11 -> GameOver [right wins]")
print(string.format("WIN winner=%s playing=%d sl=%d sr=%d", g:get_winner(), bU(g:is_playing()), g:get_score_left(), g:get_score_right()))
g:restart(); snap("restart -> AttractMode (reset)")

local g2 = Pong._create()
g2:start()
for _ = 1, 11 do point_left(g2) end
print(string.format("MIRROR left win: st=%s winner=%s sl=%d serve=%d", g2:get_current_state_name(), g2:get_winner(), g2:get_score_left(), g2:get_serve_direction()))
