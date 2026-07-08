import java.util.Locale;

public class Driver {
    static final double DT = 1.0 / 64.0;
    static int step = 0;
    static Invaders g;

    static long ivus() { return Math.round(g.fleet.get_step_interval() * 1e6); }
    static String pad(String s, int w) { StringBuilder b = new StringBuilder(s == null ? "" : s); while (b.length() < w) b.append(' '); return b.toString(); }
    static String lpad(Object o, int w) { String s = String.valueOf(o); StringBuilder b = new StringBuilder(); for (int i = s.length(); i < w; i++) b.append(' '); return b + s; }

    static void snap(String label) {
        var fl = g.fleet;
        System.out.println(String.format(Locale.ROOT,
            "%03d %s st=%s sc=%s wv=%d lv=%d | fl=%s dir=%s al=%s/%s iv=%s lr=%s | pl=%s pz=%d",
            step, pad(label, 34), pad(g.get_state(), 13), lpad(g.get_score(), 4), g.get_wave(), g.get_lives(),
            pad(fl.get_state(), 9), lpad(fl.get_direction(), 2), lpad(fl.alive_count(), 2), lpad(fl.total(), 2),
            lpad(ivus(), 6), lpad(fl.lowest_row(), 2), pad(g.player.get_state(), 12), g.is_paused() ? 1 : 0));
        step++;
    }
    static void run(int n, String label) { for (int i = 0; i < n; i++) g.tick(DT); snap(String.format(Locale.ROOT, "pump x%d (%s)", n, label)); }

    public static void main(String[] args) {
        g = new Invaders();
        snap("created");
        g.start();
        snap("start -> playing (fleet 55, iv=600000)");
        System.out.println("OP  get_current_state_name=" + g.get_current_state_name());

        run(39, "0.61s: fleet wants_to_step");
        System.out.println("SIG consume_step=" + (g.fleet.consume_step() ? "true" : "false") + " (timer was >= interval)");

        g.player_killed_invader(0);
        snap("kill idx0 (+10, pace up)");
        g.player_killed_invader(1);
        g.player_killed_invader(2);
        snap("kill idx1,2 (+20 more)");
        g.player_killed_invader(1);
        g.player_killed_invader(999);
        g.player_killed_invader(-1);
        snap("kill dead/oob idx: NO score change");

        g.fleet_reached_edge();
        snap("fleet_reached_edge -> stepping, dir flip");
        run(1, "one tick: stepping -> marching");

        g.pause();
        snap("pause during PLAYING (push)");
        run(64, "1.0s paused: fleet+player frozen");
        g.resume();
        snap("resume (pop -> playing)");

        for (int i = 3; i < 55; i++) g.player_killed_invader(i);
        snap("cleared fleet -> wave_complete");

        g.pause();
        snap("pause during WAVE_COMPLETE (push)");
        run(64, "1.0s paused: wave timer frozen");
        g.resume();
        snap("resume (pop -> wave_complete)");

        run(129, "2.0s: wave 2 begins, fleet reset");

        g.player_hit();
        snap("player_hit -> player_dying");
        g.player_hit();
        snap("player_hit while exploding: NO-OP");

        g.pause();
        snap("pause during PLAYER_DYING (push)");
        run(64, "1.0s paused: explosion timer frozen");
        g.resume();
        snap("resume (pop -> player_dying)");

        run(77, "1.2s: lives-1, invuln, -> playing");
        run(96, "1.5s: invuln over -> alive");

        g.fleet_reached_bottom();
        snap("fleet_reached_bottom -> game_over");
        g.restart();
        snap("restart -> attract (reset)");

        var g2 = new Invaders();
        g2.start();
        for (int life = 0; life < 3; life++) { g2.player_hit(); for (int i = 0; i < 180; i++) g2.tick(DT); }
        System.out.println(String.format(Locale.ROOT, "DEATH after 3 hits: st=%s lives=%d player=%s", g2.get_state(), g2.get_lives(), g2.player.get_state()));

        var g3 = new Invaders();
        g3.start();
        int d0 = g3.fleet.get_direction();
        g3.fleet_reached_edge(); g3.tick(DT);
        int d1 = g3.fleet.get_direction();
        g3.fleet_reached_edge(); g3.tick(DT);
        int d2 = g3.fleet.get_direction();
        System.out.println(String.format(Locale.ROOT, "DIR bounces: start=%d after1=%d after2=%d", d0, d1, d2));
    }
}
