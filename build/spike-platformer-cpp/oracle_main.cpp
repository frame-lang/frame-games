#include "platformer.cpp"
#include <cstdio>
#include <cmath>
#include <string>

static long mU(double x) { return (long)std::llround(x * 1000); }
static int bU(bool x) { return x ? 1 : 0; }
static std::string padr(std::string s, int w) { while ((int)s.size() < w) s += " "; return s; }
static std::string lpad(std::string s, int w) { while ((int)s.size() < w) s = " " + s; return s; }
static std::string i2s(long v) { return std::to_string(v); }

static int step = 0;
static Platformer g = Platformer::__create();

static void snap(const std::string& label) {
    printf("%03d %s st=%s loco=%s form=%s vx=%s face=%s gnd=%d air=%d jimp=%d hbox=%s shoot=%d paused=%d\n",
        step, padr(label,40).c_str(), padr(g.get_current_state_name(),7).c_str(), padr(g.locomotion_state(),8).c_str(), padr(g.form(),5).c_str(),
        lpad(i2s(mU(g.wants_velocity_x())),7).c_str(), lpad(i2s(g.facing()),2).c_str(),
        bU(g.is_grounded()), bU(g.is_in_air()), bU(g.wants_jump_impulse()),
        lpad(i2s(g.hit_box_height()),2).c_str(), bU(g.can_shoot()), bU(g.is_paused()));
    step++;
}
static void run(int n, const std::string& label) { for (int i=0;i<n;i++) g.tick(1.0/64.0); snap("pump x" + std::to_string(n) + " (" + label + ")"); }

int main() {
    snap("created (Playing / idle / small)");
    printf("OP  get_current_state_name=%s\n", g.get_current_state_name().c_str());

    g.press_right(); snap("press_right -> walking, face+1");
    g.press_sprint(); snap("press_sprint -> running (vx 260)");
    g.release_sprint(); snap("release_sprint -> walking (vx 140)");
    g.press_left(); snap("press_left -> face-1, vx -140");
    g.release_horizontal(); snap("release_horizontal -> idle");

    g.press_jump(); snap("press_jump -> jumping, jimp=1");
    g.consume_jump_impulse(); snap("consume_jump_impulse -> jimp=0");
    g.press_right(); snap("press_right in air -> vx 180 (air_speed)");
    run(22, "0.34s held: still jumping");
    run(1, "tick 23 (0.35s) -> falling");

    g.ground_contact(); snap("ground_contact -> landing");
    run(5, "0.078s: still landing");
    run(1, "tick 6 (0.08s): input_x!=0 -> walking");
    g.release_horizontal(); snap("release_horizontal -> idle");

    g.press_jump(); snap("press_jump -> jumping (fresh)");
    g.release_jump(); snap("release_jump -> timer frozen");
    run(40, "0.625s released: STILL jumping (no auto-fall)");
    g.ground_contact(); snap("ground_contact -> landing (input_x=0)");
    run(6, "0.08s: input_x==0 -> idle");

    g.left_ground(); snap("left_ground -> falling (walked off)");
    g.ground_contact(); snap("ground_contact -> landing");
    run(6, "recover -> idle");

    g.pickup_mushroom(); snap("pickup_mushroom -> big (hbox 48)");
    g.pickup_flower(); snap("pickup_flower -> fiery (can_shoot 1)");
    g.take_damage(); snap("take_damage -> big [ret-then-transition]");
    g.take_damage(); snap("take_damage -> small (hbox 24)");
    g.take_damage(); snap("take_damage in small -> no transition");
    g.pickup_flower(); snap("pickup_flower from small -> fiery");

    printf("RET take_damage(fiery)=%d form_now=%s (expect 1 / big)\n", bU(g.take_damage()), g.form().c_str());
    printf("RET take_damage(big)=%d form_now=%s (expect 1 / small)\n", bU(g.take_damage()), g.form().c_str());
    printf("RET take_damage(small)=%d form_now=%s (expect 0 / small)\n", bU(g.take_damage()), g.form().c_str());

    g.pickup_mushroom(); g.press_right(); snap("re-arm: big + walking before pause");
    g.pause(); snap("pause -> Paused (push), paused=1");
    run(64, "1.0s paused: locomotion frozen");
    g.resume(); snap("resume -> Playing (pop), paused=0");

    Platformer g2 = Platformer::__create();
    g2.press_right(); g2.press_sprint();
    std::string loco_before = g2.locomotion_state();
    g2.pickup_mushroom(); g2.pickup_flower();
    std::string loco_after = g2.locomotion_state();
    printf("ORTHO loco stable across powerups: before=%s after=%s form=%s (expect running/running/fiery)\n", loco_before.c_str(), loco_after.c_str(), g2.form().c_str());

    Platformer g3 = Platformer::__create();
    g3.press_jump();
    for (int i=0;i<10;i++) g3.tick(1.0/64.0);
    g3.pause();
    for (int i=0;i<128;i++) g3.tick(1.0/64.0);
    g3.resume();
    std::string loco_resumed = g3.locomotion_state();
    for (int i=0;i<12;i++) g3.tick(1.0/64.0);
    std::string still_jumping = g3.locomotion_state();
    g3.tick(1.0/64.0);
    std::string now_falling = g3.locomotion_state();
    printf("PAUSE ticks dropped: resumed=%s at22=%s at23=%s (expect jumping/jumping/falling)\n", loco_resumed.c_str(), still_jumping.c_str(), now_falling.c_str());
    return 0;
}
