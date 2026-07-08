require_relative "invaders"

DT = 1.0 / 64.0
$step = 0
$g = nil

def ivus; (($g.fleet.get_step_interval) * 1e6).round; end
def pad(s, w); s = s.to_s; s.length < w ? s + " " * (w - s.length) : s; end
def lpad(s, w); s = s.to_s; s.length < w ? " " * (w - s.length) + s : s; end
def snap(label)
  fl = $g.fleet
  puts format("%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d",
    $step, pad(label, 34), pad($g.get_state, 13), lpad($g.get_score, 4), $g.get_wave, $g.get_lives,
    pad(fl.get_state, 9), lpad(fl.get_direction, 2), lpad(fl.alive_count, 2), lpad(fl.total, 2),
    lpad(ivus, 6), lpad(fl.lowest_row, 2), pad($g.player.get_state, 12), $g.is_paused ? 1 : 0)
  $step += 1
end
def run(n, label); n.times { $g.tick(DT) }; snap("pump x#{n} (#{label})"); end

$g = Invaders._create
snap("created")
$g.start
snap("start -> playing (fleet 55, iv=600000)")
puts "OP  get_current_state_name=#{$g.get_current_state_name}"

run(39, "0.61s: fleet wants_to_step")
puts "SIG consume_step=#{$g.fleet.consume_step ? 'true' : 'false'} (timer was >= interval)"

$g.player_killed_invader(0)
snap("kill idx0 (+10, pace up)")
$g.player_killed_invader(1)
$g.player_killed_invader(2)
snap("kill idx1,2 (+20 more)")
$g.player_killed_invader(1)
$g.player_killed_invader(999)
$g.player_killed_invader(-1)
snap("kill dead/oob idx: NO score change")

$g.fleet_reached_edge
snap("fleet_reached_edge -> stepping, dir flip")
run(1, "one tick: stepping -> marching")

$g.pause
snap("pause during PLAYING (push)")
run(64, "1.0s paused: fleet+player frozen")
$g.resume
snap("resume (pop -> playing)")

(3...55).each { |i| $g.player_killed_invader(i) }
snap("cleared fleet -> wave_complete")

$g.pause
snap("pause during WAVE_COMPLETE (push)")
run(64, "1.0s paused: wave timer frozen")
$g.resume
snap("resume (pop -> wave_complete)")

run(129, "2.0s: wave 2 begins, fleet reset")

$g.player_hit
snap("player_hit -> player_dying")
$g.player_hit
snap("player_hit while exploding: NO-OP")

$g.pause
snap("pause during PLAYER_DYING (push)")
run(64, "1.0s paused: explosion timer frozen")
$g.resume
snap("resume (pop -> player_dying)")

run(77, "1.2s: lives-1, invuln, -> playing")
run(96, "1.5s: invuln over -> alive")

$g.fleet_reached_bottom
snap("fleet_reached_bottom -> game_over")
$g.restart
snap("restart -> attract (reset)")

g2 = Invaders._create
g2.start
3.times { g2.player_hit; 180.times { g2.tick(DT) } }
puts "DEATH after 3 hits: st=#{g2.get_state} lives=#{g2.get_lives} player=#{g2.player.get_state}"

g3 = Invaders._create
g3.start
d0 = g3.fleet.get_direction
g3.fleet_reached_edge; g3.tick(DT)
d1 = g3.fleet.get_direction
g3.fleet_reached_edge; g3.tick(DT)
d2 = g3.fleet.get_direction
puts "DIR bounces: start=#{d0} after1=#{d1} after2=#{d2}"
