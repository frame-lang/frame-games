// Pac-Man cross-language oracle — C# driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
using System;
using System.Globalization;

class Program {
    static GhostGame g;
    static int step = 0;
    const double DT = 1.0 / 64.0;

    static string Pad(string s, int w) => s.Length >= w ? s : s.PadRight(w);

    static void Snap(string label) {
        var gs = new[] { "-", "-", "-", "-" };
        var flags = new[] { "--", "--", "--", "--" };
        int n = g.ghost_count();
        for (int i = 0; i < n; i++) {
            gs[i] = g.ghost_state(i);
            flags[i] = (g.ghost_is_dangerous(i) ? "D" : ".") + (g.ghost_is_edible(i) ? "E" : ".");
        }
        Console.WriteLine(string.Format(CultureInfo.InvariantCulture,
            "{0:000} {1} phase={2} fright={3,7:F3} score={4,4} g=[{5} {6} {7} {8}] f=[{9} {10} {11} {12}]",
            step, Pad(label, 28), Pad(g.get_phase(), 10),
            g.frighten_seconds_left(), g.get_score(),
            Pad(gs[0], 10), Pad(gs[1], 10), Pad(gs[2], 10), Pad(gs[3], 10),
            flags[0], flags[1], flags[2], flags[3]));
        step++;
    }

    static void Tick(int n, string label) {
        for (int i = 0; i < n; i++) g.tick(DT);
        Snap($"tick x{n} ({label})");
    }

    static void Main() {
        g = GhostGame.__create();
        string[] names = { "blinky", "pinky", "inky", "clyde" };
        Vector2[] corners = { new Vector2(680, 40), new Vector2(40, 40), new Vector2(680, 440), new Vector2(40, 440) };

        Snap("created");
        for (int i = 0; i < 4; i++) g.add_ghost(Ghost.__create(names[i], corners[i], i));
        Snap("add_ghost x4");
        g.start();
        Snap("start");

        Tick(64, "1.0s: pen not due");
        Tick(80, "2.25s: 1st release");
        Tick(128, "4.25s: 2nd release");
        Tick(128, "6.25s: 3rd release");
        Tick(64, "7.25s: scatter(7s) over");

        g.power_pellet_picked_up();
        Snap("pellet during CHASE (push)");
        Tick(64, "1.0s frightened");
        g.ghost_caught(0);
        Snap("caught blinky (+200)");
        g.ghost_caught(0);
        Snap("caught blinky again (no-op)");
        g.ghost_caught(1);
        Snap("caught pinky (+200)");
        Tick(64, "2.0s frightened");
        g.ghost_arrived_at_pen(0);
        Snap("blinky arrived at pen");
        Tick(256, "6.0s: frighten expires");
        Tick(64, "chase resumed 1.0s");

        g.power_pellet_picked_up();
        Snap("pellet during CHASE #2 (push)");
        g.power_pellet_picked_up();
        Snap("pellet WHILE frightened (re-enter)");
        Tick(320, "5.0s of re-frighten");
        Tick(96, "6.5s total: expires again");

        Tick(1152, "chase(20s) over -> scatter");
        g.power_pellet_picked_up();
        Snap("pellet during SCATTER (push)");
        Tick(416, "6.5s: expires -> scatter");
        Tick(320, "scatter(5s) over -> chase");

        Snap("final");
    }
}
