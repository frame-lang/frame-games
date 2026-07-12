local M = require("platformer")
local Platformer = M.Platformer
local DT = 1.0 / 64.0
local step = 0
local g
local function mU(x) return math.floor(x * 1000 + 0.5) end
local function bU(x) if x then return 1 else return 0 end end
local function padr(s, w) s = tostring(s); while #s < w do s = s .. " " end return s end
local function padl(s, w) s = tostring(s); while #s < w do s = " " .. s end return s end
local function snap(label)
  print(string.format("%03d %s st=%s loco=%s form=%s vx=%s face=%s gnd=%d air=%d jimp=%d hbox=%s shoot=%d paused=%d",
    step, padr(label, 40), padr(g:get_current_state_name(), 7), padr(g:locomotion_state(), 8), padr(g:form(), 5),
    padl(mU(g:wants_velocity_x()), 7), padl(g:facing(), 2),
    bU(g:is_grounded()), bU(g:is_in_air()), bU(g:wants_jump_impulse()),
    padl(g:hit_box_height(), 2), bU(g:can_shoot()), bU(g:is_paused())))
  step = step + 1
end
local function run(n, label) for _ = 1, n do g:tick(DT) end snap(string.format("pump x%d (%s)", n, label)) end

g = Platformer._create()
snap("created (Playing / idle / small)")
print("OP  get_current_state_name=" .. g:get_current_state_name())

g:press_right()
snap("press_right -> walking, face+1")
g:press_sprint()
snap("press_sprint -> running (vx 260)")
g:release_sprint()
snap("release_sprint -> walking (vx 140)")
g:press_left()
snap("press_left -> face-1, vx -140")
g:release_horizontal()
snap("release_horizontal -> idle")

g:press_jump()
snap("press_jump -> jumping, jimp=1")
g:consume_jump_impulse()
snap("consume_jump_impulse -> jimp=0")
g:press_right()
snap("press_right in air -> vx 180 (air_speed)")
run(22, "0.34s held: still jumping")
run(1, "tick 23 (0.35s) -> falling")

g:ground_contact()
snap("ground_contact -> landing")
run(5, "0.078s: still landing")
run(1, "tick 6 (0.08s): input_x!=0 -> walking")
g:release_horizontal()
snap("release_horizontal -> idle")

g:press_jump()
snap("press_jump -> jumping (fresh)")
g:release_jump()
snap("release_jump -> timer frozen")
run(40, "0.625s released: STILL jumping (no auto-fall)")
g:ground_contact()
snap("ground_contact -> landing (input_x=0)")
run(6, "0.08s: input_x==0 -> idle")

g:left_ground()
snap("left_ground -> falling (walked off)")
g:ground_contact()
snap("ground_contact -> landing")
run(6, "recover -> idle")

g:pickup_mushroom()
snap("pickup_mushroom -> big (hbox 48)")
g:pickup_flower()
snap("pickup_flower -> fiery (can_shoot 1)")
g:take_damage()
snap("take_damage -> big [ret-then-transition]")
g:take_damage()
snap("take_damage -> small (hbox 24)")
g:take_damage()
snap("take_damage in small -> no transition")
g:pickup_flower()
snap("pickup_flower from small -> fiery")

print(string.format("RET take_damage(fiery)=%d form_now=%s (expect 1 / big)", bU(g:take_damage()), g:form()))
print(string.format("RET take_damage(big)=%d form_now=%s (expect 1 / small)", bU(g:take_damage()), g:form()))
print(string.format("RET take_damage(small)=%d form_now=%s (expect 0 / small)", bU(g:take_damage()), g:form()))

g:pickup_mushroom()
g:press_right()
snap("re-arm: big + walking before pause")
g:pause()
snap("pause -> Paused (push), paused=1")
run(64, "1.0s paused: locomotion frozen")
g:resume()
snap("resume -> Playing (pop), paused=0")

local g2 = Platformer._create()
g2:press_right()
g2:press_sprint()
local loco_before = g2:locomotion_state()
g2:pickup_mushroom()
g2:pickup_flower()
local loco_after = g2:locomotion_state()
print(string.format("ORTHO loco stable across powerups: before=%s after=%s form=%s (expect running/running/fiery)", loco_before, loco_after, g2:form()))

local g3 = Platformer._create()
g3:press_jump()
for _ = 1, 10 do g3:tick(DT) end
g3:pause()
for _ = 1, 128 do g3:tick(DT) end
g3:resume()
local loco_resumed = g3:locomotion_state()
for _ = 1, 12 do g3:tick(DT) end
local still_jumping = g3:locomotion_state()
g3:tick(DT)
local now_falling = g3:locomotion_state()
print(string.format("PAUSE ticks dropped: resumed=%s at22=%s at23=%s (expect jumping/jumping/falling)", loco_resumed, still_jumping, now_falling))
