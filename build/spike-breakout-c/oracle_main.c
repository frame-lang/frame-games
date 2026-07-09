#include "breakout.c"
#include <stdio.h>
#include <math.h>
static int step = 0;
static Breakout* g;
static long mU(double x) { return lround(x * 1000); }
static void padr(char* o, const char* s, int w) { int n=(int)strlen(s); strcpy(o,s); while(n<w) o[n++]=' '; o[n]='\0'; }
static void padln(char* o, long v, int w) { char t[32]; sprintf(t,"%ld",v); int n=(int)strlen(t),p=w-n; if(p<0)p=0; int k=0; while(k<p)o[k++]=' '; strcpy(o+k,t); }
static void snap(const char* label) {
    char lab[64], st[16], bs[16], sc[8], lv2[8], br[8], vx[8], vy[8], rp[8];
    padr(lab,label,34); padr(st,Breakout_get_state(g),11); padr(bs,Breakout_ball_state(g),9);
    padln(sc,Breakout_get_score(g),4); padln(br,Breakout_bricks_remaining(g),2);
    padln(vx,mU(Breakout_ball_vx(g)),6); padln(vy,mU(Breakout_ball_vy(g)),6);
    if (strcmp(Breakout_get_state(g),"playing")==0) padln(rp,mU(Breakout_ball_respawn_progress(g)),4);
    else padr(rp,"   -",4);
    printf("%03d %s st=%s sc=%s lv=%d lvl=%d br=%s | ball=%s vx=%s vy=%s rp=%s\n",
        step, lab, st, sc, Breakout_get_lives(g), Breakout_get_level(g), br, bs, vx, vy, rp);
    step++;
}
static void run(int n, const char* label) { char b[80]; for(int i=0;i<n;i++) Breakout_tick(g,1.0/64.0); sprintf(b,"pump x%d (%s)",n,label); snap(b); }
int main(void) {
    g = Breakout_create();
    snap("created"); Breakout_start(g); snap("start -> playing, ball attached");
    printf("OP  get_current_state_name=%s\n", Breakout_get_current_state_name(g));
    Breakout_launch_ball(g,3.5,-4.25); snap("launch(3.5,-4.25) -> in_flight [ENTER-ARGS]");
    Breakout_wall_bounce_x(g); snap("wall_bounce_x -> vx negated");
    Breakout_wall_bounce_y(g); snap("wall_bounce_y -> vy negated");
    Breakout_paddle_hit(g,2.75,-5.5); snap("paddle_hit -> set_velocity(2.75,-5.5)");
    Breakout_brick_hit(g,0); snap("brick_hit(0): +10, vy flip, broken");
    Breakout_brick_hit(g,0); Breakout_brick_hit(g,999); Breakout_brick_hit(g,-1); snap("brick_hit dead/oob: NO score change");
    Breakout_brick_hit(g,1); Breakout_brick_hit(g,2); snap("brick_hit(1,2): +20");
    Breakout_pause(g); snap("pause during PLAYING (push)"); run(64,"1.0s paused: ball frozen"); Breakout_resume(g); snap("resume (pop -> playing)");
    Breakout_ball_fell_off(g); snap("ball_fell_off -> lives-1, ball lost");
    run(64,"1.0s: respawn progress ~0.5"); run(63,"just before 2.0s: still lost"); run(1,"tick 2.0s: ball -> attached");
    Breakout_launch_ball(g,3.5,-4.25); snap("re-launch (fresh in_flight)");
    for(int i=3;i<40;i++) Breakout_brick_hit(g,i); snap("cleared wall -> level_clear (lvl 2)");
    Breakout_start(g); snap("start -> playing, fresh wall of 40");
    Breakout_ball_fell_off(g); snap("fell off -> lives 1"); Breakout_ball_fell_off(g); snap("fell off -> lives 0 -> game_over");
    Breakout_restart(g); snap("restart -> attract (reset)");
    Breakout* g2 = Breakout_create(); Breakout_start(g2); Breakout_launch_ball(g2,1.0,-1.0); Breakout_ball_fell_off(g2);
    for(int i=0;i<32;i++) Breakout_tick(g2,1.0/64.0); long rpb=mU(Breakout_ball_respawn_progress(g2)); Breakout_pause(g2);
    for(int i=0;i<128;i++) Breakout_tick(g2,1.0/64.0); Breakout_resume(g2); long rpa=mU(Breakout_ball_respawn_progress(g2));
    printf("PAUSE respawn frozen: before=%ld after=%ld ball=%s (paused ticks must not advance the ball)\n", rpb, rpa, Breakout_ball_state(g2));
    Breakout* g3 = Breakout_create(); Breakout_start(g3);
    printf("BRICK is_broken: fresh0=%s oobNeg=%s oobBig=%s (expect false, true, true)\n",
        Breakout_is_brick_broken(g3,0)?"true":"false", Breakout_is_brick_broken(g3,-1)?"true":"false", Breakout_is_brick_broken(g3,999)?"true":"false");
    return 0;
}
