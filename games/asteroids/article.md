# Asteroids

> State-local variables on a timed mode, an HSM in-game parent whose pause handler the three children inherit, and push$/pop$ pause where the pop target genuinely varies.

Asteroids brings two distinct Frame features into one game. The first one — **state-local variables** — is the cleaner win in this controller; the second — **push$/pop$ as a real multi-caller subroutine** — lives at the orchestrator's pause, not on the ship.

## State-local variables: `$.timer` on `$InHyperspace`

Press H in Asteroids and your ship blinks out for 0.4 seconds — invulnerable, invisible, you can't shoot. When the timer expires, you reappear at your current position, alive again.

The naive way: add a `hyperspacing` boolean to the ship, set it on H, clear it on a timer, special-case every rendering and collision check that reads the flag. Six places to update, easy to forget one.

The Frame way: model hyperspace as **its own state** — `$InHyperspace` — with its own private timer:

    $InHyperspace {
        $.timer: float = 0.0
        $.duration: float = 0.4

        tick(dt: float) {
            $.timer = $.timer + dt
            if ($.timer >= $.duration) {
                -> $Alive
            }
        }

        can_fire(): bool    { @@:(false) }
        can_be_hit(): bool  { @@:(false) }
        is_visible(): bool  { @@:(false) }
        get_state(): string { @@:("hyperspace") }
    }

The `$.` prefix marks variables that belong to **this compartment only**. They're created when the machine enters `$InHyperspace` and discarded when it leaves. The next hyperspace begins with `$.timer = 0` automatically, without any reset logic, because the previous compartment was destroyed on exit.

That's the Frame equivalent of a function's local variables. The state owns its own data, its own answers to `can_fire()` / `can_be_hit()` / `is_visible()` (all `false`), and its own end condition. The Phaser scene doesn't need to remember any of that — it calls `ship.is_visible()` each frame and trusts the machine. When the state changes, every dependent answer changes with it, atomically.

## Why a plain transition, not push$/pop$?

You'll see other Frame games using `push$` / `pop$` for similar "temporary mode" patterns — and you might wonder why hyperspace isn't written that way too. The answer is honest: a state stack only earns its weight when there are **multiple callers** and the pop target genuinely varies. Hyperspace is invoked from one place — `$Alive.hyperspace` — so pop$ would always pop back to `$Alive`, exactly what a plain `-> $Alive` does. The simpler form wins.

## Where push$/pop$ DOES earn its keep: the orchestrator's pause

The top-level `AsteroidsGame` system (the orchestrator — distinct from the game's display name "Asteroids", same way Pac-Man's orchestrator is named `GhostGame`) has the multi-caller story. `$Playing`, `$ShipDying`, and `$WaveClear` all inherit `pause()` from the `$InGame` HSM parent — three different children, three possible pop targets:

    $Playing => $InGame      # the rally
    $ShipDying => $InGame    # the brief stun after a death
    $WaveClear => $InGame    # between waves

    $InGame {
        pause() {
            push$ -> $Paused
        }
    }

When the player hits P during the rally, push$ stashes `$Playing` and transitions to `$Paused`. Hit P during the post-death stun and push$ stashes `$ShipDying`. Resume pops back to whichever was on the stack. **The pop target genuinely varies across callers** — that's the moment a state stack stops being ceremony and becomes the right tool.

You can see this in the Asteroids diagram: dashed forward edges from each of the three in-game children to `$Paused`, and the `↩` node at the bottom listing the three states resume can return to.

## Try it

Press H in the rally — Ship's diagram flips from `Alive` to `InHyperspace`, the canvas blinks the ship out, then 0.4s later it's back at `Alive`. Plain back-and-forth.

Now pause mid-rally with P. The Asteroids orchestrator diagram lights up `Paused`, with the `↩` node showing `Playing / ShipDying / WaveClear`. Hit P again — resume returns to `Playing`. Get hit by a rock and pause during `$ShipDying` — resume returns there instead. That's the state stack actually doing work.
