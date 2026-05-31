# Platformer

> Orthogonal-state composition — two independent sub-FSMs (motion + form) run in parallel under one orchestrator, instead of flattening into a 6×3 matrix.

This game's controller is three composed state machines: **Platformer** (the orchestrator), **Locomotion** (movement), and **PowerUp** (form). The two sub-machines run independently — 6 × 3 = 18 logical combinations if flattened; two diagrams as composed.

_Article in progress — write me._
