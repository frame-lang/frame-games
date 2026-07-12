using System;
using System.Globalization;

public static class Driver {
    const double DT = 1.0 / 64.0;
    static int step = 0;
    static Platformer g;

    static long mU(double x) { return (long)Math.Round(x * 1000); }
    static int bU(bool x) { return x ? 1 : 0; }
    static string pad(string s, int w) { s = s ?? ""; while (s.Length < w) s += " "; return s; }
    static string lpad(object o, int w) { string s = Convert.ToString(o, CultureInfo.InvariantCulture); while (s.Length < w) s = " " + s; return s; }

    static void snap(string label) {
        Console.WriteLine(
            $"{step:000} {pad(label, 40)} " +
            $"st={pad(g.get_current_state_name(), 7)} loco={pad(g.locomotion_state(), 8)} form={pad(g.form(), 5)} " +
            $"vx={lpad(mU(g.wants_velocity_x()), 7)} face={lpad(g.facing(), 2)} " +
            $"gnd={bU(g.is_grounded())} air={bU(g.is_in_air())} jimp={bU(g.wants_jump_impulse())} " +
            $"hbox={lpad(g.hit_box_height(), 2)} shoot={bU(g.can_shoot())} paused={bU(g.is_paused())}");
        step++;
    }
    static void run(int n, string label) { for (int i = 0; i < n; i++) g.tick(DT); snap($"pump x{n} ({label})"); }

    public static void Main() {
        g = Platformer.__create();
        snap("created (Playing / idle / small)");
        Console.WriteLine($"OP  get_current_state_name={g.get_current_state_name()}");

        g.press_right();
        snap("press_right -> walking, face+1");
        g.press_sprint();
        snap("press_sprint -> running (vx 260)");
        g.release_sprint();
        snap("release_sprint -> walking (vx 140)");
        g.press_left();
        snap("press_left -> face-1, vx -140");
        g.release_horizontal();
        snap("release_horizontal -> idle");

        g.press_jump();
        snap("press_jump -> jumping, jimp=1");
        g.consume_jump_impulse();
        snap("consume_jump_impulse -> jimp=0");
        g.press_right();
        snap("press_right in air -> vx 180 (air_speed)");
        run(22, "0.34s held: still jumping");
        run(1, "tick 23 (0.35s) -> falling");

        g.ground_contact();
        snap("ground_contact -> landing");
        run(5, "0.078s: still landing");
        run(1, "tick 6 (0.08s): input_x!=0 -> walking");
        g.release_horizontal();
        snap("release_horizontal -> idle");

        g.press_jump();
        snap("press_jump -> jumping (fresh)");
        g.release_jump();
        snap("release_jump -> timer frozen");
        run(40, "0.625s released: STILL jumping (no auto-fall)");
        g.ground_contact();
        snap("ground_contact -> landing (input_x=0)");
        run(6, "0.08s: input_x==0 -> idle");

        g.left_ground();
        snap("left_ground -> falling (walked off)");
        g.ground_contact();
        snap("ground_contact -> landing");
        run(6, "recover -> idle");

        g.pickup_mushroom();
        snap("pickup_mushroom -> big (hbox 48)");
        g.pickup_flower();
        snap("pickup_flower -> fiery (can_shoot 1)");
        g.take_damage();
        snap("take_damage -> big [ret-then-transition]");
        g.take_damage();
        snap("take_damage -> small (hbox 24)");
        g.take_damage();
        snap("take_damage in small -> no transition");
        g.pickup_flower();
        snap("pickup_flower from small -> fiery");

        Console.WriteLine($"RET take_damage(fiery)={bU(g.take_damage())} form_now={g.form()} (expect 1 / big)");
        Console.WriteLine($"RET take_damage(big)={bU(g.take_damage())} form_now={g.form()} (expect 1 / small)");
        Console.WriteLine($"RET take_damage(small)={bU(g.take_damage())} form_now={g.form()} (expect 0 / small)");

        g.pickup_mushroom();
        g.press_right();
        snap("re-arm: big + walking before pause");
        g.pause();
        snap("pause -> Paused (push), paused=1");
        run(64, "1.0s paused: locomotion frozen");
        g.resume();
        snap("resume -> Playing (pop), paused=0");

        var g2 = Platformer.__create();
        g2.press_right();
        g2.press_sprint();
        var loco_before = g2.locomotion_state();
        g2.pickup_mushroom();
        g2.pickup_flower();
        var loco_after = g2.locomotion_state();
        Console.WriteLine($"ORTHO loco stable across powerups: before={loco_before} after={loco_after} form={g2.form()} (expect running/running/fiery)");

        var g3 = Platformer.__create();
        g3.press_jump();
        for (int i = 0; i < 10; i++) g3.tick(DT);
        g3.pause();
        for (int i = 0; i < 128; i++) g3.tick(DT);
        g3.resume();
        var loco_resumed = g3.locomotion_state();
        for (int i = 0; i < 12; i++) g3.tick(DT);
        var still_jumping = g3.locomotion_state();
        g3.tick(DT);
        var now_falling = g3.locomotion_state();
        Console.WriteLine($"PAUSE ticks dropped: resumed={loco_resumed} at22={still_jumping} at23={now_falling} (expect jumping/jumping/falling)");
    }
}
