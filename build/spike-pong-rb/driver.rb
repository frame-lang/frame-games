require_relative "pong"
$step = 0
$g = nil
def bU(x); x ? 1 : 0; end
def padr(s, w); s = s.to_s; s.length < w ? s + " " * (w - s.length) : s; end
def padl(s, w); s = s.to_s; s.length < w ? " " * (w - s.length) + s : s; end
def snap(label)
  puts format("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s",
    $step, padr(label, 38), padr($g.get_current_state_name, 12), padl($g.get_score_left, 2), padl($g.get_score_right, 2),
    padl($g.get_serve_direction, 2), bU($g.is_playing), padr($g.get_winner, 6))
  $step += 1
end
def point_right(x = $g); x.launch; x.ball_out_left; end
def point_left(x = $g); x.launch; x.ball_out_right; end

$g = Pong._create
snap("created (AttractMode / 0-0)")
puts "OP  get_current_state_name=#{$g.get_current_state_name} get_winning_score=#{$g.get_winning_score}"

$g.start; snap("start -> Serving")
$g.pause; snap("pause during Serving (push)")
$g.resume; snap("resume (pop -> Serving)")
$g.launch; snap("launch -> InPlay (playing)")
$g.pause; snap("pause during InPlay (push)")
$g.resume; snap("resume (pop -> InPlay)")
$g.ball_out_left; snap("ball_out_left -> right+1, serve -1")
point_left; snap("pointLeft -> left+1, serve +1")
9.times { point_right }
snap("right at 10 (one short of 11)")
point_right; snap("right scores 11 -> GameOver [right wins]")
puts "WIN winner=#{$g.get_winner} playing=#{bU($g.is_playing)} sl=#{$g.get_score_left} sr=#{$g.get_score_right}"
$g.restart; snap("restart -> AttractMode (reset)")

g2 = Pong._create
g2.start
11.times { point_left(g2) }
puts "MIRROR left win: st=#{g2.get_current_state_name} winner=#{g2.get_winner} sl=#{g2.get_score_left} serve=#{g2.get_serve_direction}"
