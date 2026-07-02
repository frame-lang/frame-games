// Asteroids — Kotlin host for the Frame AsteroidsGame controller. Same FSM as
// the other ports (asteroids.kt, generated from asteroids.fkt); this is the
// engine layer, compiled to JavaScript by Kotlin/JS (IR). Rendering is HTML
// canvas 2D via kotlinx.browser + org.w3c.dom; input, the rAF loop, and live
// FSM state (BroadcastChannel via dynamic interop) run in the page. The four
// IShipHost callbacks are plain Kotlin methods.
import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.CanvasRenderingContext2D
import org.w3c.dom.CanvasTextAlign
import org.w3c.dom.HTMLCanvasElement
import org.w3c.dom.LEFT
import org.w3c.dom.CENTER
import org.w3c.dom.events.KeyboardEvent
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

const val COURT_W = 800.0
const val COURT_H = 600.0
const val COL_SHIP = "#8ab4f8"
const val COL_ROCK = "#9aa4b8"
const val COL_BULLET = "#ffffff"
const val COL_FLAME = "#ffad42"
const val COL_TEXT = "#ffffff"
const val SHIP_THRUST = 240.0
const val SHIP_ROT = 4.0
const val SHIP_MAX = 320.0
const val SHIP_DRAG = 0.5
const val SHIP_SIZE = 14.0
const val BULLET_SPEED = 500.0
const val BULLET_LIFE = 1.2
const val BULLET_SIZE = 2.4

class Bullet(var pos: Vec2, var vel: Vec2, var life: Double)

class Host : IShipHost {
    lateinit var game: Game
    override fun warp_out() {
        game.shipPos = Vec2(kotlin.random.Random.nextDouble() * COURT_W, kotlin.random.Random.nextDouble() * COURT_H)
        game.shipVel = Vec2(0.0, 0.0)
    }
    override fun warp_in() {}
    override fun spawn_explosion() {}
    override fun reset_ship() { game.resetShip() }
}

class Game(val ctx: CanvasRenderingContext2D) {
    val host = Host()
    val fsm: AsteroidsGame
    val court = Vec2(COURT_W, COURT_H)
    var shipPos = Vec2(COURT_W / 2, COURT_H / 2)
    var shipVel = Vec2(0.0, 0.0)
    var shipAngle = -PI / 2
    val bullets = mutableListOf<Bullet>()
    val keys = mutableSetOf<String>()
    var lastPub = ""
    val chan: dynamic

    init {
        host.game = this
        fsm = AsteroidsGame.__create(host, 2)
        chan = try { js("new BroadcastChannel('frame-games:state:asteroids')") } catch (e: Throwable) { null }
        resetShip()
    }

    fun resetShip() {
        shipPos = Vec2(COURT_W / 2, COURT_H / 2)
        shipVel = Vec2(0.0, 0.0)
        shipAngle = -PI / 2
        repeat(bullets.size) { fsm.bullet_expired() }
        bullets.clear()
    }

    // ── input ──
    fun thrustHeld() = "ArrowUp" in keys || "KeyW" in keys

    fun onKeyDown(code: String) {
        when (fsm.get_current_state_name()) {
            "Attract" -> { fsm.start(); bullets.clear(); return }
            "GameOver" -> {
                if (code == "KeyR") { fsm.restart(); fsm.start(); bullets.clear() }
                return
            }
        }
        if (code == "KeyP") {
            if (fsm.is_paused()) fsm.resume() else fsm.pause()
            return
        }
        if (fsm.is_paused()) return
        if (code == "KeyH" && fsm.ship.can_hyperspace()) fsm.ship_hyperspace()
    }

    // ── frame ──
    fun update(dt: Double) {
        val state = fsm.get_current_state_name()
        if (state == "Attract" || state == "GameOver" || fsm.is_paused()) return
        handleInput(dt)
        fsm.tick(dt, court)
        updateShip(dt)
        updateBullets(dt)
        checkCollisions()
    }

    fun handleInput(dt: Double) {
        if (!fsm.ship.is_visible()) return
        if ("ArrowLeft" in keys || "KeyA" in keys) shipAngle -= SHIP_ROT * dt
        if ("ArrowRight" in keys || "KeyD" in keys) shipAngle += SHIP_ROT * dt
        val ss = fsm.ship.get_current_state_name()
        if ((ss == "Alive" || ss == "Respawning") && thrustHeld()) {
            shipVel = shipVel + Vec2(cos(shipAngle), sin(shipAngle)) * (SHIP_THRUST * dt)
            if (shipVel.length() > SHIP_MAX) shipVel = shipVel * (SHIP_MAX / shipVel.length())
        }
        if (fsm.ship.can_fire() && fsm.get_bullets_in_flight() < fsm.get_max_bullets() && "Space" in keys) tryFire()
    }

    fun tryFire() {
        fsm.ship.fire()
        val d = Vec2(cos(shipAngle), sin(shipAngle))
        bullets.add(Bullet(shipPos + d * SHIP_SIZE, d * BULLET_SPEED + shipVel, 0.0))
        fsm.bullet_fired()
    }

    fun wrap(p: Vec2) {
        if (p.x < 0) p.x += COURT_W
        if (p.x > COURT_W) p.x -= COURT_W
        if (p.y < 0) p.y += COURT_H
        if (p.y > COURT_H) p.y -= COURT_H
    }

    fun updateShip(dt: Double) {
        if (!fsm.ship.is_visible()) return
        shipVel = shipVel * (1.0 - SHIP_DRAG * dt)
        shipPos = shipPos + shipVel * dt
        wrap(shipPos)
    }

    fun updateBullets(dt: Double) {
        for (i in bullets.indices.reversed()) {
            val b = bullets[i]
            b.pos = b.pos + b.vel * dt
            b.life += dt
            wrap(b.pos)
            if (b.life >= BULLET_LIFE) { bullets.removeAt(i); fsm.bullet_expired() }
        }
    }

    fun checkCollisions() {
        val total = fsm.field.count()
        for (bi in bullets.indices.reversed()) {
            val bp = bullets[bi].pos
            var hit = -1
            for (i in 0 until total) {
                if (fsm.field.is_alive(i) && fsm.field.position(i).distanceTo(bp) < fsm.field.radius_of(i)) { hit = i; break }
            }
            if (hit >= 0) { fsm.bullet_hit_asteroid(hit); bullets.removeAt(bi); fsm.bullet_expired() }
        }
        if (fsm.ship.can_be_hit()) {
            for (i in 0 until total) {
                if (fsm.field.is_alive(i) && fsm.field.position(i).distanceTo(shipPos) < fsm.field.radius_of(i) + SHIP_SIZE * 0.6) {
                    fsm.ship_hit_asteroid(i)
                    break
                }
            }
        }
    }

    fun publishState() {
        val g = fsm.get_current_state_name()
        val s = fsm.ship.get_current_state_name()
        val snap = "$g|$s"
        if (snap == lastPub) return
        lastPub = snap
        if (chan != null) {
            val msg = js("{}")
            msg.AsteroidsGame = g
            msg.Ship = s
            msg.AsteroidField = "Active"
            chan.postMessage(msg)
        }
    }

    // ── render ──
    fun draw(now: Double) {
        ctx.fillStyle = "#000000"
        ctx.fillRect(0.0, 0.0, COURT_W, COURT_H)
        val state = fsm.get_current_state_name()
        val total = fsm.field.count()

        ctx.strokeStyle = COL_ROCK
        ctx.lineWidth = 1.5
        for (i in 0 until total) {
            if (fsm.field.is_alive(i)) {
                val p = fsm.field.position(i)
                ctx.beginPath()
                ctx.arc(p.x, p.y, fsm.field.radius_of(i), 0.0, PI * 2)
                ctx.stroke()
            }
        }

        ctx.fillStyle = COL_BULLET
        for (b in bullets) {
            ctx.beginPath()
            ctx.arc(b.pos.x, b.pos.y, BULLET_SIZE, 0.0, PI * 2)
            ctx.fill()
        }

        if (state != "Attract" && state != "GameOver" && fsm.ship.is_visible()) {
            val ss = fsm.ship.get_current_state_name()
            if (ss == "Exploding") {
                drawExplosion()
            } else {
                var visible = true
                if (ss == "Respawning") visible = ((now / 100).toInt() % 2 == 0)
                if (visible) drawShip()
            }
        }

        drawHud(state)
    }

    fun drawShip() {
        val a = shipAngle
        val at = shipPos
        val nose = at + Vec2(cos(a), sin(a)) * SHIP_SIZE
        val left = at + Vec2(cos(a + 2.5), sin(a + 2.5)) * SHIP_SIZE
        val right = at + Vec2(cos(a - 2.5), sin(a - 2.5)) * SHIP_SIZE
        ctx.strokeStyle = COL_SHIP
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(nose.x, nose.y)
        ctx.lineTo(left.x, left.y)
        ctx.lineTo(right.x, right.y)
        ctx.closePath()
        ctx.stroke()
        if (thrustHeld()) {
            val ss = fsm.ship.get_current_state_name()
            if (ss == "Alive" || ss == "Respawning") {
                val tb = (left + right) * 0.5
                val tt = at + Vec2(cos(a), sin(a)) * (-SHIP_SIZE * 1.4)
                ctx.strokeStyle = COL_FLAME
                ctx.beginPath()
                ctx.moveTo(tb.x, tb.y)
                ctx.lineTo(tt.x, tt.y)
                ctx.stroke()
            }
        }
    }

    fun drawExplosion() {
        val at = shipPos
        ctx.strokeStyle = COL_SHIP
        for (i in 0 until 8) {
            val t = i / 8.0 * PI * 2
            ctx.beginPath()
            ctx.moveTo(at.x + cos(t) * 4, at.y + sin(t) * 4)
            ctx.lineTo(at.x + cos(t) * 14, at.y + sin(t) * 14)
            ctx.stroke()
        }
    }

    fun drawHud(state: String) {
        ctx.fillStyle = COL_TEXT
        ctx.textAlign = CanvasTextAlign.LEFT
        ctx.font = "16px monospace"
        val score = fsm.get_score().toString().padStart(5, '0')
        ctx.fillText("SCORE  $score     LIVES  ${fsm.get_lives()}     WAVE  ${fsm.get_wave()}" +
                "     DIFF  ${fsm.get_difficulty()}     WARP  ${fsm.ship.get_hyperspaces_remaining()}", 12.0, 24.0)

        val msg: Array<String>? = when (state) {
            "Attract" -> arrayOf("A S T E R O I D S", "", "Press any key to start", "(H hyperspace - P pause)")
            "WaveClear" -> arrayOf("WAVE CLEAR")
            "Paused" -> arrayOf("PAUSED")
            "GameOver" -> arrayOf("GAME OVER", "", "Press R to restart")
            else -> null
        }
        if (msg == null) return
        ctx.textAlign = CanvasTextAlign.CENTER
        ctx.font = "26px monospace"
        var y = COURT_H * 0.4
        for (line in msg) {
            if (line.isNotEmpty()) ctx.fillText(line, COURT_W / 2, y)
            y += 38.0
        }
    }
}

fun main() {
    val canvas = document.getElementById("game") as HTMLCanvasElement
    val ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    val game = Game(ctx)

    val held = setOf("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space")
    window.addEventListener("keydown", { e ->
        e as KeyboardEvent
        if (e.code in held) e.preventDefault()
        game.keys.add(e.code)
        game.onKeyDown(e.code)
    })
    window.addEventListener("keyup", { e ->
        game.keys.remove((e as KeyboardEvent).code)
    })

    if (window.location.hash == "#autostart") game.fsm.start()  // dev/headless capture

    var last = 0.0
    fun frame(now: Double) {
        val dt = (if (last == 0.0) 0.016 else (now - last) / 1000.0).coerceAtMost(0.05)
        last = now
        game.update(dt)
        game.publishState()
        game.draw(now)
        window.requestAnimationFrame(::frame)
    }
    window.requestAnimationFrame(::frame)
}
