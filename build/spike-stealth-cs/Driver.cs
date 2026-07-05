// Stealth cross-language oracle — C# driver. Mirrors run-oracle.mjs.
using System;
using System.Collections.Generic;

public static class Driver {
    const double DT = 1.0 / 64.0;
    static int step = 0;
    static Stealth g;
    static Vector2 FAR = new Vector2(500, 500);
    static Vector2 pos1, pos2, pos3;

    static Vector2 P(double x, double y) { return new Vector2(x, y); }

    static string Flags(Guard gd) {
        return (gd.is_aware() ? "1" : "0") + (gd.is_alerted() ? "1" : "0") + (gd.should_move() ? "1" : "0");
    }
    static string Gcol(Guard gd) {
        Vector2 t = gd.get_target();
        return $"{gd.get_state()}/{Flags(gd)} tgt=({(long)Math.Round(t.X)},{(long)Math.Round(t.Y)})";
    }
    static void SnapOf(Stealth m, string label, string tag) {
        Console.WriteLine(
            $"{tag}{step:000} {label.PadRight(38)} st={m.get_state().PadRight(8)} " +
            $"t={((long)Math.Round(m.get_elapsed() * 64)).ToString().PadLeft(4)} by={m.get_caught_by().ToString().PadLeft(2)} | " +
            $"g1={Gcol(m.guard1).PadRight(28)} | g2={Gcol(m.guard2).PadRight(28)} | g3={Gcol(m.guard3).PadRight(28)}");
        step++;
    }
    static void Snap(string label) { SnapOf(g, label, ""); }
    static void Pump(int n) { for (int i = 0; i < n; i++) g.tick(DT, pos1, pos2, pos3); }
    static void Run(int n, string label) { Pump(n); Snap($"pump x{n} ({label})"); }

    public static void Main() {
        var P1 = new List<Vector2> { P(0, 0), P(64, 0), P(64, 64) };
        var P2 = new List<Vector2> { P(0, 0), P(96, 0) };
        var P3 = new List<Vector2> { P(0, 0), P(96, 96) };
        pos1 = FAR; pos2 = FAR; pos3 = FAR;
        g = new Stealth();

        Snap("created (guards idle)");
        g.start(P1, P2, P3);
        Snap("start -> playing, guards patrol wp0");
        Console.WriteLine($"OP  get_current_state_name={g.get_current_state_name()}");

        Run(32, "0.5s: nobody arrives (FAR)");

        pos1 = P(1, 1);
        Run(1, "g1 arrives wp0 -> tgt wp1");
        pos1 = P(63, 1);
        Run(1, "g1 arrives wp1 -> tgt wp2");
        pos1 = P(63, 63);
        Run(1, "g1 arrives wp2 -> WRAP tgt wp0");
        pos1 = FAR;

        g.guard1.hear_sound(P(50, 50));
        g.guard2.hear_sound(P(10, 90));
        Snap("g1+g2 hear_sound -> investigating");
        Run(95, "1.484s: both still investigating");
        Run(1, "tick 96 = 1.5s: both pop$ -> patrol");

        g.guard3.spot_player(P(80, 80));
        Snap("g3 spotted (patrolling->alerted)");
        g.guard3.hear_sound(P(5, 5));
        Snap("g3 hear_sound while alerted: NO-OP");

        Run(200, "3.125s chasing (far, no arrive)");
        g.guard3.spot_player(P(80, 80));
        Snap("re-spot at 3.125s: chase timer RESET");
        Run(200, "3.125s more: still alerted (reset)");
        Run(56, "chase clock hits 4.0s -> searching");
        pos3 = P(90, 90);
        Run(192, "3.0s search over -> NEAREST wp1");
        pos3 = FAR;

        g.guard1.hear_sound(P(50, 50));
        Snap("g1 investigating again (push #2)");
        g.guard1.spot_player(P(30, 30));
        Snap("spot DURING investigate -> alerted");
        pos1 = P(29, 29);
        Run(1, "g1 arrives last_known -> searching");
        pos1 = P(1, 1);
        Run(192, "3.0s search over -> patrolling");
        g.guard1.hear_sound(P(40, 40));
        Snap("g1 push #3 (orphan below on stack)");
        Run(96, "1.5s: pop$ is LIFO -> patrolling");
        pos1 = FAR;

        g.guard2.hear_sound(P(10, 90));
        Snap("g2 investigating (timer at 0)");
        g.pause();
        Snap("pause during playing (push)");
        Run(192, "3.0s paused: g2 timer FROZEN");
        g.resume();
        Snap("resume (pop -> playing)");
        Run(96, "1.5s after resume: g2 pops now");

        g.guard_caught_player(1);
        Snap("g2 touches player -> caught");

        g.restart();
        Snap("restart -> attract (counters reset)");

        var esc = new Stealth();
        esc.start(P1, P2, P3);
        for (int i = 0; i < 64; i++) esc.tick(DT, FAR, FAR, FAR);
        esc.player_at_exit();
        Console.WriteLine($"ESC escape path: st={esc.get_state()} by={esc.get_caught_by()} t={(long)Math.Round(esc.get_elapsed() * 64)}");

        g.start(P2, P3, P1);
        Snap("Q: start after restart: init DROPPED");

        // ---- S-section: save/restore lockstep continuation ----
        step = 0;
        var s = new Stealth();
        s.start(P1, P2, P3);
        for (int i = 0; i < 32; i++) s.tick(DT, P(1, 1), FAR, FAR);
        s.guard1.hear_sound(P(50, 50));
        s.guard2.spot_player(P(80, 80));
        for (int i = 0; i < 32; i++) s.tick(DT, FAR, FAR, FAR);
        SnapOf(s, "SAVE POINT (push live, alerted, mid)", "S");
        string blob = s.save_state();
        var r = new Stealth();
        r.restore_state(blob);
        SnapOf(r, "restored copy, same tick", "S");
        step--;
        int[] ns = { 64, 224, 192 };
        string[] labels = { "invest pops on both", "chase times out on both", "search resumes patrol on both" };
        for (int k = 0; k < 3; k++) {
            for (int i = 0; i < ns[k]; i++) s.tick(DT, FAR, FAR, FAR);
            for (int i = 0; i < ns[k]; i++) r.tick(DT, FAR, FAR, FAR);
            SnapOf(s, $"orig  +{ns[k]} ({labels[k]})", "S");
            step--;
            SnapOf(r, $"rest  +{ns[k]} ({labels[k]})", "S");
        }
        s.pause();
        string blob2 = s.save_state();
        var r2 = new Stealth();
        r2.restore_state(blob2);
        r2.resume();
        Console.WriteLine($"SP  paused save -> restore -> resume: st={r2.get_state()} t={(long)Math.Round(r2.get_elapsed() * 64)}");
    }
}
