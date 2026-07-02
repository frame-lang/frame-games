require_relative "asteroids"
$log = []
class Host
  def warp_out; $log << "warp_out"; end
  def warp_in; $log << "warp_in"; end
  def spawn_explosion; $log << "spawn_explosion"; end
  def reset_ship; $log << "reset_ship"; end
end
g = AsteroidsGame._create(Host.new, 2)
puts "init: #{g.get_current_state_name} lives #{g.get_lives} wave #{g.get_wave} diff #{g.get_difficulty}"
g.start
puts "start: #{g.get_current_state_name} count #{g.field.count} alive #{g.field.alive_count}"
court = g.last_court_size
3.times { g.tick(0.016, court) }
before = g.get_score; g.bullet_hit_asteroid(0)
puts "split0: score #{before} -> #{g.get_score} count #{g.field.count} alive #{g.field.alive_count}"
g.ship_hyperspace
30.times { g.tick(0.016, court) }
puts "hyper: ship #{g.ship.get_current_state_name} warps #{g.ship.get_hyperspaces_remaining} host #{$log.inspect}"
g.pause; p = g.is_paused; g.resume
puts "pause/resume: #{p} -> #{g.is_paused}"
puts "RB SMOKE OK"
