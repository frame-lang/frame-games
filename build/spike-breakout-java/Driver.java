import java.util.Locale;
public class Driver {
    static final double DT = 1.0 / 64.0;
    static int step = 0;
    static Breakout g;
    static long mU(double x) { return Math.round(x * 1000); }
    static String padr(String s, int w) { StringBuilder b = new StringBuilder(s==null?"":s); while (b.length() < w) b.append(' '); return b.toString(); }
    static String padl(Object o, int w) { String s = String.valueOf(o); StringBuilder b = new StringBuilder(); for (int i=s.length();i<w;i++) b.append(' '); return b+s; }
    static void snap(String label) {
        String rp = g.get_state().equals("playing") ? padl(mU(g.ball_respawn_progress()), 4) : padl("-", 4);
        System.out.println(String.format(Locale.ROOT, "%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s",
            step, padr(label,34), padr(g.get_state(),11), padl(g.get_score(),4), g.get_lives(), g.get_level(),
            padl(g.bricks_remaining(),2), padr(g.ball_state(),9), padl(mU(g.ball_vx()),6), padl(mU(g.ball_vy()),6), rp));
        step++;
    }
    static void run(int n, String label) { for (int i=0;i<n;i++) g.tick(DT); snap(String.format(Locale.ROOT,"pump x%d (%s)",n,label)); }
    public static void main(String[] a) {
        g = Breakout.__create();
        snap("created");
        g.start();
        snap("start -> playing, ball attached");
        System.out.println("OP  get_current_state_name=" + g.get_current_state_name());
        g.launch_ball(3.5, -4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
        g.wall_bounce_x(); snap("wall_bounce_x -> vx negated");
        g.wall_bounce_y(); snap("wall_bounce_y -> vy negated");
        g.paddle_hit(2.75, -5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)");
        g.brick_hit(0); snap("brick_hit(0): +10, vy flip, broken");
        g.brick_hit(0); g.brick_hit(999); g.brick_hit(-1); snap("brick_hit dead/oob: NO score change");
        g.brick_hit(1); g.brick_hit(2); snap("brick_hit(1,2): +20");
        g.pause(); snap("pause during PLAYING (push)");
        run(64, "1.0s paused: ball frozen");
        g.resume(); snap("resume (pop -> playing)");
        g.ball_fell_off(); snap("ball_fell_off -> lives-1, ball lost");
        run(64, "1.0s: respawn progress ~0.5");
        run(63, "just before 2.0s: still lost");
        run(1, "tick 2.0s: ball -> attached");
        g.launch_ball(3.5, -4.25); snap("re-launch (fresh in_flight)");
        for (int i=3;i<40;i++) g.brick_hit(i); snap("cleared wall -> level_clear (lvl 2)");
        g.start(); snap("start -> playing, fresh wall of 40");
        g.ball_fell_off(); snap("fell off -> lives 1");
        g.ball_fell_off(); snap("fell off -> lives 0 -> game_over");
        g.restart(); snap("restart -> attract (reset)");
        var g2 = Breakout.__create(); g2.start(); g2.launch_ball(1.0,-1.0); g2.ball_fell_off();
        for (int i=0;i<32;i++) g2.tick(DT);
        long rpb = mU(g2.ball_respawn_progress()); g2.pause();
        for (int i=0;i<128;i++) g2.tick(DT); g2.resume();
        long rpa = mU(g2.ball_respawn_progress());
        System.out.println(String.format(Locale.ROOT,"PAUSE respawn frozen: before=%d after=%d ball=%s (paused ticks must not advance the ball)", rpb, rpa, g2.ball_state()));
        var g3 = Breakout.__create(); g3.start();
        System.out.println(String.format(Locale.ROOT,"BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)",
            g3.is_brick_broken(0), g3.is_brick_broken(-1), g3.is_brick_broken(999)));
    }
}
