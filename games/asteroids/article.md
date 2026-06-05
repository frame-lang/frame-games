# Asteroids

Asteroids gameplay is managed by two controller systems — the **AsteroidsGame** which implements the overall gameplay and **Ship** which implements the ship logic.

A few terms used throughout:

- **Frame system (controllers)** — the Frame systems that manage the gameplay.
- **Engine** — the runtime the game lives in. Either a Phaser scene (`AsteroidsScene.ts`) or a Godot scene driver (`main.gd`). The engine owns sprites, input handling, audio, and the `update()` loop that runs every scene frame. "Renderer" will specifically mean drawing pixels; "engine" covers the whole runtime.
- **Scene frame** — one iteration of the engine's `update()` loop (~60×/sec). Used here to avoid colliding with "Frame" the language; when this article says "scene frame" it always means one of these render ticks.
- **Host** — a small adapter on the engine side. The engine instantiates each controller and passes it a host object. The controller saves that object and calls back into it at state entries / exits to drive engine-side effects. Each engine implements its own host with the same method names, so the same controller drives both engines through the same interface.

## AsteroidsGame System

The AsteroidsGame system has eight states and demonstrates two key Frame features: the **Hierarchical State Machine** and the **History** mechanism.

![AsteroidsGame state diagram](/games/asteroids/images/asteroids_game.svg)

As indicated by the black ball and transition arrow, the game starts off in the Attract state and waits for a start event to transition to the Playing state.

### Hierarchical State Machines (HSMs)

The core game logic is managed by three related states — Playing, ShipDying and WaveClear — that all inherit the transition to the Pause state behavior from the InGame parent state they share.

### History

Statecharts introduced the History transition mechanism and notation which is shown in the diagram as H\*. State History is essentially a way to generically return to the prior state, whatever it was. In the AsteroidsGame system, the InGame state holds the shared transition into the Paused state. However the system will never actually be in the InGame state — only in one of its children. Therefore even though InGame does the transition on behalf of its children, the History (H\*) will correctly transition to Playing, ShipDying or WaveClear but never to InGame. This interplay of notation between HSMs and History can be subtle at first, but provides significant improvements to simplify diagrams and provide expressive power.

## Game Engine and Ship Communication

The Ship is a Frame system controller that tracks which mode the ship is in (alive, exploding, respawning, hyperspace, dead) and how long it's been there (if relevant). The Ship does not directly control the game display or other low level game aspects. Instead it controls very high-level state management which the engine then converts into low level game engine specific logic.

The relationship between the two is **asymmetric**:

- **The engine constructs the Ship and passes a reference to itself.** The Ship stores that reference in a domain field called `host`.
- **From then on, the engine calls the Ship directly** (`m.ship.is_visible()`, `m.ship.hit()`).
- **The Ship can then call back into the engine** via the `this.host` reference.

That's the one-time setup. Once it's done, three streams of information cross the boundary every scene frame:

![Engine and Ship interaction](/games/asteroids/images/engine_ship.svg)

### Engine → Ship: queries (direct)

In every game scene frame the engine asks the Ship a handful of yes/no questions before deciding what to render: `m.ship.is_visible()`, `m.ship.can_fire()`, `m.ship.can_be_hit()`, `m.ship.is_alive()`. The Ship's current state is what tailors the response to the current situation (what state the Ship is in).

### Engine → Ship: events (direct)

When the player hits H or an asteroid collides with the ship, the engine signals it as an event to the Ship. The Ship's currently-active state handles the event and may transition to a new state. The engine doesn't pick the next state — it just announces what happened in the game environment. Likewise the `tick(dt)` event the engine fires every scene frame drives the Ship's internal timers (the 0.4 s warp, the 1.0 s explosion, the 2.0 s respawn invulnerability). Without `tick`, the Ship would never advance through its timed states; the engine provides the Ship's metronome.

### Ship → Engine: host callbacks (via `this.host`)

Some moments in the Ship's life require the engine to *do* something one-shot — scatter debris when entering `$Exploding`, recenter the sprite when entering `$Respawning`, pick a fresh position when entering `$InHyperspace`. The Ship can't reach the engine directly, so it calls through the host reference it was passed during construction. `$Exploding.$>()` runs `this.host.spawn_explosion()`. `$InHyperspace.$>()` runs `this.host.warp_out()`. The Phaser engine's host implementation scatters Phaser line-segment fragments; Godot's runs the equivalent draw call. The Ship's Frame source is the same for both game platforms — only the engine-side implementations of `spawn_explosion`, `reset_ship`, `warp_out`, `warp_in` differ.

The shape of the relationship is what makes the Ship portable. The engine pulls state every scene frame via direct calls; the Ship pushes events at the moments its state changes via the stored host. The two never share a variable, never need to be kept in sync, never copy a "current mode" string into the engine. Asking the same question twice gets the same answer; the Ship is the single source of truth.

## Ship System

The Ship system is simpler than the AsteroidsGame but demonstrates several Frame capabilities: state-local variables for timers, a global tick mechanism to drive those timers, and the host pattern for letting the controller signal one-shot effects back to the engine at state boundaries.

It is important to note that the implementation of the controllers avoids micromanagement of the game physics — bullets aren't implemented as state machines for example. Nor is the fine grained ship navigation and propulsion, though they could have been, but likely without much value as they aren't that complex. This is a tension that developers will experience when deciding what logic to implement with Frame vs native environment or framework capabilities. There is no right or wrong answer, but generally Frame will best help in teasing apart and making visible the most intricate aspects of the game or development project.

![Ship state diagram](/games/asteroids/images/ship.svg)

### The Ship controller takes a host

The Ship system declares a `host` parameter and stores it as a domain variable:

```
@@system Ship(host: any) {
    ...
    domain:
        host: any = host
        lives_remaining: int = 3
        starting_lives: int = 3
}
```

When the engine constructs the controllers it passes a reference to itself as the host system parameter. Frame automatically stores this argument in the domain variable with the same name as the parameter.

## $Alive State

The $Alive state is the start state for the system, and basically waits for something to happen while the player flies around blowing up asteroids.

```
$Alive {
    hit() { -> $Exploding }

    hyperspace() {
        -> $InHyperspace
    }

    can_fire(): bool    { @@:(true) }
    can_be_hit(): bool  { @@:(true) }
    is_visible(): bool  { @@:(true) }
    is_alive(): bool    { @@:(true) }
    get_lives(): int    { @@:(this.lives_remaining) }
}
```

While the game is running there are only two exceptional events — being hit by an asteroid and jumping into hyperspace. Both of these events result in transitions to the appropriate states. Otherwise the state just provides interface methods for reporting status.

## $Exploding State

The $Exploding state demonstrates a simple approach to timers for states in systems that have an external timer tick interface method. Each time the $Exploding state is entered the state variable `$.timer` is initialized to `0.0`. The tick method takes a `dt` parameter which allows a configurable delta value to be used. With each tick the `dt` value is added to `$.timer`. Once it is greater than the `$.duration` value the machine will transition to either $Dead or $Respawning:

```
$Exploding {
    $.timer: float = 0.0
    $.duration: float = 1.0

    $>() { this.host.spawn_explosion() }

    tick(dt: float) {
        $.timer = $.timer + dt
        if ($.timer >= $.duration) {
            this.lives_remaining = this.lives_remaining - 1
            if (this.lives_remaining <= 0) {
                -> "no lives left" $Dead
            } else {
                -> "lives remain" $Respawning
            }
        }
    }

    can_fire(): bool    { @@:(false) }
    can_be_hit(): bool  { @@:(false) }
    is_visible(): bool  { @@:(true) }
    is_alive(): bool    { @@:(false) }
    get_lives(): int    { @@:(this.lives_remaining) }
}
```

Note also the `$>()` line at the top — this is the entry handler. It runs exactly once when the state is entered and calls `spawn_explosion` on the host. The Phaser engine implements that by scattering line-segment fragments at the ship's last position; the Godot engine paints a static burst. The controller doesn't know or care which; it just says "now."

The `lives_remaining` variable is *not* state-local — it's declared in the system's `domain:` block. That means the decrement here survives the transition to $Respawning. State-local `$.` variables would not.

## $InHyperspace State

The $InHyperspace state follows exactly the same model as $Exploding with regards to timing, but it also uses both entry (`$>`) and exit (`<$`) handlers to bracket the effect — the engine picks a fresh position for the re-emergence on entry, and gets a hook for a re-entry flash on exit:

```
$InHyperspace {
    $.timer: float = 0.0
    $.duration: float = 0.4

    $>() { this.host.warp_out() }
    <$() { this.host.warp_in() }

    tick(dt: float) {
        $.timer = $.timer + dt
        if ($.timer >= $.duration) {
            -> "warp complete" $Alive
        }
    }

    can_fire(): bool    { @@:(false) }
    can_be_hit(): bool  { @@:(false) }
    is_visible(): bool  { @@:(false) }
    is_alive(): bool    { @@:(true) }
    get_lives(): int    { @@:(this.lives_remaining) }
}
```

Both `can_be_hit()` and `is_visible()` return `false` while in hyperspace — the engine polls these every scene frame, so the ship vanishes from the screen and asteroids pass through it for the 0.4-second duration. When the timer expires the state transitions back to $Alive and those answers flip to `true` on the very next query.

## $Respawning State

After exploding (and assuming the player still has lives) the ship enters $Respawning for a 2-second invulnerability window. The entry handler calls `reset_ship` on the host, which centers the sprite, zeros velocity, and clears in-flight bullets:

```
$Respawning {
    $.timer: float = 0.0
    $.duration: float = 2.0

    $>() { this.host.reset_ship() }

    tick(dt: float) {
        $.timer = $.timer + dt
        if ($.timer >= $.duration) {
            -> "invuln expired" $Alive
        }
    }

    can_fire(): bool    { @@:(true) }
    can_be_hit(): bool  { @@:(false) }
    is_visible(): bool  { @@:(true) }
    is_alive(): bool    { @@:(true) }
    get_lives(): int    { @@:(this.lives_remaining) }
}
```

Notice the answer shape — `can_fire` is `true` but `can_be_hit` is `false`. You're playable but invulnerable. The engine renders the invulnerability visually by blinking the sprite at roughly 6 Hz, but that's purely an engine choice; it polls `state === "Respawning"` and applies an alpha flicker. If you wanted a halo or particle ring instead, you'd change only the engine — the controller stays put.

## $Dead State

When the player runs out of lives the machine ends up here:

```
$Dead {
    respawn() {
        this.lives_remaining = this.starting_lives
        -> $Alive
    }

    can_fire(): bool    { @@:(false) }
    can_be_hit(): bool  { @@:(false) }
    is_visible(): bool  { @@:(false) }
    is_alive(): bool    { @@:(false) }
    get_lives(): int    { @@:(0) }
}
```

Everything answers `false`. The only way out is `respawn()`, which the orchestrator (AsteroidsGame) calls when the player restarts a game — `lives_remaining` gets reset from the domain default and the ship returns to $Alive.

## Frame Operations

A Frame system normally communicates through its **interface** — events that get routed to the active state's handler and may trigger transitions. Every interface call goes through that event dispatch.

**Operations** are a backdoor. They're plain methods on the system class that skip the state machine entirely — no event, no routing through the current state, no chance for any state to override the result. You declare them in the `operations:` block. The Ship's only operation looks like this:

```
operations:
    get_current_state_name(): string { @@:(@@:system.state) }
```

`@@:system.state` evaluates to the compartment's current state name verbatim — `"Alive"`, `"InHyperspace"`, and so on. Calling `m.ship.get_current_state_name()` is a direct method call that returns that string. The state machine isn't involved at all, which is why operations don't appear in the engine ↔ Ship interaction earlier in this article — they sit outside that contract.

The power of operations is also the risk. Routing logic through them makes it invisible to the state machine: the diagram won't show it, transitions can't fire from it, and you've broken the encapsulation that lets a Frame system be portable across engines. **If a method might change state, keep it on the interface.** Operations are for things that don't.

Where they earn their keep is **non-disruptive, minimally-invasive reads** — questions the engine, the visualizer, or a debug log wants to ask the system without driving its state machine. `get_current_state_name()` is the canonical example: every consumer needs it, none of them want to mutate anything when they ask. Other good fits are returning a computed value or wrapping a domain field for a stable read-only surface.

A rule of thumb for what goes where in a Frame system:

- **`interface`** — events that may change state or trigger transitions
- **`operations`** — pure reads or computed values that don't drive the machine
- **`$.<name>`** state-local variables — timers and counters scoped to one state's lifetime
- **`domain`** — values that persist for the whole system's lifetime
