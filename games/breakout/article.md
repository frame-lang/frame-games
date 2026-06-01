# Breakout

> Multi-system composition — a Ball, a BrickField, and the game that owns them.

Pong fits in one machine because its physics actor (the ball) and its score are tightly coupled to the round itself. Breakout doesn't.

The ball has its own lifecycle: it sits on the paddle, gets launched, flies around, and is lost. None of that depends on score, lives, or which level you're on — it's a self-contained motion machine. The brick field is the same: a list of bricks that get broken one at a time, with a "cleared?" question. And the orchestrator on top of those two has its own concerns: lives, level, attract → playing → game over.

When you have three independent concerns, **don't fold them into one machine**. Compose them.

## Three machines, one game

- **Breakout** is the orchestrator. It owns the score, the lives, the current level, and the top-level flow: `Attract → Playing → LevelClear / GameOver → restart`.
- **Ball** has three states: `AttachedToPaddle` (sitting on the paddle, waiting to be served), `InFlight` (moving with velocity), `Lost` (fell off the bottom, waiting to be re-served). The velocity isn't a field on the machine — it's a *state variable on `InFlight`*, which means it's created when you enter `InFlight` and discarded when you leave. Every launch is a fresh serve.
- **BrickField** is a deliberately tiny one-state system. It exists only to own the brick list behind a clean interface (`break_brick`, `is_broken`, `is_cleared`). It's proof that a "system" in a composition doesn't have to be a complex FSM — sometimes it's just the right abstraction boundary for a piece of state.

## The driver only talks to the orchestrator

The Phaser scene never touches `Ball` or `BrickField` directly. It only sends events to `Breakout`: "the ball hit a brick at index N", "the ball fell off". `Breakout` routes those events inward — `brick_hit` becomes `bricks.break_brick(N); ball.bounce_y()`. The scene doesn't need to know that the brick field has internal state, or that the ball's velocity is a state variable on one of its states. The orchestrator is the API boundary.

## Try it

Watch the Ball diagram as you play. SPACE moves `AttachedToPaddle → InFlight`. Miss the ball: `InFlight → Lost`, the game's `ball_fell_off()` decrements your lives and recycles the Ball through `Lost → AttachedToPaddle` for the next serve. The push$/pop$ pause is the same trick you saw in Pong — it stashes the in-flight compartment so resume restores the rally exactly.

When in doubt: more machines, smaller machines.
