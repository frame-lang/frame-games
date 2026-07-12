public class Driver {
    static int step = 0;
    static Pong g;

    static int bU(boolean x) { return x ? 1 : 0; }
    static String pad(String s, int w) { StringBuilder b = new StringBuilder(s == null ? "" : s); while (b.length() < w) b.append(' '); return b.toString(); }
    static String lpad(Object o, int w) { String s = String.valueOf(o); StringBuilder b = new StringBuilder(); for (int i = s.length(); i < w; i++) b.append(' '); return b + s; }

    static void snap(String label) {
        System.out.println(
            String.format("%03d ", step) + pad(label, 38) + " " +
            "st=" + pad(g.get_current_state_name(), 12) + " sl=" + lpad(g.get_score_left(), 2) + " sr=" + lpad(g.get_score_right(), 2) + " " +
            "serve=" + lpad(g.get_serve_direction(), 2) + " play=" + bU(g.is_playing()) + " winner=" + pad(g.get_winner(), 6));
        step++;
    }
    static void pointRight(Pong x) { x.launch(); x.ball_out_left(); }
    static void pointLeft(Pong x) { x.launch(); x.ball_out_right(); }

    public static void main(String[] args) {
        g = Pong.__create();
        snap("created (AttractMode / 0-0)");
        System.out.println("OP  get_current_state_name=" + g.get_current_state_name() + " get_winning_score=" + g.get_winning_score());

        g.start(); snap("start -> Serving");
        g.pause(); snap("pause during Serving (push)");
        g.resume(); snap("resume (pop -> Serving)");
        g.launch(); snap("launch -> InPlay (playing)");
        g.pause(); snap("pause during InPlay (push)");
        g.resume(); snap("resume (pop -> InPlay)");
        g.ball_out_left(); snap("ball_out_left -> right+1, serve -1");
        pointLeft(g); snap("pointLeft -> left+1, serve +1");
        for (int i = 0; i < 9; i++) pointRight(g);
        snap("right at 10 (one short of 11)");
        pointRight(g); snap("right scores 11 -> GameOver [right wins]");
        System.out.println("WIN winner=" + g.get_winner() + " playing=" + bU(g.is_playing()) + " sl=" + g.get_score_left() + " sr=" + g.get_score_right());
        g.restart(); snap("restart -> AttractMode (reset)");

        Pong g2 = Pong.__create();
        g2.start();
        for (int i = 0; i < 11; i++) pointLeft(g2);
        System.out.println("MIRROR left win: st=" + g2.get_current_state_name() + " winner=" + g2.get_winner() + " sl=" + g2.get_score_left() + " serve=" + g2.get_serve_direction());
    }
}
