# Pong

> A single FSM with push$/pop$ pause. The scene watches state, the machine owns every transition — the engine-integration pattern at its purest.

If you've written a game loop before, you know the pain: a flat `if`-chain checking dozens of boolean flags — `if (started && !paused && !gameOver && playerServing && ...)`. It works for Pong's first prototype, and then it doesn't.

A **state machine** is the cleaner answer. The game is in exactly **one** state at any moment — `Attract`, `Serving`, `InPlay`, `PointScored`, `Paused`, or `GameOver` — and each state explicitly declares which events it accepts. Press SPACE in `Attract` and you transition to `Serving`. Press SPACE in `Serving` and the machine launches the ball, advancing to `InPlay`. Press SPACE in `InPlay` and nothing happens — the state doesn't define a `launch` handler.

## What the machine owns vs what the scene owns

In a Frame game the split is clean:

- **The Frame machine** owns every transition. It knows the score, the lives, the serve direction, and which state the game is currently in.
- **The Phaser scene** owns continuous physics: paddle position, ball position, collision. Each frame it reads `fsm.get_state()` and decides what to draw and which events to fire — `launch()` when the player serves, `ball_out_left()` when the ball goes off the left edge.

The machine never touches a sprite. The scene never touches the score directly. Each side does what it's best at.

## The pause subroutine

Notice the **push$** / **pop$** pair on the Paused state. When you hit P during play, Frame *stashes the current compartment* (the in-flight game state) onto an internal stack and transitions to `Paused`. When you hit P again, **pop$** restores the stashed compartment — you resume in exactly the state you paused in, whether you were `Serving` or `InPlay`.

The `Paused -> H*` edge in the diagram is the pop direction: pop$ restores whichever child compartment was on top of the stack. Framec's current graphviz output doesn't draw the push direction for inline `push$ -> $X` handlers — see [rfc-candidates.md](../../rfc-candidates.md) for the proposal to add it.

## Try it

Watch the diagram as you play. Hit SPACE in `Attract` → the highlight moves to `Serving`. Hit SPACE again → `InPlay`. Lose a point → `PointScored` flashes briefly before flipping back to `Serving`. Hit P mid-rally → `Paused` lights up; P again and you're back to exactly where you were.

That's the whole game. One machine, six states, every transition labelled.
