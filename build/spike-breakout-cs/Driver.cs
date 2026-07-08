using System;
using System.Globalization;

public static class Driver {
    const double DT = 1.0 / 64.0;
    static int step = 0;
    static Breakout g;

    static long mU(double x) { return (long)Math.Round(x * 1000); }
    static string pad(string s, int w) { s = s ?? ""; while (s.Length < w) s += " "; return s; }
    static string lpad(object o, int w) { string s = Convert.ToString(o, CultureInfo.InvariantCulture); while (s.Length < w) s = " " + s; return s; }

    static void snap(string label) {
        string rp = g.get_state() == "playing" ? lpad(mU(g.ball_respawn_progress()), 4) : lpad("-", 4);
        Console.WriteLine(
            $"{step:000} {pad(label, 34)} " +
            $"st={pad(g.get_state(), 11)} sc={lpad(g.get_score(), 4)} lv={g.get_lives()} lvl={g.get_level()} br={lpad(g.bricks_remaining(), 2)} | " +
            $"ball={pad(g.ball_state(), 9)} vx={lpad(mU(g.ball_vx()), 6)} vy={lpad(mU(g.ball_vy()), 6)} rp={rp}");
        step++;
    }
    static void run(int n, string label) { for (int i = 0; i < n; i++) g.tick(DT); snap($"pump x{n} ({label})"); }

    public static void Main() {
        g = Breakout.__create();
        snap("created");
        g.start();
        snap("start -> playing, ball attached");
        Console.WriteLine($"OP  get_current_state_name={g.get_current_state_name()}");

        g.launch_ball(3.5, -4.25);
        snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
        g.wall_bounce_x();
        snap("wall_bounce_x -> vx negated");
        g.wall_bounce_y();
        snap("wall_bounce_y -> vy negated");
        g.paddle_hit(2.75, -5.5);
        snap("paddle_hit -> set_velocity(2.75,-5.5)");

        g.brick_hit(0);
        snap("brick_hit(0): +10, vy flip, broken");
        g.brick_hit(0);
        g.brick_hit(999);
        g.brick_hit(-1);
        snap("brick_hit dead/oob: NO score change");
        g.brick_hit(1);
        g.brick_hit(2);
        snap("brick_hit(1,2): +20");

        g.pause();
        snap("pause during PLAYING (push)");
        run(64, "1.0s paused: ball frozen");
        g.resume();
        snap("resume (pop -> playing)");

        g.ball_fell_off();
        snap("ball_fell_off -> lives-1, ball lost");
        run(64, "1.0s: respawn progress ~0.5");
        run(63, "just before 2.0s: still lost");
        run(1, "tick 2.0s: ball -> attached");

        g.launch_ball(3.5, -4.25);
        snap("re-launch (fresh in_flight)");
        for (int i = 3; i < 40; i++) g.brick_hit(i);
        snap("cleared wall -> level_clear (lvl 2)");
        g.start();
        snap("start -> playing, fresh wall of 40");

        g.ball_fell_off();
        snap("fell off -> lives 1");
        g.ball_fell_off();
        snap("fell off -> lives 0 -> game_over");
        g.restart();
        snap("restart -> attract (reset)");

        var g2 = Breakout.__create();
        g2.start();
        g2.launch_ball(1.0, -1.0);
        g2.ball_fell_off();
        for (int i = 0; i < 32; i++) g2.tick(DT);
        long rpBefore = mU(g2.ball_respawn_progress());
        g2.pause();
        for (int i = 0; i < 128; i++) g2.tick(DT);
        g2.resume();
        long rpAfter = mU(g2.ball_respawn_progress());
        Console.WriteLine($"PAUSE respawn frozen: before={rpBefore} after={rpAfter} ball={g2.ball_state()} (paused ticks must not advance the ball)");

        var g3 = Breakout.__create();
        g3.start();
        Console.WriteLine($"BRICK is_broken: fresh0={(g3.is_brick_broken(0) ? "true" : "false")} oobNeg={(g3.is_brick_broken(-1) ? "true" : "false")} oobBig={(g3.is_brick_broken(999) ? "true" : "false")} (expect false, true, true)");
    }
}
