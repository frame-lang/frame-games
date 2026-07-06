// Stealth cross-language oracle — Java driver. Mirrors run-oracle.mjs.
import java.util.List;
import java.util.ArrayList;
import java.util.Locale;

public class Driver {
    static final double DT = 1.0 / 64.0;
    static int step = 0;
    static Stealth g;
    static Vector2 FAR = new Vector2(500, 500);
    static Vector2 pos1, pos2, pos3;

    static Vector2 P(double x, double y) { return new Vector2(x, y); }
    static List<Vector2> route(Vector2... v) {
        List<Vector2> l = new ArrayList<>();
        for (Vector2 x : v) l.add(x);
        return l;
    }
    static String pad(String s, int w) {
        StringBuilder b = new StringBuilder(s);
        while (b.length() < w) b.append(' ');
        return b.toString();
    }
    static String flags(Guard gd) {
        return "" + (gd.is_aware() ? 1 : 0) + (gd.is_alerted() ? 1 : 0) + (gd.should_move() ? 1 : 0);
    }
    static String gcol(Guard gd) {
        Vector2 t = gd.get_target();
        return String.format(Locale.ROOT, "%s/%s tgt=(%d,%d)", gd.get_state(), flags(gd),
            Math.round(t.x), Math.round(t.y));
    }
    static void snapOf(Stealth m, String label, String tag) {
        System.out.println(String.format(Locale.ROOT,
            "%s%03d %s st=%s t=%4d by=%2d | g1=%s | g2=%s | g3=%s",
            tag, step, pad(label, 38), pad(m.get_state(), 8),
            Math.round(m.get_elapsed() * 64), m.get_caught_by(),
            pad(gcol(m.guard1), 28), pad(gcol(m.guard2), 28), pad(gcol(m.guard3), 28)));
        step++;
    }
    static void snap(String label) { snapOf(g, label, ""); }
    static void pump(int n) { for (int i = 0; i < n; i++) g.tick(DT, pos1, pos2, pos3); }
    static void run(int n, String label) { pump(n); snap(String.format(Locale.ROOT, "pump x%d (%s)", n, label)); }

    public static void main(String[] args) {
        List<Vector2> P1 = route(P(0, 0), P(64, 0), P(64, 64));
        List<Vector2> P2 = route(P(0, 0), P(96, 0));
        List<Vector2> P3 = route(P(0, 0), P(96, 96));
        pos1 = FAR; pos2 = FAR; pos3 = FAR;
        g = new Stealth();

        snap("created (guards idle)");
        g.start(P1, P2, P3);
        snap("start -> playing, guards patrol wp0");
        System.out.println("OP  get_current_state_name=" + g.get_current_state_name());

        run(32, "0.5s: nobody arrives (FAR)");
        pos1 = P(1, 1); run(1, "g1 arrives wp0 -> tgt wp1");
        pos1 = P(63, 1); run(1, "g1 arrives wp1 -> tgt wp2");
        pos1 = P(63, 63); run(1, "g1 arrives wp2 -> WRAP tgt wp0");
        pos1 = FAR;

        g.guard1.hear_sound(P(50, 50));
        g.guard2.hear_sound(P(10, 90));
        snap("g1+g2 hear_sound -> investigating");
        run(95, "1.484s: both still investigating");
        run(1, "tick 96 = 1.5s: both pop$ -> patrol");

        g.guard3.spot_player(P(80, 80));
        snap("g3 spotted (patrolling->alerted)");
        g.guard3.hear_sound(P(5, 5));
        snap("g3 hear_sound while alerted: NO-OP");

        run(200, "3.125s chasing (far, no arrive)");
        g.guard3.spot_player(P(80, 80));
        snap("re-spot at 3.125s: chase timer RESET");
        run(200, "3.125s more: still alerted (reset)");
        run(56, "chase clock hits 4.0s -> searching");
        pos3 = P(90, 90); run(192, "3.0s search over -> NEAREST wp1");
        pos3 = FAR;

        g.guard1.hear_sound(P(50, 50));
        snap("g1 investigating again (push #2)");
        g.guard1.spot_player(P(30, 30));
        snap("spot DURING investigate -> alerted");
        pos1 = P(29, 29); run(1, "g1 arrives last_known -> searching");
        pos1 = P(1, 1); run(192, "3.0s search over -> patrolling");
        g.guard1.hear_sound(P(40, 40));
        snap("g1 push #3 (orphan below on stack)");
        run(96, "1.5s: pop$ is LIFO -> patrolling");
        pos1 = FAR;

        g.guard2.hear_sound(P(10, 90));
        snap("g2 investigating (timer at 0)");
        g.pause();
        snap("pause during playing (push)");
        run(192, "3.0s paused: g2 timer FROZEN");
        g.resume();
        snap("resume (pop -> playing)");
        run(96, "1.5s after resume: g2 pops now");

        g.guard_caught_player(1);
        snap("g2 touches player -> caught");

        g.restart();
        snap("restart -> attract (counters reset)");

        Stealth esc = new Stealth();
        esc.start(P1, P2, P3);
        for (int i = 0; i < 64; i++) esc.tick(DT, FAR, FAR, FAR);
        esc.player_at_exit();
        System.out.println(String.format(Locale.ROOT, "ESC escape path: st=%s by=%d t=%d",
            esc.get_state(), esc.get_caught_by(), Math.round(esc.get_elapsed() * 64)));

        g.start(P2, P3, P1);
        snap("Q: start after restart: init DROPPED");

        // ---- S-section ----
        step = 0;
        Stealth s = new Stealth();
        s.start(P1, P2, P3);
        for (int i = 0; i < 32; i++) s.tick(DT, P(1, 1), FAR, FAR);
        s.guard1.hear_sound(P(50, 50));
        s.guard2.spot_player(P(80, 80));
        for (int i = 0; i < 32; i++) s.tick(DT, FAR, FAR, FAR);
        snapOf(s, "SAVE POINT (push live, alerted, mid)", "S");
        String blob = s.save_state();
        Stealth r = new Stealth();
        r.restore_state(blob);
        snapOf(r, "restored copy, same tick", "S");
        step--;
        int[] ns = { 64, 224, 192 };
        String[] labels = { "invest pops on both", "chase times out on both", "search resumes patrol on both" };
        for (int k = 0; k < 3; k++) {
            for (int i = 0; i < ns[k]; i++) s.tick(DT, FAR, FAR, FAR);
            for (int i = 0; i < ns[k]; i++) r.tick(DT, FAR, FAR, FAR);
            snapOf(s, String.format(Locale.ROOT, "orig  +%d (%s)", ns[k], labels[k]), "S");
            step--;
            snapOf(r, String.format(Locale.ROOT, "rest  +%d (%s)", ns[k], labels[k]), "S");
        }
        s.pause();
        String blob2 = s.save_state();
        Stealth r2 = new Stealth();
        r2.restore_state(blob2);
        r2.resume();
        System.out.println(String.format(Locale.ROOT, "SP  paused save -> restore -> resume: st=%s t=%d",
            r2.get_state(), Math.round(r2.get_elapsed() * 64)));
    }
}
