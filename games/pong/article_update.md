# Pong

Pong is implemented with a single Frame system — **Pong** — that owns the entire game flow. The Phaser scene (or the Godot driver) owns the continuous physics: paddle position, ball position, collision. They meet at one boundary: each frame the scene reads `get_state()` from Pong and fires interface events when something happens the machine needs to know about.

A few terms used throughout:

- **Frame system (controller)** — the Frame system that manages game flow.
- **Engine** — the runtime the game lives in. Either a Phaser scene (`PongScene.ts`) or a Godot scene driver (`main.gd`). The engine owns sprites, input handling, audio, and the per-frame `update()` loop. "Renderer" specifically means drawing pixels; "engine" covers the whole runtime.

## Pong System

The Pong system has six states and demonstrates the core Frame teaching: **a state machine replaces a tangle of boolean flags with one current state at a time, and each state explicitly declares which events it accepts**.

<Pong uml>

As indicated by the black ball and transition arrow, the game starts off in `$AttractMode` waiting for `start()`, which advances to `$Serving`. The player presses SPACE — `launch()` — and the rally is on in `$InPlay`. When the ball goes off either edge, the machine transitions to `$PointScored` which decides what's next: another serve, or `$GameOver`.

### State Replaces Flags

In a traditional game loop the same logic looks like a flat `if`-chain checking many booleans — `if (started && !paused && !gameOver && playerServing && ...)`. It works for the first prototype, and then it doesn't.

Pong's machine instead says: the game is in **exactly one** state at any moment, and each state explicitly declares its event handlers. Press SPACE in `$AttractMode` and it transitions to `$Serving`. Press SPACE in `$Serving` and it launches into `$InPlay`. Press SPACE in `$InPlay` and **nothing happens** — the state doesn't define a `launch` handler. No "is the game started yet?" check; no risk of accidentally launching the ball twice. The state itself is the answer to "what's allowed right now."

### Engine-Integration Pattern

The split between the machine and the engine is clean:

- **Frame machine** owns every transition. It knows the score, the serve direction, the winner, and which state the game is currently in.
- **Phaser scene (or Godot driver)** owns continuous physics: paddle position, ball position, collision detection. Each frame it reads `pong.get_state()` and decides what to draw. When the ball goes off the left edge, it fires `pong.ball_out_left()`.

The machine never touches a sprite. The scene never touches the score directly. Each side does what it's best at.

## push$/pop$ Pause

`$Serving` and `$InPlay` both handle `pause()` the same way:

        pause() { push$ -> $Paused }

`push$` is Frame's **state stack**: it stashes the current compartment (the active state plus its domain) onto an internal stack and transitions to `$Paused`. When `$Paused.resume()` does `-> pop$`, Frame restores the stashed compartment — **the game returns to exactly whichever state you paused in**, with serve direction, scores, everything intact. Pause mid-serve and you're back at `$Serving` on resume; pause mid-rally and you're back at `$InPlay`.

Without push$/pop$ you'd manually remember "what was active before pause" in a domain variable and route resume on it. The state stack does that for you.

(See `rfc-candidates.md` for the note on how framec currently draws the pop edge but not the push edge — the push direction is real; framec's graphviz output just doesn't render it yet.)

## $PointScored — $> as a Decision Point

`$PointScored` is the only state that no scene event ever transitions out of — it routes itself via its **entry handler** (`$>`):

        $PointScored {
            $>() {
                if (this.last_scorer == "left") {
                    this.serving_to = 1
                } else {
                    this.serving_to = -1
                }

                if (this.score_left >= this.winning_score) {
                    this.winner = "left"
                    -> $GameOver
                } else if (this.score_right >= this.winning_score) {
                    this.winner = "right"
                    -> $GameOver
                } else {
                    -> $Serving
                }
            }
            ...
        }

The instant the rally ends and the scoring `ball_out_left()` / `ball_out_right()` transitions into `$PointScored`, the `$>` handler runs: pick the next serve direction, check for a winner, and either transition to `$GameOver` or back to `$Serving`. The scene doesn't decide; the machine does. The scene just fires the scoring event.

## $AttractMode — Initialization in Entry

The `$>` pattern also handles initialization. `$AttractMode` is the start state, and also the state that `$GameOver.restart()` returns to. Either way, on entry, scores reset to zero and the winner blanks:

        $AttractMode {
            $>() {
                this.score_left = 0
                this.score_right = 0
                this.winner = ""
            }

            start() { -> $Serving }
            ...
        }

You never have to call a `reset()` method from the scene side. Returning to `$AttractMode` *is* resetting.

## Try it

Watch the diagram as you play. Hit SPACE in `$AttractMode` — the highlight moves to `$Serving`. Hit SPACE again — `$InPlay`. Lose a point — `$PointScored` flashes briefly before flipping back to `$Serving` (or `$GameOver` once someone hits 11). Hit P mid-rally — `$Paused` lights up; P again and you're back exactly where you were.

That's the whole game. One machine, six states, every transition labelled.
