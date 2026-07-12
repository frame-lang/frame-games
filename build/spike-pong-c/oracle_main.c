#include "pong.c"
#include <stdio.h>
static int step = 0;
static int bU(bool x) { return x ? 1 : 0; }
static void padr(char* o, const char* s, int w) { int n=(int)strlen(s); strcpy(o,s); while(n<w) o[n++]=' '; o[n]='\0'; }
static void padln(char* o, long v, int w) { char t[32]; sprintf(t,"%ld",v); int n=(int)strlen(t),p=w-n; if(p<0)p=0; int k=0; while(k<p)o[k++]=' '; strcpy(o+k,t); }
static Pong* g;
static void snap(const char* label) {
    char lab[64], st[16], wn[16], sl[8], sr[8], sv[8];
    padr(lab,label,38); padr(st,Pong_get_current_state_name(g),12); padr(wn,Pong_get_winner(g),6);
    padln(sl,Pong_get_score_left(g),2); padln(sr,Pong_get_score_right(g),2); padln(sv,Pong_get_serve_direction(g),2);
    printf("%03d %s st=%s sl=%s sr=%s serve=%s play=%d winner=%s\n",
        step, lab, st, sl, sr, sv, bU(Pong_is_playing(g)), wn);
    step++;
}
static void pointRight(Pong* x) { Pong_launch(x); Pong_ball_out_left(x); }
static void pointLeft(Pong* x) { Pong_launch(x); Pong_ball_out_right(x); }
int main(void) {
    g = Pong_create();
    snap("created (AttractMode / 0-0)");
    printf("OP  get_current_state_name=%s get_winning_score=%d\n", Pong_get_current_state_name(g), Pong_get_winning_score(g));

    Pong_start(g); snap("start -> Serving");
    Pong_pause(g); snap("pause during Serving (push)");
    Pong_resume(g); snap("resume (pop -> Serving)");
    Pong_launch(g); snap("launch -> InPlay (playing)");
    Pong_pause(g); snap("pause during InPlay (push)");
    Pong_resume(g); snap("resume (pop -> InPlay)");
    Pong_ball_out_left(g); snap("ball_out_left -> right+1, serve -1");
    pointLeft(g); snap("pointLeft -> left+1, serve +1");
    for (int i=0;i<9;i++) pointRight(g);
    snap("right at 10 (one short of 11)");
    pointRight(g); snap("right scores 11 -> GameOver [right wins]");
    printf("WIN winner=%s playing=%d sl=%d sr=%d\n", Pong_get_winner(g), bU(Pong_is_playing(g)), Pong_get_score_left(g), Pong_get_score_right(g));
    Pong_restart(g); snap("restart -> AttractMode (reset)");

    Pong* g2 = Pong_create();
    Pong_start(g2);
    for (int i=0;i<11;i++) pointLeft(g2);
    printf("MIRROR left win: st=%s winner=%s sl=%d serve=%d\n", Pong_get_current_state_name(g2), Pong_get_winner(g2), Pong_get_score_left(g2), Pong_get_serve_direction(g2));
    return 0;
}
