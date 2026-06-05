# Asteroids

Asteroids gameplay is managed by two controller systems \- the **AsteroidsGame** which implements the overall gameplay and **Ship** which implements the ship logic.

A few terms used throughout:

- **Frame system (controllers)** — the Frame systems that manage the gameplay.
- **Engine** — the runtime the game lives in. Either a Phaser scene (`AsteroidsScene.ts`) or a Godot scene driver (`main.gd`). The engine owns sprites, input handling, audio, and the per-frame `update()` loop. "Renderer" will specifically mean drawing pixels; "engine" covers the whole runtime.
- **Host** — a small adapter on the engine side that the state machine calls back into at state boundaries. Each engine implements its own host; the state machine talks to both through the same method names.

## AsteroidsGame System

The AsteroidsGame system has eight states and demonstrates two key Frame features: the **Hierarchical State Machine** and the **History** mechanism. 

<AsteroidsGame uml>

As indicated by the black ball and transition arrow, the game starts off in the Attract state and waits for a start event to transition to the Playing state. 

### Hierarchical State Machines (HSMs)

The core game logic is managed by three related states \- Playing, ShipDying and WaveClear \- that all inherit transition to the Pause state behavior from the InGame parent state they share. 

### History

Statecharts introduced the History transition mechanism and notation which is shown in the diagram as H\*. State History is essentially a way to generically return to the prior state, whatever it was. In the AsteroidsGame system, the InGame state holds the shared transition into the Paused state. However the system will never actually be in the InGame state \- only in one of its children. Therefore even though InGame does the transition on behalf of its children, the History (H\*) will correctly transition to Playing, ShipDying or WaveClear but never to InGame. This interplay of notation between HSMs and History can be subtle at first, but provides significant improvements to simplify diagrams and provide expressive power. 

## Ship System

The Ship system is simpler than the AsteroidsGame but demonstrates both a key Frame feature by using state local variables for timers as well as an architectural approach to how to implement a global tick mechanism to drive the timers. 

It is important to note that the implementation of the controllers avoids micromanagement of the game physics \- bullets aren't implemented as state machines for example. Nor is the fine grained ship navigation and propulsion, though they could have been, but likely without much value as they aren't that complex. This is a tension that developers will experience when deciding what logic to implement with Frame vs native environment or framework capabilities. There is no right or wrong answer, but generally Frame will best help in teasing apart and making visible the most intricate aspects of the game or development project. 

<ship uml>

## $Alive State

The $Alive state is the start state for the system, and basically waits for something to happen while the player flies around blowing up asteroids. 

       $Alive {  
            hit() { \-\> $Exploding }

            hyperspace() {  
                \-\> $InHyperspace  
            }

            can\_fire(): bool    { @@:(true) }  
            can\_be\_hit(): bool  { @@:(true) }  
            is\_visible(): bool  { @@:(true) }  
            is\_alive(): bool    { @@:(true) }  
            get\_lives(): int    { @@:(this.lives\_remaining) }  
        }

While the game is running there are only two exceptional events \- being hit by an asteroid and jumping into hyperspace. Both of these events result in transitions to the appropriate states. Otherwise the state just provides interface methods for reporting status. 

## $Exploding State

The $Exploding state demonstrates a simple approach to timers for states in systems that have an external timer tick interface method.  Each time the $Exploding state is entered the state variable $.time is initialized to 0.0. The tick method takes a dt parameter which allows a configurable delta value to be used. With each tick the dt value is is added to $.timer. Once it is greater than the $.duration value the machine will transition to either $Dead or $Respawning: 

        $Exploding {  
            $.timer: float \= 0.0  
            $.duration: float \= 1.0

            tick(dt: float) {  
                $.timer \= $.timer \+ dt  
                if ($.timer \>= $.duration) {  
                    this.lives\_remaining \= this.lives\_remaining \- 1  
                    if (this.lives\_remaining \<= 0\) {  
                        \-\> $Dead  
                    } else {  
                        \-\> $Respawning  
                    }  
                }  
            }

            can\_fire(): bool    { @@:(false) }  
            can\_be\_hit(): bool  { @@:(false) }  
            is\_visible(): bool  { @@:(true) }  
            is\_alive(): bool    { @@:(false) }  
            get\_state(): string { @@:("exploding") }  
            get\_lives(): int    { @@:(this.lives\_remaining) }  
        }

## $InHyperspace State

The $InHyperspace state follows exactly the same model as $Exploding with regards to timing. 

       $InHyperspace {  
            $.timer: float \= 0.0  
            $.duration: float \= 0.4

            tick(dt: float) {  
                $.timer \= $.timer \+ dt  
                if ($.timer \>= $.duration) {  
                    \-\> $Alive  
                }  
            }

            can\_fire(): bool    { @@:(false) }  
            can\_be\_hit(): bool  { @@:(false) }  
            is\_visible(): bool  { @@:(false) }  
            is\_alive(): bool    { @@:(true) }  
            get\_state(): string { @@:("hyperspace") }  
            get\_lives(): int    { @@:(this.lives\_remaining) }  
        }
