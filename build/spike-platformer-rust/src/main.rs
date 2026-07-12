mod platformer; use platformer::*;
const DT: f64 = 1.0 / 64.0;
fn padr(s: &str, w: usize) -> String { let mut o=s.to_string(); while o.chars().count()<w { o.push(' '); } o }
fn padl(s: String, w: usize) -> String { let mut o=s; while o.chars().count()<w { o.insert(0,' '); } o }
fn mu(x: f64) -> i64 { (x*1000.0).round() as i64 }
fn bu(x: bool) -> i32 { if x {1} else {0} }
fn snap(g:&mut Platformer, label:&str, step:&mut i32) {
    println!("{:03} {} st={} loco={} form={} vx={} face={} gnd={} air={} jimp={} hbox={} shoot={} paused={}",
        step, padr(label,40), padr(&g.get_current_state_name(),7), padr(&g.locomotion_state(),8), padr(&g.form(),5),
        padl(mu(g.wants_velocity_x()).to_string(),7), padl(g.facing().to_string(),2),
        bu(g.is_grounded()), bu(g.is_in_air()), bu(g.wants_jump_impulse()),
        padl(g.hit_box_height().to_string(),2), bu(g.can_shoot()), bu(g.is_paused()));
    *step+=1;
}
fn main() {
    let mut step=0; let mut g = Platformer::__create();
    macro_rules! snap { ($l:expr) => { snap(&mut g,$l,&mut step); } }
    macro_rules! run { ($n:expr,$l:expr) => { for _ in 0..$n { g.tick(DT); } snap!(&format!("pump x{} ({})",$n,$l)); } }

    snap!("created (Playing / idle / small)");
    println!("OP  get_current_state_name={}", g.get_current_state_name());

    g.press_right(); snap!("press_right -> walking, face+1");
    g.press_sprint(); snap!("press_sprint -> running (vx 260)");
    g.release_sprint(); snap!("release_sprint -> walking (vx 140)");
    g.press_left(); snap!("press_left -> face-1, vx -140");
    g.release_horizontal(); snap!("release_horizontal -> idle");

    g.press_jump(); snap!("press_jump -> jumping, jimp=1");
    g.consume_jump_impulse(); snap!("consume_jump_impulse -> jimp=0");
    g.press_right(); snap!("press_right in air -> vx 180 (air_speed)");
    run!(22, "0.34s held: still jumping");
    run!(1, "tick 23 (0.35s) -> falling");

    g.ground_contact(); snap!("ground_contact -> landing");
    run!(5, "0.078s: still landing");
    run!(1, "tick 6 (0.08s): input_x!=0 -> walking");
    g.release_horizontal(); snap!("release_horizontal -> idle");

    g.press_jump(); snap!("press_jump -> jumping (fresh)");
    g.release_jump(); snap!("release_jump -> timer frozen");
    run!(40, "0.625s released: STILL jumping (no auto-fall)");
    g.ground_contact(); snap!("ground_contact -> landing (input_x=0)");
    run!(6, "0.08s: input_x==0 -> idle");

    g.left_ground(); snap!("left_ground -> falling (walked off)");
    g.ground_contact(); snap!("ground_contact -> landing");
    run!(6, "recover -> idle");

    g.pickup_mushroom(); snap!("pickup_mushroom -> big (hbox 48)");
    g.pickup_flower(); snap!("pickup_flower -> fiery (can_shoot 1)");
    g.take_damage(); snap!("take_damage -> big [ret-then-transition]");
    g.take_damage(); snap!("take_damage -> small (hbox 24)");
    g.take_damage(); snap!("take_damage in small -> no transition");
    g.pickup_flower(); snap!("pickup_flower from small -> fiery");

    println!("RET take_damage(fiery)={} form_now={} (expect 1 / big)", bu(g.take_damage()), g.form());
    println!("RET take_damage(big)={} form_now={} (expect 1 / small)", bu(g.take_damage()), g.form());
    println!("RET take_damage(small)={} form_now={} (expect 0 / small)", bu(g.take_damage()), g.form());

    g.pickup_mushroom(); g.press_right(); snap!("re-arm: big + walking before pause");
    g.pause(); snap!("pause -> Paused (push), paused=1");
    run!(64, "1.0s paused: locomotion frozen");
    g.resume(); snap!("resume -> Playing (pop), paused=0");

    let mut g2 = Platformer::__create();
    g2.press_right(); g2.press_sprint();
    let loco_before = g2.locomotion_state();
    g2.pickup_mushroom(); g2.pickup_flower();
    let loco_after = g2.locomotion_state();
    println!("ORTHO loco stable across powerups: before={} after={} form={} (expect running/running/fiery)", loco_before, loco_after, g2.form());

    let mut g3 = Platformer::__create();
    g3.press_jump();
    for _ in 0..10 { g3.tick(DT); }
    g3.pause();
    for _ in 0..128 { g3.tick(DT); }
    g3.resume();
    let loco_resumed = g3.locomotion_state();
    for _ in 0..12 { g3.tick(DT); }
    let still_jumping = g3.locomotion_state();
    g3.tick(DT);
    let now_falling = g3.locomotion_state();
    println!("PAUSE ticks dropped: resumed={} at22={} at23={} (expect jumping/jumping/falling)", loco_resumed, still_jumping, now_falling);
}
