require_relative "breakout"
DT = 1.0 / 64.0
$step = 0
$g = nil
def mU(x); (x * 1000).round; end
def padr(s, w); s = s.to_s; s.length < w ? s + " " * (w - s.length) : s; end
def padl(s, w); s = s.to_s; s.length < w ? " " * (w - s.length) + s : s; end
def snap(label)
  rp = $g.get_state == "playing" ? padl(mU($g.ball_respawn_progress), 4) : padl("-", 4)
  puts format("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s",
    $step, padr(label, 34), padr($g.get_state, 11), padl($g.get_score, 4), $g.get_lives, $g.get_level,
    padl($g.bricks_remaining, 2), padr($g.ball_state, 9), padl(mU($g.ball_vx), 6), padl(mU($g.ball_vy), 6), rp)
  $step += 1
end
def run(n, label); n.times { $g.tick(DT) }; snap("pump x#{n} (#{label})"); end

$g = Breakout._create
snap("created")
$g.start
snap("start -> playing, ball attached")
puts "OP  get_current_state_name=#{$g.get_current_state_name}"
$g.launch_ball(3.5, -4.25)
snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]")
$g.wall_bounce_x
snap("wall_bounce_x -> vx negated")
$g.wall_bounce_y
snap("wall_bounce_y -> vy negated")
$g.paddle_hit(2.75, -5.5)
snap("paddle_hit -> set_velocity(2.75,-5.5)")
$g.brick_hit(0)
snap("brick_hit(0): +10, vy flip, broken")
$g.brick_hit(0); $g.brick_hit(999); $g.brick_hit(-1)
snap("brick_hit dead/oob: NO score change")
$g.brick_hit(1); $g.brick_hit(2)
snap("brick_hit(1,2): +20")
$g.pause
snap("pause during PLAYING (push)")
run(64, "1.0s paused: ball frozen")
$g.resume
snap("resume (pop -> playing)")
$g.ball_fell_off
snap("ball_fell_off -> lives-1, ball lost")
run(64, "1.0s: respawn progress ~0.5")
run(63, "just before 2.0s: still lost")
run(1, "tick 2.0s: ball -> attached")
$g.launch_ball(3.5, -4.25)
snap("re-launch (fresh in_flight)")
(3...40).each { |i| $g.brick_hit(i) }
snap("cleared wall -> level_clear (lvl 2)")
$g.start
snap("start -> playing, fresh wall of 40")
$g.ball_fell_off
snap("fell off -> lives 1")
$g.ball_fell_off
snap("fell off -> lives 0 -> game_over")
$g.restart
snap("restart -> attract (reset)")

g2 = Breakout._create
g2.start
g2.launch_ball(1.0, -1.0)
g2.ball_fell_off
32.times { g2.tick(DT) }
rp_before = (g2.ball_respawn_progress * 1000).round
g2.pause
128.times { g2.tick(DT) }
g2.resume
rp_after = (g2.ball_respawn_progress * 1000).round
puts "PAUSE respawn frozen: before=#{rp_before} after=#{rp_after} ball=#{g2.ball_state} (paused ticks must not advance the ball)"

g3 = Breakout._create
g3.start
puts "BRICK is_broken: fresh0=#{g3.is_brick_broken(0)} oobNeg=#{g3.is_brick_broken(-1)} oobBig=#{g3.is_brick_broken(999)} (expect false, true, true)"
