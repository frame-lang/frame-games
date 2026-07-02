// Asteroids — Go/Ebitengine host for the Frame AsteroidsGame controller.
// Implements ebiten.Game (Update/Draw/Layout) and ShipHost. Layout() returns a
// fixed 800x600, so Ebiten letterboxes to the window automatically — the
// canvas_items/keep equivalent, for free. Mirrors the other ports.
package main

import (
	"bytes"
	"fmt"
	"image/color"
	"math"
	"syscall/js"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/inpututil"
	"github.com/hajimehoshi/ebiten/v2/text/v2"
	"github.com/hajimehoshi/ebiten/v2/vector"
	"golang.org/x/image/font/gofont/goregular"
)

const (
	courtW = 800
	courtH = 600

	shipThrust        = 240.0
	shipRotationSpeed = 4.0
	shipMaxSpeed      = 320.0
	shipDrag          = 0.5
	shipSize          = 14.0
	bulletSpeed       = 500.0
	bulletLifetime    = 1.2
	bulletSize        = 2.0
)

var (
	colShip   = color.RGBA{0x8a, 0xb4, 0xf8, 0xff}
	colRock   = color.RGBA{0x9a, 0xa4, 0xb8, 0xff}
	colBullet = color.RGBA{0xff, 0xff, 0xff, 0xff}
	colFlame  = color.RGBA{0xff, 0xad, 0x42, 0xff}
	colText   = color.White
)

type bullet struct {
	pos, vel Vec2
	life     float64
}

type Game struct {
	fsm       *AsteroidsGame
	shipPos   Vec2
	shipVel   Vec2
	shipAngle float64
	bullets   []bullet
	court     Vec2
	lastPub   string
	hud       *text.GoTextFace
	center    *text.GoTextFace
	chan_     js.Value
	ticks     int
}

func newGame() *Game {
	g := &Game{court: Vec2{courtW, courtH}, shipAngle: -math.Pi * 0.5}
	g.fsm = CreateAsteroidsGame(g, 2)
	src, err := text.NewGoTextFaceSource(bytes.NewReader(goregular.TTF))
	if err != nil {
		panic(err)
	}
	g.hud = &text.GoTextFace{Source: src, Size: 18}
	g.center = &text.GoTextFace{Source: src, Size: 28}
	if bc := js.Global().Get("BroadcastChannel"); bc.Truthy() {
		g.chan_ = bc.New("frame-games:state:asteroids")
	}
	g.resetShip()
	return g
}

// ---- ShipHost ----
func (g *Game) WarpOut() {
	g.shipPos = Vec2{rf() * g.court.X, rf() * g.court.Y}
	g.shipVel = Vec2{0, 0}
}
func (g *Game) WarpIn()         {}
func (g *Game) SpawnExplosion() {}
func (g *Game) ResetShip()      { g.resetShip() }
func (g *Game) resetShip() {
	g.shipPos = g.court.Scale(0.5)
	g.shipVel = Vec2{0, 0}
	g.shipAngle = -math.Pi * 0.5
	for range g.bullets {
		g.fsm.Bullet_expired()
	}
	g.bullets = g.bullets[:0]
}

// ---- ebiten.Game ----
func (g *Game) Layout(int, int) (int, int) { return courtW, courtH }

func (g *Game) Update() error {
	g.ticks++
	dt := 1.0 / float64(ebiten.TPS())
	g.handleInput(dt)
	state := g.fsm.Get_current_state_name()
	if !g.fsm.Is_paused() && state != "Attract" && state != "GameOver" {
		g.fsm.Tick(dt, g.court)
		g.updateShip(dt)
		g.updateBullets(dt)
		g.checkCollisions()
	}
	g.publishState()
	return nil
}

func (g *Game) thrustHeld() bool {
	return ebiten.IsKeyPressed(ebiten.KeyUp) || ebiten.IsKeyPressed(ebiten.KeyW)
}

func (g *Game) handleInput(dt float64) {
	state := g.fsm.Get_current_state_name()
	if state == "Attract" {
		if len(inpututil.AppendJustPressedKeys(nil)) > 0 {
			g.fsm.Start()
			g.bullets = g.bullets[:0]
		}
		return
	}
	if state == "GameOver" {
		if inpututil.IsKeyJustPressed(ebiten.KeyR) {
			g.fsm.Restart()
			g.fsm.Start()
			g.bullets = g.bullets[:0]
		}
		return
	}
	if inpututil.IsKeyJustPressed(ebiten.KeyP) {
		if g.fsm.Is_paused() {
			g.fsm.Resume()
		} else {
			g.fsm.Pause()
		}
	}
	if g.fsm.Is_paused() || !g.fsm.ship.Is_visible() {
		return
	}
	if ebiten.IsKeyPressed(ebiten.KeyLeft) || ebiten.IsKeyPressed(ebiten.KeyA) {
		g.shipAngle -= shipRotationSpeed * dt
	}
	if ebiten.IsKeyPressed(ebiten.KeyRight) || ebiten.IsKeyPressed(ebiten.KeyD) {
		g.shipAngle += shipRotationSpeed * dt
	}
	ss := g.fsm.ship.Get_current_state_name()
	if (ss == "Alive" || ss == "Respawning") && g.thrustHeld() {
		g.shipVel = g.shipVel.Add(Vec2{math.Cos(g.shipAngle), math.Sin(g.shipAngle)}.Scale(shipThrust * dt))
		if g.shipVel.Length() > shipMaxSpeed {
			g.shipVel = g.shipVel.Scale(shipMaxSpeed / g.shipVel.Length())
		}
	}
	if g.fsm.ship.Can_fire() && g.fsm.Get_bullets_in_flight() < g.fsm.Get_max_bullets() && ebiten.IsKeyPressed(ebiten.KeySpace) {
		g.tryFire()
	}
	if inpututil.IsKeyJustPressed(ebiten.KeyH) && g.fsm.ship.Can_hyperspace() {
		g.fsm.Ship_hyperspace()
	}
}

func (g *Game) tryFire() {
	g.fsm.ship.Fire()
	dir := Vec2{math.Cos(g.shipAngle), math.Sin(g.shipAngle)}
	g.bullets = append(g.bullets, bullet{g.shipPos.Add(dir.Scale(shipSize)), dir.Scale(bulletSpeed).Add(g.shipVel), 0})
	g.fsm.Bullet_fired()
}

func (g *Game) updateShip(dt float64) {
	if !g.fsm.ship.Is_visible() {
		return
	}
	g.shipVel = g.shipVel.Scale(1.0 - shipDrag*dt)
	g.shipPos = g.shipPos.Add(g.shipVel.Scale(dt))
	g.shipPos = wrap(g.shipPos, g.court)
}

func (g *Game) updateBullets(dt float64) {
	out := g.bullets[:0]
	for _, b := range g.bullets {
		b.pos = wrap(b.pos.Add(b.vel.Scale(dt)), g.court)
		b.life += dt
		if b.life >= bulletLifetime {
			g.fsm.Bullet_expired()
			continue
		}
		out = append(out, b)
	}
	g.bullets = out
}

func (g *Game) checkCollisions() {
	total := g.fsm.field.Count()
	kept := g.bullets[:0]
	for _, b := range g.bullets {
		hit := -1
		for i := 0; i < total; i++ {
			if g.fsm.field.Is_alive(i) && g.fsm.field.Position(i).DistanceTo(b.pos) < g.fsm.field.Radius_of(i) {
				hit = i
				break
			}
		}
		if hit >= 0 {
			g.fsm.Bullet_hit_asteroid(hit)
			g.fsm.Bullet_expired()
			continue
		}
		kept = append(kept, b)
	}
	g.bullets = kept
	if g.fsm.ship.Can_be_hit() {
		for i := 0; i < total; i++ {
			if g.fsm.field.Is_alive(i) && g.fsm.field.Position(i).DistanceTo(g.shipPos) < g.fsm.field.Radius_of(i)+shipSize*0.6 {
				g.fsm.Ship_hit_asteroid(i)
				break
			}
		}
	}
}

func wrap(p, court Vec2) Vec2 {
	if p.X < 0 {
		p.X += court.X
	}
	if p.X > court.X {
		p.X -= court.X
	}
	if p.Y < 0 {
		p.Y += court.Y
	}
	if p.Y > court.Y {
		p.Y -= court.Y
	}
	return p
}

// ---- rendering ----
func (g *Game) Draw(screen *ebiten.Image) {
	screen.Fill(color.Black)
	state := g.fsm.Get_current_state_name()
	total := g.fsm.field.Count()
	for i := 0; i < total; i++ {
		if g.fsm.field.Is_alive(i) {
			p := g.fsm.field.Position(i)
			vector.StrokeCircle(screen, float32(p.X), float32(p.Y), float32(g.fsm.field.Radius_of(i)), 1.5, colRock, true)
		}
	}
	for _, b := range g.bullets {
		vector.DrawFilledCircle(screen, float32(b.pos.X), float32(b.pos.Y), bulletSize, colBullet, true)
	}
	if state != "Attract" && state != "GameOver" && g.fsm.ship.Is_visible() {
		ss := g.fsm.ship.Get_current_state_name()
		if ss == "Exploding" {
			g.drawExplosion(screen, g.shipPos)
		} else {
			visible := true
			if ss == "Respawning" {
				visible = (g.ticks/6)%2 == 0
			}
			if visible {
				g.drawShip(screen, g.shipPos, g.shipAngle)
			}
		}
	}
	g.drawHUD(screen, state)
}

func (g *Game) drawShip(screen *ebiten.Image, at Vec2, ang float64) {
	nose := at.Add(Vec2{math.Cos(ang), math.Sin(ang)}.Scale(shipSize))
	left := at.Add(Vec2{math.Cos(ang + 2.5), math.Sin(ang + 2.5)}.Scale(shipSize))
	right := at.Add(Vec2{math.Cos(ang - 2.5), math.Sin(ang - 2.5)}.Scale(shipSize))
	line(screen, nose, left, colShip)
	line(screen, left, right, colShip)
	line(screen, right, nose, colShip)
	if g.thrustHeld() {
		ss := g.fsm.ship.Get_current_state_name()
		if ss == "Alive" || ss == "Respawning" {
			tb := left.Add(right).Scale(0.5)
			tt := at.Add(Vec2{math.Cos(ang), math.Sin(ang)}.Scale(-shipSize * 1.4))
			line(screen, tb, tt, colFlame)
		}
	}
}

func (g *Game) drawExplosion(screen *ebiten.Image, at Vec2) {
	for i := 0; i < 8; i++ {
		t := float64(i) / 8.0 * math.Pi * 2
		line(screen, at.Add(Vec2{math.Cos(t), math.Sin(t)}.Scale(4)), at.Add(Vec2{math.Cos(t), math.Sin(t)}.Scale(14)), colShip)
	}
}

func line(screen *ebiten.Image, a, b Vec2, clr color.Color) {
	vector.StrokeLine(screen, float32(a.X), float32(a.Y), float32(b.X), float32(b.Y), 1.5, clr, true)
}

func (g *Game) drawHUD(screen *ebiten.Image, state string) {
	hud := fmt.Sprintf("SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
		g.fsm.Get_score(), g.fsm.Get_lives(), g.fsm.Get_wave(), g.fsm.Get_difficulty(),
		g.fsm.ship.Get_hyperspaces_remaining())
	op := &text.DrawOptions{}
	op.GeoM.Translate(12, 8)
	op.ColorScale.ScaleWithColor(colText)
	text.Draw(screen, hud, g.hud, op)

	var msg string
	switch state {
	case "Attract":
		msg = "A S T E R O I D S\n\nPress any key to start\n(H hyperspace · P pause)"
	case "WaveClear":
		msg = "WAVE CLEAR"
	case "Paused":
		msg = "PAUSED"
	case "GameOver":
		msg = "GAME OVER\n\nPress R to restart"
	}
	if msg != "" {
		cop := &text.DrawOptions{}
		cop.GeoM.Translate(courtW/2, courtH*0.40)
		cop.ColorScale.ScaleWithColor(colText)
		cop.LineSpacing = 38
		cop.PrimaryAlign = text.AlignCenter
		text.Draw(screen, msg, g.center, cop)
	}
}

// ---- live FSM state -> BroadcastChannel (native via syscall/js) ----
func (g *Game) publishState() {
	gs := g.fsm.Get_current_state_name()
	sh := g.fsm.ship.Get_current_state_name()
	snap := gs + "|" + sh
	if snap == g.lastPub || !g.chan_.Truthy() {
		g.lastPub = snap
		return
	}
	g.lastPub = snap
	msg := map[string]any{"AsteroidsGame": gs, "Ship": sh, "AsteroidField": "Active"}
	g.chan_.Call("postMessage", js.ValueOf(msg))
}

func main() {
	ebiten.SetWindowTitle("Asteroids")
	if err := ebiten.RunGame(newGame()); err != nil {
		panic(err)
	}
}
