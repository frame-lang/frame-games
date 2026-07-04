// Asteroids — Swift host for the Frame AsteroidsGame controller. Same FSM as
// the other ports (AsteroidsGame.swift, generated from AsteroidsGame.fswift);
// this is the engine layer, compiled to WebAssembly by SwiftWasm. Rendering is
// HTML canvas 2D via JavaScriptKit (JSObject dynamic-member bridge); input, the
// requestAnimationFrame loop, and live FSM state (BroadcastChannel) all cross
// through JSObject.global. The four IShipHost callbacks are plain Swift methods.
import JavaScriptKit
#if canImport(Darwin)
import Darwin
#elseif canImport(WASILibc)
import WASILibc
#endif

let COURT_W = 800.0
let COURT_H = 600.0
let COL_SHIP = "#8ab4f8"
let COL_ROCK = "#9aa4b8"
let COL_BULLET = "#ffffff"
let COL_FLAME = "#ffad42"
let COL_TEXT = "#ffffff"
let SHIP_THRUST = 240.0
let SHIP_ROT = 4.0
let SHIP_MAX = 320.0
let SHIP_DRAG = 0.5
let SHIP_SIZE = 14.0
let BULLET_SPEED = 500.0
let BULLET_LIFE = 1.2
let BULLET_SIZE = 2.4

final class Bullet {
    var pos: Vec2
    var vel: Vec2
    var life: Double
    init(_ pos: Vec2, _ vel: Vec2) { self.pos = pos; self.vel = vel; self.life = 0 }
}

final class BrowserHost: IShipHost {
    weak var game: SwiftGame?
    func warp_out() {
        guard let g = game else { return }
        g.shipPos = Vec2(rf() * COURT_W, rf() * COURT_H)
        g.shipVel = Vec2(0, 0)
    }
    func warp_in() {}
    func spawn_explosion() {}
    func reset_ship() { game?.resetShip() }
}

final class SwiftGame {
    let ctx: JSObject
    let fsm: AsteroidsGame
    let host = BrowserHost()
    let court = Vec2(COURT_W, COURT_H)
    var shipPos = Vec2(COURT_W / 2, COURT_H / 2)
    var shipVel = Vec2(0, 0)
    var shipAngle = -Double.pi / 2
    var bullets: [Bullet] = []
    var keys = Set<String>()
    var lastPub = ""
    var chan: JSObject?

    init(ctx: JSObject) {
        self.ctx = ctx
        fsm = AsteroidsGame.__create(host, 2)
        host.game = self
        if let bc = JSObject.global.BroadcastChannel.function {
            chan = bc.new("frame-games:state:asteroids")
        }
        resetShip()
    }

    func resetShip() {
        shipPos = Vec2(COURT_W / 2, COURT_H / 2)
        shipVel = Vec2(0, 0)
        shipAngle = -Double.pi / 2
        for _ in bullets { fsm.bullet_expired() }
        bullets.removeAll()
    }

    // ── input ──
    func thrustHeld() -> Bool { keys.contains("ArrowUp") || keys.contains("KeyW") }

    func onKeyDown(_ code: String) {
        let state = fsm.get_current_state_name()
        if state == "Attract" { fsm.start(); bullets.removeAll(); return }
        if state == "GameOver" {
            if code == "KeyR" { fsm.restart(); fsm.start(); bullets.removeAll() }
            return
        }
        if code == "KeyP" {
            if fsm.is_paused() { fsm.resume() } else { fsm.pause() }
            return
        }
        if fsm.is_paused() { return }
        if code == "KeyH" && fsm.ship.can_hyperspace() { fsm.ship_hyperspace() }
    }

    // ── frame ──
    func update(_ dt: Double) {
        let state = fsm.get_current_state_name()
        if state == "Attract" || state == "GameOver" || fsm.is_paused() { return }
        handleInput(dt)
        fsm.tick(dt, court)
        updateShip(dt)
        updateBullets(dt)
        checkCollisions()
    }

    func handleInput(_ dt: Double) {
        if !fsm.ship.is_visible() { return }
        if keys.contains("ArrowLeft") || keys.contains("KeyA") { shipAngle -= SHIP_ROT * dt }
        if keys.contains("ArrowRight") || keys.contains("KeyD") { shipAngle += SHIP_ROT * dt }
        let ss = fsm.ship.get_current_state_name()
        if (ss == "Alive" || ss == "Respawning") && thrustHeld() {
            shipVel = shipVel.add(Vec2(cos(shipAngle), sin(shipAngle)).scale(SHIP_THRUST * dt))
            if shipVel.length() > SHIP_MAX { shipVel = shipVel.scale(SHIP_MAX / shipVel.length()) }
        }
        if fsm.ship.can_fire() && fsm.get_bullets_in_flight() < fsm.get_max_bullets() && keys.contains("Space") {
            tryFire()
        }
    }

    func tryFire() {
        fsm.ship.fire()
        let d = Vec2(cos(shipAngle), sin(shipAngle))
        bullets.append(Bullet(shipPos.add(d.scale(SHIP_SIZE)), d.scale(BULLET_SPEED).add(shipVel)))
        fsm.bullet_fired()
    }

    func wrap(_ p: Vec2) {
        if p.x < 0 { p.x += COURT_W }
        if p.x > COURT_W { p.x -= COURT_W }
        if p.y < 0 { p.y += COURT_H }
        if p.y > COURT_H { p.y -= COURT_H }
    }

    func updateShip(_ dt: Double) {
        if !fsm.ship.is_visible() { return }
        shipVel = shipVel.scale(1.0 - SHIP_DRAG * dt)
        shipPos = shipPos.add(shipVel.scale(dt))
        wrap(shipPos)
    }

    func updateBullets(_ dt: Double) {
        for i in stride(from: bullets.count - 1, through: 0, by: -1) {
            let b = bullets[i]
            b.pos = b.pos.add(b.vel.scale(dt))
            b.life += dt
            wrap(b.pos)
            if b.life >= BULLET_LIFE { bullets.remove(at: i); fsm.bullet_expired() }
        }
    }

    func checkCollisions() {
        let total = fsm.field.count()
        for bi in stride(from: bullets.count - 1, through: 0, by: -1) {
            let bp = bullets[bi].pos
            var hit = -1
            for i in 0..<total {
                if fsm.field.is_alive(i) && fsm.field.position(i).distanceTo(bp) < fsm.field.radius_of(i) { hit = i; break }
            }
            if hit >= 0 { fsm.bullet_hit_asteroid(hit); bullets.remove(at: bi); fsm.bullet_expired() }
        }
        if fsm.ship.can_be_hit() {
            for i in 0..<total {
                if fsm.field.is_alive(i) && fsm.field.position(i).distanceTo(shipPos) < fsm.field.radius_of(i) + SHIP_SIZE * 0.6 {
                    fsm.ship_hit_asteroid(i)
                    break
                }
            }
        }
    }

    func publishState() {
        let g = fsm.get_current_state_name()
        let s = fsm.ship.get_current_state_name()
        let snap = "\(g)|\(s)"
        if snap == lastPub { return }
        lastPub = snap
        if let chan = chan {
            let msg = JSObject.global.Object.function!.new()
            msg.AsteroidsGame = .string(g)
            msg.Ship = .string(s)
            msg.AsteroidField = .string("Active")
            _ = chan.postMessage!(msg)
        }
    }

    // ── render ──
    func draw(_ now: Double) {
        var c = JSValue.object(ctx)
        c.fillStyle = "#000000"
        _ = c.fillRect(0, 0, COURT_W, COURT_H)
        let state = fsm.get_current_state_name()
        let total = fsm.field.count()

        c.strokeStyle = .string(COL_ROCK)
        c.lineWidth = 1.5
        for i in 0..<total {
            if fsm.field.is_alive(i) {
                let p = fsm.field.position(i)
                _ = c.beginPath()
                _ = c.arc(p.x, p.y, fsm.field.radius_of(i), 0, Double.pi * 2)
                _ = c.stroke()
            }
        }

        c.fillStyle = .string(COL_BULLET)
        for b in bullets {
            _ = c.beginPath()
            _ = c.arc(b.pos.x, b.pos.y, BULLET_SIZE, 0, Double.pi * 2)
            _ = c.fill()
        }

        if state != "Attract" && state != "GameOver" && fsm.ship.is_visible() {
            let ss = fsm.ship.get_current_state_name()
            if ss == "Exploding" {
                drawExplosion(&c)
            } else {
                var visible = true
                if ss == "Respawning" { visible = (Int(now / 100) % 2 == 0) }
                if visible { drawShip(&c) }
            }
        }

        drawHud(&c, state)
    }

    func drawShip(_ c: inout JSValue) {
        let a = shipAngle
        let at = shipPos
        let nose = at.add(Vec2(cos(a), sin(a)).scale(SHIP_SIZE))
        let left = at.add(Vec2(cos(a + 2.5), sin(a + 2.5)).scale(SHIP_SIZE))
        let right = at.add(Vec2(cos(a - 2.5), sin(a - 2.5)).scale(SHIP_SIZE))
        c.strokeStyle = .string(COL_SHIP)
        c.lineWidth = 1.5
        _ = c.beginPath()
        _ = c.moveTo(nose.x, nose.y)
        _ = c.lineTo(left.x, left.y)
        _ = c.lineTo(right.x, right.y)
        _ = c.closePath()
        _ = c.stroke()
        if thrustHeld() {
            let ss = fsm.ship.get_current_state_name()
            if ss == "Alive" || ss == "Respawning" {
                let tb = left.add(right).scale(0.5)
                let tt = at.add(Vec2(cos(a), sin(a)).scale(-SHIP_SIZE * 1.4))
                c.strokeStyle = .string(COL_FLAME)
                _ = c.beginPath()
                _ = c.moveTo(tb.x, tb.y)
                _ = c.lineTo(tt.x, tt.y)
                _ = c.stroke()
            }
        }
    }

    func drawExplosion(_ c: inout JSValue) {
        let at = shipPos
        c.strokeStyle = .string(COL_SHIP)
        for i in 0..<8 {
            let t = Double(i) / 8.0 * Double.pi * 2
            _ = c.beginPath()
            _ = c.moveTo(at.x + cos(t) * 4, at.y + sin(t) * 4)
            _ = c.lineTo(at.x + cos(t) * 14, at.y + sin(t) * 14)
            _ = c.stroke()
        }
    }

    func drawHud(_ c: inout JSValue, _ state: String) {
        c.fillStyle = .string(COL_TEXT)
        c.textAlign = "left"
        c.font = "16px monospace"
        let score = String(format5(fsm.get_score()))
        _ = c.fillText("SCORE  \(score)     LIVES  \(fsm.get_lives())     WAVE  \(fsm.get_wave())" +
                       "     DIFF  \(fsm.get_difficulty())     WARP  \(fsm.ship.get_hyperspaces_remaining())", 12, 24)

        var msg: [String]? = nil
        if state == "Attract" { msg = ["A S T E R O I D S", "", "Press any key to start", "(H hyperspace - P pause)"] }
        else if state == "WaveClear" { msg = ["WAVE CLEAR"] }
        else if state == "Paused" { msg = ["PAUSED"] }
        else if state == "GameOver" { msg = ["GAME OVER", "", "Press R to restart"] }
        guard let lines = msg else { return }
        c.textAlign = "center"
        c.font = "26px monospace"
        var y = COURT_H * 0.4
        for line in lines {
            if !line.isEmpty { _ = c.fillText(line, COURT_W / 2, y) }
            y += 38
        }
    }

    func format5(_ n: Int) -> String {
        var s = String(n)
        while s.count < 5 { s = "0" + s }
        return s
    }
}

// ── bootstrap ──
func runGame() {
    let document = JSObject.global.document
    let canvas = document.getElementById("game").object!
    let ctx = canvas.getContext!("2d").object!
    let game = SwiftGame(ctx: ctx)

    let held: Set<String> = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]
    let keydown = JSClosure { args in
        let e = args[0]
        let code = e.code.string ?? ""
        if held.contains(code) { _ = e.preventDefault() }
        game.keys.insert(code)
        game.onKeyDown(code)
        return .undefined
    }
    let keyup = JSClosure { args in
        game.keys.remove(args[0].code.string ?? "")
        return .undefined
    }
    _ = JSObject.global.window.addEventListener("keydown", keydown)
    _ = JSObject.global.window.addEventListener("keyup", keyup)

    if JSObject.global.location.hash.string == "#autostart" { game.fsm.start() }  // dev/headless capture

    var last = 0.0
    var frameClosure: JSClosure!
    frameClosure = JSClosure { args in
        let now = args[0].number ?? 0
        var dt = last == 0 ? 0.016 : (now - last) / 1000.0
        if dt > 0.05 { dt = 0.05 }
        last = now
        game.update(dt)
        game.publishState()
        game.draw(now)
        _ = JSObject.global.requestAnimationFrame!(frameClosure)
        return .undefined
    }
    _ = JSObject.global.requestAnimationFrame!(frameClosure)
}

