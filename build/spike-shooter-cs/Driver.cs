// Shooter cross-language oracle — C# driver. Mirrors run-oracle.mjs
// step-for-step; output must byte-match expected-trace.txt.
using System;
using System.Globalization;

class Program {
    static Shooter g;
    static int step = 0;
    static int wavesBuilt = 0;
    static int ef = 0, bsingle = 0, bspread = 0, bspray = 0;
    const double DT = 1.0 / 64.0;

    static string Pad(string s, int w) => s.Length >= w ? s : s.PadRight(w);

    static void BuildWave() {
        wavesBuilt++;
        if (wavesBuilt == 1) {
            g.add_enemy(Enemy.__create(0, 2, 0.0, 100));
            g.add_enemy(Enemy.__create(1, 3, 0.75, 150));
        } else {
            g.add_enemy(Enemy.__create(wavesBuilt % 3, 1, 0.0, 10));
            g.add_enemy(Enemy.__create((wavesBuilt + 1) % 3, 1, 0.0, 10));
        }
    }

    static void Pump(int n) {
        for (int i = 0; i < n; i++) {
            g.tick(DT);
            if (g.should_spawn_wave()) { g.consume_wave(); BuildWave(); }
            if (g.should_spawn_boss()) { g.consume_boss_spawn(); }
            for (int e = 0; e < g.enemy_count(); e++) {
                var en = g.enemies[e];
                if (en.wants_to_fire()) { en.consume_fire(); ef++; }
            }
            if (g.boss.wants_to_fire_single()) { g.boss.consume_fire(); bsingle++; }
            if (g.boss.wants_to_fire_spread()) { g.boss.consume_fire(); bspread++; }
            if (g.boss.wants_to_fire_spray())  { g.boss.consume_fire(); bspray++; }
            g.clear_dead_enemies();
        }
    }

    static void Snap(string label) {
        string e0 = g.enemy_count() > 0 ? g.enemies[0].get_state() : "-";
        string e1 = g.enemy_count() > 1 ? g.enemies[1].get_state() : "-";
        Console.WriteLine(string.Format(CultureInfo.InvariantCulture,
            "{0:000} {1} st={2} score={3,4} lives={4} n={5} e0={6} e1={7} boss={8} bhp={9,2} pl={10} fire[e={11} s={12} d={13} y={14}] waves={15}",
            step, Pad(label, 30), Pad(g.get_state(), 10),
            g.get_score(), g.get_lives(), g.enemy_count(),
            Pad(e0, 8), Pad(e1, 8),
            Pad(g.boss.get_state(), 11), g.boss.get_hp(),
            Pad(g.player.get_state(), 12),
            ef, bsingle, bspread, bspray, wavesBuilt));
        step++;
    }

    static void Run(int n, string label) {
        Pump(n);
        Snap($"pump x{n} ({label})");
    }

    static void Main() {
        g = Shooter.__create();

        Snap("created");
        g.start();
        Snap("start -> playing");

        Run(129, "2.0s+: wave 1 spawns");
        Run(32, "0.5s: spawning -> active");
        g.enemy_hit(0, 1);
        Snap("e0 hit 1/2 (still active)");
        g.enemy_hit(0, 1);
        Snap("e0 hit 2/2 -> dying, +100");
        Run(26, "0.4s: e0 gone + CLEANED UP");
        Run(23, "e1 fire #1 (rate 0.75)");
        Run(48, "e1 fire #2");

        g.player_hit();
        Snap("player hit -> exploding");
        g.player_hit();
        Snap("player hit while exploding (no-op)");
        Run(64, "1.0s: lives-1 -> invulnerable");
        g.player_hit();
        Snap("player hit while invuln (no-op)");

        g.pause();
        Snap("pause during PLAYING (push)");
        Run(64, "1.0s paused: everything frozen");
        g.resume();
        Snap("resume (pop -> playing)");
        Run(128, "2.0s: invuln over + wave 2");

        g.enemy_hit(0, 99);
        Snap("kill the old shooter e0 (+150)");
        Run(600, "rush: waves 3..6 spawn+decay");
        Run(600, "rush: waves 7..10 -> BOSS mid-pump");
        Snap("boss_fight (entered during rush)");

        Run(116, "boss p1: idle(1.8s) -> firing");
        Run(26, "p1 firing 0.4s -> idle (1 shot)");
        g.boss_hit(10); g.boss_hit(10); g.boss_hit(10);
        Snap("boss 90->60 (>59.4: still P1)");
        g.boss_hit(10);
        Snap("boss 60->50 <=59.4 -> PHASE 2");

        g.pause();
        Snap("pause during BOSS FIGHT (push)");
        Run(64, "1.0s paused: boss frozen");
        g.resume();
        Snap("resume (pop -> boss_fight)");

        Run(84, "p2: idle(1.3s) -> spread");
        Run(33, "p2 spread 0.5s -> idle (1 shot)");
        g.boss_hit(21);
        Snap("boss 50->29 <=29.7 -> PHASE 3");

        Run(39, "p3: idle(0.6s) -> spray");
        Run(52, "p3 spray 0.8s (~6 shots @0.12s)");
        g.boss_hit(29);
        Snap("boss 29->0 in P3 -> DYING");
        Run(200, "boss dying -> gone -> VICTORY");

        Snap("final");

        // --- pinned quirk section ---
        var g2 = Shooter.__create();
        g2.start();
        for (int w = 0; w < 10; w++) { for (int i = 0; i < 129; i++) { g2.tick(DT); } if (g2.should_spawn_wave()) g2.consume_wave(); }
        for (int i = 0; i < 65; i++) { g2.tick(DT); }
        Console.WriteLine($"Q00 quirk: state={g2.get_state()} boss={g2.boss.get_state()}");
        g2.boss_hit(90);
        Console.WriteLine($"Q01 quirk: one 90-dmg hit in P1 -> boss={g2.boss.get_state()} hp={g2.boss.get_hp()} (phase two, not dying)");
        g2.boss_hit(1);
        Console.WriteLine($"Q02 quirk: 1-dmg hit in P2 at 0hp -> boss={g2.boss.get_state()} hp={g2.boss.get_hp()} (phase three)");
        g2.boss_hit(1);
        Console.WriteLine($"Q03 quirk: 1-dmg hit in P3 -> boss={g2.boss.get_state()} (finally dying)");
    }
}
