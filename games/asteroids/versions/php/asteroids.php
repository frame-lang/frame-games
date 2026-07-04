<?php


// Asteroids — PHP port of the Frame controller. Same three systems as every
// other port. Per the Frame model (frame_language.md, "Syntax Taxonomy"):
// a handler line is NATIVE target code; Frame only splices in references/calls.
// So bodies are native PHP — `$this->field` domain access, `$this->child->m()`
// child-system calls, `$local` vars, `if (cond) {`, `;` terminators — with the
// closed Frame set spliced in: `$.stateVar`, `@@:(e)` / `@@:return(e)` (return
// slot), `->`/`push$`/`pop$`/`=> $^` (transitions), `@@:system.state.name`.
// (There are no reentrant `@@:self.method()` self-calls in this FSM.)
// PHP has no operator overloading, so Vec2 uses methods (like TS/Go).

class Vec2 {
    public $x;
    public $y;
    public function __construct($x = 0.0, $y = 0.0) {
        $this->x = $x;
        $this->y = $y;
    }
    public function add($o) { return new Vec2($this->x + $o->x, $this->y + $o->y); }
    public function scale($s) { return new Vec2($this->x * $s, $this->y * $s); }
    public function length() { return sqrt($this->x * $this->x + $this->y * $this->y); }
    public function distance_to($o) { return sqrt(($this->x - $o->x) ** 2 + ($this->y - $o->y) ** 2); }
}

class Asteroid {
    public $pos;
    public $vel;
    public $size;
    public $alive;
    public function __construct($pos, $vel, $size, $alive) {
        $this->pos = $pos;
        $this->vel = $vel;
        $this->size = $size;
        $this->alive = $alive;
    }
}

interface IShipHost {
    public function warp_out();
    public function warp_in();
    public function spawn_explosion();
    public function reset_ship();
}

function _rf() { return mt_rand() / mt_getrandmax(); }
function _from_angle($a, $speed) { return new Vec2(cos($a) * $speed, sin($a) * $speed); }

// ------------------------------------------------------------ Ship
class ShipFrameEvent {
    public $_message;
    public $_parameters;

    public function __construct($message, $parameters = null) {
        $this->_message = $message;
        $this->_parameters = $parameters ?? [];
    }
}


class ShipFrameContext {
    public $_event;
    public $_return;
    public $_data;
    public $_transitioned;

    public function __construct($event, $defaultReturn = null) {
        $this->_event = $event;
        $this->_return = $defaultReturn;
        $this->_data = [];
        $this->_transitioned = false;
    }
}


class ShipCompartment {
    public $state;
    public $state_args;
    public $state_vars;
    public $enter_args;
    public $exit_args;
    public $forward_event;
    public $parent_compartment;

    public function __construct($state, $parent_compartment = null) {
        $this->state = $state;
        $this->state_args = [];
        $this->state_vars = [];
        $this->enter_args = [];
        $this->exit_args = [];
        $this->forward_event = null;
        $this->parent_compartment = $parent_compartment;
    }

    public function copy() {
        $c = new ShipCompartment($this->state, $this->parent_compartment);
        $c->state_args = $this->state_args;
        $c->state_vars = $this->state_vars;
        $c->enter_args = $this->enter_args;
        $c->exit_args = $this->exit_args;
        $c->forward_event = $this->forward_event;
        return $c;
    }
}


class Ship {
    private $_state_stack;
    private $__compartment;
    private $__next_compartment;
    private $_context_stack;
    public $host;
    public $lives_remaining = 3;
    public $starting_lives = 3;
    public $hyperspaces_remaining = 3;
    public $starting_hyperspaces = 3;

    public function __construct() {
        $this->_state_stack = [];
        $this->_context_stack = [];
        $this->__compartment = $this->__prepareEnter("Alive", [], []);
        $this->__next_compartment = null;
    }

    public function _frame_init($host): void {
        $this->host = $host;
        $__e = new ShipFrameEvent("$>", $this->__compartment->enter_args);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        $this->__kernel($__e);
        array_pop($this->_context_stack);
    }

    public static function _create($host): self {
        $c = new self();
        $c->_frame_init($host);
        return $c;
    }

    public function hsm_chain() {
        return [
            "Alive" => ["Alive"],
            "InHyperspace" => ["InHyperspace"],
            "Exploding" => ["Exploding"],
            "Respawning" => ["Respawning"],
            "Dead" => ["Dead"],
        ];
    }
    private function __prepareEnter($leaf, $state_args, $enter_args) {
        $comp = null;
        foreach ($this->hsm_chain()[$leaf] as $name) {
            $new_comp = new ShipCompartment($name);
            $new_comp->state_args = $state_args;
            $new_comp->enter_args = $enter_args;
            $new_comp->parent_compartment = $comp;
            $comp = $new_comp;
        }
        return $comp;
    }

    private function __prepareExit($exit_args) {
        $comp = $this->__compartment;
        while ($comp !== null) {
            $comp->exit_args = $exit_args;
            $comp = $comp->parent_compartment;
        }
    }

    private function __kernel($__e) {
        // Route event to current state.
        $this->__router($__e);
        // Drain any transitions queued by the handler.
        while ($this->__next_compartment !== null) {
            $next_compartment = $this->__next_compartment;
            $this->__next_compartment = null;
            $exit_event = new ShipFrameEvent("<$", $this->__compartment->exit_args);
            $this->__router($exit_event);
            $this->__compartment = $next_compartment;
            $forward_event = $next_compartment->forward_event;
            $next_compartment->forward_event = null;
            if ($forward_event === null) {
                $enter_event = new ShipFrameEvent("$>", $this->__compartment->enter_args);
                $this->__router($enter_event);
            } else if ($forward_event->_message === "$>") {
                $this->__router($forward_event);
            } else {
                $enter_event = new ShipFrameEvent("$>", $this->__compartment->enter_args);
                $this->__router($enter_event);
                $this->__router($forward_event);
            }
            foreach ($this->_context_stack as $ctx) {
                $ctx->_transitioned = true;
            }
        }
    }

    private function __router($__e) {
        $handler_name = "_state_" . $this->__compartment->state;
        if (method_exists($this, $handler_name)) {
            $this->$handler_name($__e, $this->__compartment);
        }
    }

    private function __transition($next_compartment) {
        $this->__next_compartment = $next_compartment;
    }

    public function tick($dt) {
        $__e = new ShipFrameEvent("tick", [$dt]);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function hit() {
        $__e = new ShipFrameEvent("hit", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function hyperspace() {
        $__e = new ShipFrameEvent("hyperspace", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function respawn() {
        $__e = new ShipFrameEvent("respawn", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function fire() {
        $__e = new ShipFrameEvent("fire", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function can_fire() {
        $__e = new ShipFrameEvent("can_fire", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function can_be_hit() {
        $__e = new ShipFrameEvent("can_be_hit", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function can_hyperspace() {
        $__e = new ShipFrameEvent("can_hyperspace", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function is_visible() {
        $__e = new ShipFrameEvent("is_visible", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function is_alive() {
        $__e = new ShipFrameEvent("is_alive", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function get_lives() {
        $__e = new ShipFrameEvent("get_lives", []);
        $__ctx = new ShipFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    private function _state_Alive($__e, $compartment) {
        if ($__e->_message == "$>") {
            $this->_s_Alive_hdl_frame_enter($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_be_hit") {
            $this->_s_Alive_hdl_user_can_be_hit($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_fire") {
            $this->_s_Alive_hdl_user_can_fire($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_hyperspace") {
            $this->_s_Alive_hdl_user_can_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "fire") {
            $this->_s_Alive_hdl_user_fire($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_Alive_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "hit") {
            $this->_s_Alive_hdl_user_hit($__e, $compartment);
            return;
        }
        if ($__e->_message == "hyperspace") {
            $this->_s_Alive_hdl_user_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_alive") {
            $this->_s_Alive_hdl_user_is_alive($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_visible") {
            $this->_s_Alive_hdl_user_is_visible($__e, $compartment);
            return;
        }
        if ($__e->_message == "tick") {
            $this->_s_Alive_hdl_user_tick($__e, $compartment);
            return;
        }
    }

    private function _state_InHyperspace($__e, $compartment) {
        if ($__e->_message == "<$") {
            $this->_s_InHyperspace_hdl_frame_exit($__e, $compartment);
            return;
        }
        if ($__e->_message == "$>") {
            $this->_s_InHyperspace_hdl_frame_enter($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_be_hit") {
            $this->_s_InHyperspace_hdl_user_can_be_hit($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_fire") {
            $this->_s_InHyperspace_hdl_user_can_fire($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_hyperspace") {
            $this->_s_InHyperspace_hdl_user_can_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_InHyperspace_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_alive") {
            $this->_s_InHyperspace_hdl_user_is_alive($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_visible") {
            $this->_s_InHyperspace_hdl_user_is_visible($__e, $compartment);
            return;
        }
        if ($__e->_message == "tick") {
            $this->_s_InHyperspace_hdl_user_tick($__e, $compartment);
            return;
        }
    }

    private function _state_Exploding($__e, $compartment) {
        if ($__e->_message == "$>") {
            $this->_s_Exploding_hdl_frame_enter($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_be_hit") {
            $this->_s_Exploding_hdl_user_can_be_hit($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_fire") {
            $this->_s_Exploding_hdl_user_can_fire($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_hyperspace") {
            $this->_s_Exploding_hdl_user_can_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_Exploding_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_alive") {
            $this->_s_Exploding_hdl_user_is_alive($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_visible") {
            $this->_s_Exploding_hdl_user_is_visible($__e, $compartment);
            return;
        }
        if ($__e->_message == "tick") {
            $this->_s_Exploding_hdl_user_tick($__e, $compartment);
            return;
        }
    }

    private function _state_Respawning($__e, $compartment) {
        if ($__e->_message == "$>") {
            $this->_s_Respawning_hdl_frame_enter($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_be_hit") {
            $this->_s_Respawning_hdl_user_can_be_hit($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_fire") {
            $this->_s_Respawning_hdl_user_can_fire($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_hyperspace") {
            $this->_s_Respawning_hdl_user_can_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_Respawning_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_alive") {
            $this->_s_Respawning_hdl_user_is_alive($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_visible") {
            $this->_s_Respawning_hdl_user_is_visible($__e, $compartment);
            return;
        }
        if ($__e->_message == "tick") {
            $this->_s_Respawning_hdl_user_tick($__e, $compartment);
            return;
        }
    }

    private function _state_Dead($__e, $compartment) {
        if ($__e->_message == "can_be_hit") {
            $this->_s_Dead_hdl_user_can_be_hit($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_fire") {
            $this->_s_Dead_hdl_user_can_fire($__e, $compartment);
            return;
        }
        if ($__e->_message == "can_hyperspace") {
            $this->_s_Dead_hdl_user_can_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_Dead_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_alive") {
            $this->_s_Dead_hdl_user_is_alive($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_visible") {
            $this->_s_Dead_hdl_user_is_visible($__e, $compartment);
            return;
        }
        if ($__e->_message == "respawn") {
            $this->_s_Dead_hdl_user_respawn($__e, $compartment);
            return;
        }
    }

    private function _s_Alive_hdl_frame_enter($__e, $compartment) {
        if (!array_key_exists("cooldown", $compartment->state_vars)) {
            $compartment->state_vars["cooldown"] = 0.0;
        }
    }

    private function _s_Alive_hdl_user_can_be_hit($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Alive_hdl_user_can_fire($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $compartment->state_vars["cooldown"] <= 0.0;
    }

    private function _s_Alive_hdl_user_can_hyperspace($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->hyperspaces_remaining > 0;
    }

    private function _s_Alive_hdl_user_fire($__e, $compartment) {
        $compartment->state_vars["cooldown"] = 0.22;
    }

    private function _s_Alive_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->lives_remaining;
    }

    private function _s_Alive_hdl_user_hit($__e, $compartment) {
        $__compartment = $this->__prepareEnter("Exploding", [], []);
        $this->__transition($__compartment);
        return;
    }

    private function _s_Alive_hdl_user_hyperspace($__e, $compartment) {
        if ($this->hyperspaces_remaining > 0) {
            $this->hyperspaces_remaining = $this->hyperspaces_remaining - 1;
            $__compartment = $this->__prepareEnter("InHyperspace", [], []);
            $this->__transition($__compartment);
            return;
        }
    }

    private function _s_Alive_hdl_user_is_alive($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Alive_hdl_user_is_visible($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Alive_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        if ($compartment->state_vars["cooldown"] > 0.0) {
            $compartment->state_vars["cooldown"] = $compartment->state_vars["cooldown"] - $dt;
        }
    }

    private function _s_InHyperspace_hdl_frame_exit($__e, $compartment) {
        $this->host->warp_in();
    }

    private function _s_InHyperspace_hdl_frame_enter($__e, $compartment) {
        if (!array_key_exists("timer", $compartment->state_vars)) {
            $compartment->state_vars["timer"] = 0.0;
        }
        if (!array_key_exists("duration", $compartment->state_vars)) {
            $compartment->state_vars["duration"] = 0.4;
        }
        $this->host->warp_out();
    }

    private function _s_InHyperspace_hdl_user_can_be_hit($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_InHyperspace_hdl_user_can_fire($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_InHyperspace_hdl_user_can_hyperspace($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_InHyperspace_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->lives_remaining;
    }

    private function _s_InHyperspace_hdl_user_is_alive($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_InHyperspace_hdl_user_is_visible($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_InHyperspace_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $compartment->state_vars["timer"] = $compartment->state_vars["timer"] + $dt;
        if ($compartment->state_vars["timer"] >= $compartment->state_vars["duration"]) {
            $__compartment = $this->__prepareEnter("Alive", [], []);
            $this->__transition($__compartment);
            return;
        }
    }

    private function _s_Exploding_hdl_frame_enter($__e, $compartment) {
        if (!array_key_exists("timer", $compartment->state_vars)) {
            $compartment->state_vars["timer"] = 0.0;
        }
        if (!array_key_exists("duration", $compartment->state_vars)) {
            $compartment->state_vars["duration"] = 1.0;
        }
        $this->host->spawn_explosion();
    }

    private function _s_Exploding_hdl_user_can_be_hit($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Exploding_hdl_user_can_fire($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Exploding_hdl_user_can_hyperspace($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Exploding_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->lives_remaining;
    }

    private function _s_Exploding_hdl_user_is_alive($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Exploding_hdl_user_is_visible($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Exploding_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $compartment->state_vars["timer"] = $compartment->state_vars["timer"] + $dt;
        if ($compartment->state_vars["timer"] >= $compartment->state_vars["duration"]) {
            $this->lives_remaining = $this->lives_remaining - 1;
            if ($this->lives_remaining <= 0) {
                $__compartment = $this->__prepareEnter("Dead", [], []);
                $this->__transition($__compartment);
                return;
            } else {
                $__compartment = $this->__prepareEnter("Respawning", [], []);
                $this->__transition($__compartment);
                return;
            }
        }
    }

    private function _s_Respawning_hdl_frame_enter($__e, $compartment) {
        if (!array_key_exists("timer", $compartment->state_vars)) {
            $compartment->state_vars["timer"] = 0.0;
        }
        if (!array_key_exists("duration", $compartment->state_vars)) {
            $compartment->state_vars["duration"] = 2.0;
        }
        $this->host->reset_ship();
    }

    private function _s_Respawning_hdl_user_can_be_hit($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Respawning_hdl_user_can_fire($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Respawning_hdl_user_can_hyperspace($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Respawning_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->lives_remaining;
    }

    private function _s_Respawning_hdl_user_is_alive($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Respawning_hdl_user_is_visible($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Respawning_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $compartment->state_vars["timer"] = $compartment->state_vars["timer"] + $dt;
        if ($compartment->state_vars["timer"] >= $compartment->state_vars["duration"]) {
            $__compartment = $this->__prepareEnter("Alive", [], []);
            $this->__transition($__compartment);
            return;
        }
    }

    private function _s_Dead_hdl_user_can_be_hit($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Dead_hdl_user_can_fire($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Dead_hdl_user_can_hyperspace($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Dead_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = 0;
    }

    private function _s_Dead_hdl_user_is_alive($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Dead_hdl_user_is_visible($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Dead_hdl_user_respawn($__e, $compartment) {
        $this->lives_remaining = $this->starting_lives;
        $this->hyperspaces_remaining = $this->starting_hyperspaces;
        $__compartment = $this->__prepareEnter("Respawning", [], []);
        $this->__transition($__compartment);
        return;
    }

    public function get_current_state_name() {
         return $this->__compartment->state; 
    }

    public function get_hyperspaces_remaining() {
         return $this->hyperspaces_remaining; 
    }
}

// ------------------------------------------------------------ AsteroidField
class AsteroidFieldFrameEvent {
    public $_message;
    public $_parameters;

    public function __construct($message, $parameters = null) {
        $this->_message = $message;
        $this->_parameters = $parameters ?? [];
    }
}


class AsteroidFieldFrameContext {
    public $_event;
    public $_return;
    public $_data;
    public $_transitioned;

    public function __construct($event, $defaultReturn = null) {
        $this->_event = $event;
        $this->_return = $defaultReturn;
        $this->_data = [];
        $this->_transitioned = false;
    }
}


class AsteroidFieldCompartment {
    public $state;
    public $state_args;
    public $state_vars;
    public $enter_args;
    public $exit_args;
    public $forward_event;
    public $parent_compartment;

    public function __construct($state, $parent_compartment = null) {
        $this->state = $state;
        $this->state_args = [];
        $this->state_vars = [];
        $this->enter_args = [];
        $this->exit_args = [];
        $this->forward_event = null;
        $this->parent_compartment = $parent_compartment;
    }

    public function copy() {
        $c = new AsteroidFieldCompartment($this->state, $this->parent_compartment);
        $c->state_args = $this->state_args;
        $c->state_vars = $this->state_vars;
        $c->enter_args = $this->enter_args;
        $c->exit_args = $this->exit_args;
        $c->forward_event = $this->forward_event;
        return $c;
    }
}


class AsteroidField {
    private $_state_stack;
    private $__compartment;
    private $__next_compartment;
    private $_context_stack;
    public $asteroids = [];

    public function __construct() {
        $this->_state_stack = [];
        $this->_context_stack = [];
        $this->__compartment = $this->__prepareEnter("Active", [], []);
        $this->__next_compartment = null;
    }

    public function _frame_init(): void {
        $__e = new AsteroidFieldFrameEvent("$>", $this->__compartment->enter_args);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        $this->__kernel($__e);
        array_pop($this->_context_stack);
    }

    public static function _create(): self {
        $c = new self();
        $c->_frame_init();
        return $c;
    }

    public function hsm_chain() {
        return [
            "Active" => ["Active"],
        ];
    }
    private function __prepareEnter($leaf, $state_args, $enter_args) {
        $comp = null;
        foreach ($this->hsm_chain()[$leaf] as $name) {
            $new_comp = new AsteroidFieldCompartment($name);
            $new_comp->state_args = $state_args;
            $new_comp->enter_args = $enter_args;
            $new_comp->parent_compartment = $comp;
            $comp = $new_comp;
        }
        return $comp;
    }

    private function __prepareExit($exit_args) {
        $comp = $this->__compartment;
        while ($comp !== null) {
            $comp->exit_args = $exit_args;
            $comp = $comp->parent_compartment;
        }
    }

    private function __kernel($__e) {
        // Route event to current state.
        $this->__router($__e);
        // Drain any transitions queued by the handler.
        while ($this->__next_compartment !== null) {
            $next_compartment = $this->__next_compartment;
            $this->__next_compartment = null;
            $exit_event = new AsteroidFieldFrameEvent("<$", $this->__compartment->exit_args);
            $this->__router($exit_event);
            $this->__compartment = $next_compartment;
            $forward_event = $next_compartment->forward_event;
            $next_compartment->forward_event = null;
            if ($forward_event === null) {
                $enter_event = new AsteroidFieldFrameEvent("$>", $this->__compartment->enter_args);
                $this->__router($enter_event);
            } else if ($forward_event->_message === "$>") {
                $this->__router($forward_event);
            } else {
                $enter_event = new AsteroidFieldFrameEvent("$>", $this->__compartment->enter_args);
                $this->__router($enter_event);
                $this->__router($forward_event);
            }
            foreach ($this->_context_stack as $ctx) {
                $ctx->_transitioned = true;
            }
        }
    }

    private function __router($__e) {
        $handler_name = "_state_" . $this->__compartment->state;
        if (method_exists($this, $handler_name)) {
            $this->$handler_name($__e, $this->__compartment);
        }
    }

    private function __transition($next_compartment) {
        $this->__next_compartment = $next_compartment;
    }

    public function spawn_wave($count, $court_size) {
        $__e = new AsteroidFieldFrameEvent("spawn_wave", [$count, $court_size]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function split($index) {
        $__e = new AsteroidFieldFrameEvent("split", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function remove($index) {
        $__e = new AsteroidFieldFrameEvent("remove", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function clear() {
        $__e = new AsteroidFieldFrameEvent("clear", []);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function advance($dt, $court_size) {
        $__e = new AsteroidFieldFrameEvent("advance", [$dt, $court_size]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function count() {
        $__e = new AsteroidFieldFrameEvent("count", []);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function alive_count() {
        $__e = new AsteroidFieldFrameEvent("alive_count", []);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function is_alive($index) {
        $__e = new AsteroidFieldFrameEvent("is_alive", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function position($index) {
        $__e = new AsteroidFieldFrameEvent("position", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function velocity($index) {
        $__e = new AsteroidFieldFrameEvent("velocity", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function size_of($index) {
        $__e = new AsteroidFieldFrameEvent("size_of", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function radius_of($index) {
        $__e = new AsteroidFieldFrameEvent("radius_of", [$index]);
        $__ctx = new AsteroidFieldFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    private function _state_Active($__e, $compartment) {
        if ($__e->_message == "advance") {
            $this->_s_Active_hdl_user_advance($__e, $compartment);
            return;
        }
        if ($__e->_message == "alive_count") {
            $this->_s_Active_hdl_user_alive_count($__e, $compartment);
            return;
        }
        if ($__e->_message == "clear") {
            $this->_s_Active_hdl_user_clear($__e, $compartment);
            return;
        }
        if ($__e->_message == "count") {
            $this->_s_Active_hdl_user_count($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_alive") {
            $this->_s_Active_hdl_user_is_alive($__e, $compartment);
            return;
        }
        if ($__e->_message == "position") {
            $this->_s_Active_hdl_user_position($__e, $compartment);
            return;
        }
        if ($__e->_message == "radius_of") {
            $this->_s_Active_hdl_user_radius_of($__e, $compartment);
            return;
        }
        if ($__e->_message == "remove") {
            $this->_s_Active_hdl_user_remove($__e, $compartment);
            return;
        }
        if ($__e->_message == "size_of") {
            $this->_s_Active_hdl_user_size_of($__e, $compartment);
            return;
        }
        if ($__e->_message == "spawn_wave") {
            $this->_s_Active_hdl_user_spawn_wave($__e, $compartment);
            return;
        }
        if ($__e->_message == "split") {
            $this->_s_Active_hdl_user_split($__e, $compartment);
            return;
        }
        if ($__e->_message == "velocity") {
            $this->_s_Active_hdl_user_velocity($__e, $compartment);
            return;
        }
    }

    private function _s_Active_hdl_user_advance($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $court_size = $__e->_parameters[1];
        $i = 0;
        while ($i < count($this->asteroids)) {
            if ($this->asteroids[$i]->alive) {
                $this->asteroids[$i]->pos = $this->asteroids[$i]->pos->add($this->asteroids[$i]->vel->scale($dt));
                if ($this->asteroids[$i]->pos->x < 0.0) { $this->asteroids[$i]->pos->x = $this->asteroids[$i]->pos->x + $court_size->x; }
                if ($this->asteroids[$i]->pos->x > $court_size->x) { $this->asteroids[$i]->pos->x = $this->asteroids[$i]->pos->x - $court_size->x; }
                if ($this->asteroids[$i]->pos->y < 0.0) { $this->asteroids[$i]->pos->y = $this->asteroids[$i]->pos->y + $court_size->y; }
                if ($this->asteroids[$i]->pos->y > $court_size->y) { $this->asteroids[$i]->pos->y = $this->asteroids[$i]->pos->y - $court_size->y; }
            }
            $i = $i + 1;
        }
    }

    private function _s_Active_hdl_user_alive_count($__e, $compartment) {
                        $c = 0;
                        $i = 0;
                        while ($i < count($this->asteroids)) {
                            if ($this->asteroids[$i]->alive) { $c = $c + 1; }
                            $i = $i + 1;
                        }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $c;
    }

    private function _s_Active_hdl_user_clear($__e, $compartment) {
        $this->asteroids = [];
    }

    private function _s_Active_hdl_user_count($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = count($this->asteroids);
    }

    private function _s_Active_hdl_user_is_alive($__e, $compartment) {
        $index = $__e->_parameters[0];
                        if ($index < 0 || $index >= count($this->asteroids)) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
                            return;
                        }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->asteroids[$index]->alive;
    }

    private function _s_Active_hdl_user_position($__e, $compartment) {
        $index = $__e->_parameters[0];
                        if ($index < 0 || $index >= count($this->asteroids)) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = new Vec2(0, 0);
                            return;
                        }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->asteroids[$index]->pos;
    }

    private function _s_Active_hdl_user_radius_of($__e, $compartment) {
        $index = $__e->_parameters[0];
                        if ($index < 0 || $index >= count($this->asteroids)) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = 0.0;
                            return;
                        }
                        $sz = $this->asteroids[$index]->size;
                        if ($sz == 3) { 
        $this->_context_stack[count($this->_context_stack) - 1]->_return = 32.0;
                                        return; }
                        if ($sz == 2) { 
        $this->_context_stack[count($this->_context_stack) - 1]->_return = 18.0;
                                        return; }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = 10.0;
    }

    private function _s_Active_hdl_user_remove($__e, $compartment) {
        $index = $__e->_parameters[0];
        if ($index < 0 || $index >= count($this->asteroids)) {
            return;
        }
        $this->asteroids[$index]->alive = false;
    }

    private function _s_Active_hdl_user_size_of($__e, $compartment) {
        $index = $__e->_parameters[0];
                        if ($index < 0 || $index >= count($this->asteroids)) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = 0;
                            return;
                        }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->asteroids[$index]->size;
    }

    private function _s_Active_hdl_user_spawn_wave($__e, $compartment) {
        $count = $__e->_parameters[0];
        $court_size = $__e->_parameters[1];
        $this->asteroids = [];
        $i = 0;
        while ($i < $count) {
            $this->spawn_large($court_size);
            $i = $i + 1;
        }
    }

    private function _s_Active_hdl_user_split($__e, $compartment) {
        $index = $__e->_parameters[0];
                        if ($index < 0 || $index >= count($this->asteroids)) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
                            return;
                        }
                        if (!$this->asteroids[$index]->alive) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
                            return;
                        }
                        $this->asteroids[$index]->alive = false;
                        $sz = $this->asteroids[$index]->size;
                        $p = $this->asteroids[$index]->pos;
                        if ($sz > 1) {
                            $this->spawn_child($p, $sz - 1);
                            $this->spawn_child($p, $sz - 1);
                        }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Active_hdl_user_velocity($__e, $compartment) {
        $index = $__e->_parameters[0];
                        if ($index < 0 || $index >= count($this->asteroids)) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = new Vec2(0, 0);
                            return;
                        }
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->asteroids[$index]->vel;
    }

    private function spawn_large($court_size) {
                    $edge = (int)(_rf() * 4);
                    $pos = new Vec2(0.0, 0.0);
                    if ($edge == 0) {
                        $pos = new Vec2(0.0, _rf() * $court_size->y);
                    } elseif ($edge == 1) {
                        $pos = new Vec2($court_size->x, _rf() * $court_size->y);
                    } elseif ($edge == 2) {
                        $pos = new Vec2(_rf() * $court_size->x, 0.0);
                    } else {
                        $pos = new Vec2(_rf() * $court_size->x, $court_size->y);
                    }
                    $angle = _rf() * 2.0 * M_PI;
                    $speed = 40.0 + _rf() * 30.0;
                    $vel = _from_angle($angle, $speed);
                    $this->asteroids[] = new Asteroid($pos, $vel, 3, true);
    }

    private function spawn_child($pos, $size) {
                    $angle = _rf() * 2.0 * M_PI;
                    $speed = 60.0 + _rf() * 40.0 + (3 - $size) * 20.0;
                    $vel = _from_angle($angle, $speed);
                    $this->asteroids[] = new Asteroid($pos, $vel, $size, true);
    }
}

// ------------------------------------------------------------ AsteroidsGame
class AsteroidsGameFrameEvent {
    public $_message;
    public $_parameters;

    public function __construct($message, $parameters = null) {
        $this->_message = $message;
        $this->_parameters = $parameters ?? [];
    }
}


class AsteroidsGameFrameContext {
    public $_event;
    public $_return;
    public $_data;
    public $_transitioned;

    public function __construct($event, $defaultReturn = null) {
        $this->_event = $event;
        $this->_return = $defaultReturn;
        $this->_data = [];
        $this->_transitioned = false;
    }
}


class AsteroidsGameCompartment {
    public $state;
    public $state_args;
    public $state_vars;
    public $enter_args;
    public $exit_args;
    public $forward_event;
    public $parent_compartment;

    public function __construct($state, $parent_compartment = null) {
        $this->state = $state;
        $this->state_args = [];
        $this->state_vars = [];
        $this->enter_args = [];
        $this->exit_args = [];
        $this->forward_event = null;
        $this->parent_compartment = $parent_compartment;
    }

    public function copy() {
        $c = new AsteroidsGameCompartment($this->state, $this->parent_compartment);
        $c->state_args = $this->state_args;
        $c->state_vars = $this->state_vars;
        $c->enter_args = $this->enter_args;
        $c->exit_args = $this->exit_args;
        $c->forward_event = $this->forward_event;
        return $c;
    }
}


class AsteroidsGame {
    private $_state_stack;
    private $__compartment;
    private $__next_compartment;
    private $_context_stack;
    public $difficulty;
    public $score = 0;
    public $wave = 1;
    public $wave_timer = 0.0;
    public $wave_pause = 2.0;
    public $bullets_in_flight = 0;
    public $max_bullets = 4;
    public $last_court_size;
    public $ship;
    public $field;

    public function __construct() {
        $this->_state_stack = [];
        $this->_context_stack = [];
        $this->last_court_size = new Vec2(640, 480);
        $this->field = AsteroidField::_create();
        $this->__compartment = $this->__prepareEnter("Attract", [], []);
        $this->__next_compartment = null;
    }

    public function _frame_init($ship_host, $difficulty): void {
        $this->difficulty = $difficulty;
        $this->ship = Ship::_create($ship_host);
        $__e = new AsteroidsGameFrameEvent("$>", $this->__compartment->enter_args);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        $this->__kernel($__e);
        array_pop($this->_context_stack);
    }

    public static function _create($ship_host, $difficulty): self {
        $c = new self();
        $c->_frame_init($ship_host, $difficulty);
        return $c;
    }

    public function hsm_chain() {
        return [
            "Attract" => ["Attract"],
            "InGame" => ["InGame"],
            "Playing" => ["InGame", "Playing"],
            "ShipDying" => ["InGame", "ShipDying"],
            "WaveClear" => ["InGame", "WaveClear"],
            "Paused" => ["Paused"],
            "GameOver" => ["GameOver"],
        ];
    }
    private function __prepareEnter($leaf, $state_args, $enter_args) {
        $comp = null;
        foreach ($this->hsm_chain()[$leaf] as $name) {
            $new_comp = new AsteroidsGameCompartment($name);
            $new_comp->state_args = $state_args;
            $new_comp->enter_args = $enter_args;
            $new_comp->parent_compartment = $comp;
            $comp = $new_comp;
        }
        return $comp;
    }

    private function __prepareExit($exit_args) {
        $comp = $this->__compartment;
        while ($comp !== null) {
            $comp->exit_args = $exit_args;
            $comp = $comp->parent_compartment;
        }
    }

    private function __kernel($__e) {
        // Route event to current state.
        $this->__router($__e);
        // Drain any transitions queued by the handler.
        while ($this->__next_compartment !== null) {
            $next_compartment = $this->__next_compartment;
            $this->__next_compartment = null;
            $exit_event = new AsteroidsGameFrameEvent("<$", $this->__compartment->exit_args);
            $this->__router($exit_event);
            $this->__compartment = $next_compartment;
            $forward_event = $next_compartment->forward_event;
            $next_compartment->forward_event = null;
            if ($forward_event === null) {
                $enter_event = new AsteroidsGameFrameEvent("$>", $this->__compartment->enter_args);
                $this->__router($enter_event);
            } else if ($forward_event->_message === "$>") {
                $this->__router($forward_event);
            } else {
                $enter_event = new AsteroidsGameFrameEvent("$>", $this->__compartment->enter_args);
                $this->__router($enter_event);
                $this->__router($forward_event);
            }
            foreach ($this->_context_stack as $ctx) {
                $ctx->_transitioned = true;
            }
        }
    }

    private function __router($__e) {
        $handler_name = "_state_" . $this->__compartment->state;
        if (method_exists($this, $handler_name)) {
            $this->$handler_name($__e, $this->__compartment);
        }
    }

    private function __transition($next_compartment) {
        $this->__next_compartment = $next_compartment;
    }

    public function start() {
        $__e = new AsteroidsGameFrameEvent("start", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function restart() {
        $__e = new AsteroidsGameFrameEvent("restart", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function pause() {
        $__e = new AsteroidsGameFrameEvent("pause", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function resume() {
        $__e = new AsteroidsGameFrameEvent("resume", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function tick($dt, $court_size) {
        $__e = new AsteroidsGameFrameEvent("tick", [$dt, $court_size]);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function ship_hit_asteroid($index) {
        $__e = new AsteroidsGameFrameEvent("ship_hit_asteroid", [$index]);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function bullet_hit_asteroid($index) {
        $__e = new AsteroidsGameFrameEvent("bullet_hit_asteroid", [$index]);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function ship_hyperspace() {
        $__e = new AsteroidsGameFrameEvent("ship_hyperspace", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function bullet_fired() {
        $__e = new AsteroidsGameFrameEvent("bullet_fired", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function bullet_expired() {
        $__e = new AsteroidsGameFrameEvent("bullet_expired", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function get_score() {
        $__e = new AsteroidsGameFrameEvent("get_score", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function get_lives() {
        $__e = new AsteroidsGameFrameEvent("get_lives", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function get_wave() {
        $__e = new AsteroidsGameFrameEvent("get_wave", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function get_difficulty() {
        $__e = new AsteroidsGameFrameEvent("get_difficulty", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    public function is_paused() {
        $__e = new AsteroidsGameFrameEvent("is_paused", []);
        $__ctx = new AsteroidsGameFrameContext($__e, null);
        $this->_context_stack[] = $__ctx;
        try {
            $this->__kernel($__e);
            return array_pop($this->_context_stack)->_return;
        } catch (\Throwable $__frame_err) {
            array_pop($this->_context_stack);
            throw $__frame_err;
        }
    }

    private function _state_Attract($__e, $compartment) {
        if ($__e->_message == "$>") {
            $this->_s_Attract_hdl_frame_enter($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_difficulty") {
            $this->_s_Attract_hdl_user_get_difficulty($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_Attract_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_score") {
            $this->_s_Attract_hdl_user_get_score($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_wave") {
            $this->_s_Attract_hdl_user_get_wave($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_paused") {
            $this->_s_Attract_hdl_user_is_paused($__e, $compartment);
            return;
        }
        if ($__e->_message == "start") {
            $this->_s_Attract_hdl_user_start($__e, $compartment);
            return;
        }
    }

    private function _state_InGame($__e, $compartment) {
        if ($__e->_message == "bullet_expired") {
            $this->_s_InGame_hdl_user_bullet_expired($__e, $compartment);
            return;
        }
        if ($__e->_message == "bullet_fired") {
            $this->_s_InGame_hdl_user_bullet_fired($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_difficulty") {
            $this->_s_InGame_hdl_user_get_difficulty($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_InGame_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_score") {
            $this->_s_InGame_hdl_user_get_score($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_wave") {
            $this->_s_InGame_hdl_user_get_wave($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_paused") {
            $this->_s_InGame_hdl_user_is_paused($__e, $compartment);
            return;
        }
        if ($__e->_message == "pause") {
            $this->_s_InGame_hdl_user_pause($__e, $compartment);
            return;
        }
    }

    private function _state_Playing($__e, $compartment) {
        if ($__e->_message == "bullet_hit_asteroid") {
            $this->_s_Playing_hdl_user_bullet_hit_asteroid($__e, $compartment);
            return;
        }
        if ($__e->_message == "ship_hit_asteroid") {
            $this->_s_Playing_hdl_user_ship_hit_asteroid($__e, $compartment);
            return;
        }
        if ($__e->_message == "ship_hyperspace") {
            $this->_s_Playing_hdl_user_ship_hyperspace($__e, $compartment);
            return;
        }
        if ($__e->_message == "tick") {
            $this->_s_Playing_hdl_user_tick($__e, $compartment);
            return;
        }
        $this->_state_InGame($__e, $compartment->parent_compartment);
    }

    private function _state_ShipDying($__e, $compartment) {
        if ($__e->_message == "tick") {
            $this->_s_ShipDying_hdl_user_tick($__e, $compartment);
            return;
        }
        $this->_state_InGame($__e, $compartment->parent_compartment);
    }

    private function _state_WaveClear($__e, $compartment) {
        if ($__e->_message == "$>") {
            $this->_s_WaveClear_hdl_frame_enter($__e, $compartment);
            return;
        }
        if ($__e->_message == "tick") {
            $this->_s_WaveClear_hdl_user_tick($__e, $compartment);
            return;
        }
        $this->_state_InGame($__e, $compartment->parent_compartment);
    }

    private function _state_Paused($__e, $compartment) {
        if ($__e->_message == "get_difficulty") {
            $this->_s_Paused_hdl_user_get_difficulty($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_Paused_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_score") {
            $this->_s_Paused_hdl_user_get_score($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_wave") {
            $this->_s_Paused_hdl_user_get_wave($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_paused") {
            $this->_s_Paused_hdl_user_is_paused($__e, $compartment);
            return;
        }
        if ($__e->_message == "resume") {
            $this->_s_Paused_hdl_user_resume($__e, $compartment);
            return;
        }
    }

    private function _state_GameOver($__e, $compartment) {
        if ($__e->_message == "get_difficulty") {
            $this->_s_GameOver_hdl_user_get_difficulty($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_lives") {
            $this->_s_GameOver_hdl_user_get_lives($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_score") {
            $this->_s_GameOver_hdl_user_get_score($__e, $compartment);
            return;
        }
        if ($__e->_message == "get_wave") {
            $this->_s_GameOver_hdl_user_get_wave($__e, $compartment);
            return;
        }
        if ($__e->_message == "is_paused") {
            $this->_s_GameOver_hdl_user_is_paused($__e, $compartment);
            return;
        }
        if ($__e->_message == "restart") {
            $this->_s_GameOver_hdl_user_restart($__e, $compartment);
            return;
        }
    }

    private function _s_Attract_hdl_frame_enter($__e, $compartment) {
        $this->score = 0;
        $this->wave = 1;
        $this->bullets_in_flight = 0;
    }

    private function _s_Attract_hdl_user_get_difficulty($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->difficulty;
    }

    private function _s_Attract_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->ship->get_lives();
    }

    private function _s_Attract_hdl_user_get_score($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->score;
    }

    private function _s_Attract_hdl_user_get_wave($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->wave;
    }

    private function _s_Attract_hdl_user_is_paused($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_Attract_hdl_user_start($__e, $compartment) {
        $this->ship->respawn();
        $n = $this->asteroids_for_wave(1);
        $this->field->spawn_wave($n, $this->last_court_size);
        $__compartment = $this->__prepareEnter("Playing", [], []);
        $this->__transition($__compartment);
        return;
    }

    private function _s_InGame_hdl_user_bullet_expired($__e, $compartment) {
        if ($this->bullets_in_flight > 0) {
            $this->bullets_in_flight = $this->bullets_in_flight - 1;
        }
    }

    private function _s_InGame_hdl_user_bullet_fired($__e, $compartment) {
        $this->bullets_in_flight = $this->bullets_in_flight + 1;
    }

    private function _s_InGame_hdl_user_get_difficulty($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->difficulty;
    }

    private function _s_InGame_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->ship->get_lives();
    }

    private function _s_InGame_hdl_user_get_score($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->score;
    }

    private function _s_InGame_hdl_user_get_wave($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->wave;
    }

    private function _s_InGame_hdl_user_is_paused($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_InGame_hdl_user_pause($__e, $compartment) {
        $this->_state_stack[] = $this->__compartment;
        $this->__transition(new AsteroidsGameCompartment("Paused"));
        return;
    }

    private function _s_Playing_hdl_user_bullet_hit_asteroid($__e, $compartment) {
        $index = $__e->_parameters[0];
        if ($this->field->split($index)) {
            $sz = $this->size_points($index);
            $this->score = $this->score + $sz * $this->difficulty;
            if ($this->field->alive_count() <= 0) {
                $__compartment = $this->__prepareEnter("WaveClear", [], []);
                $this->__transition($__compartment);
                return;
            }
        }
    }

    private function _s_Playing_hdl_user_ship_hit_asteroid($__e, $compartment) {
        $index = $__e->_parameters[0];
        if (!$this->ship->can_be_hit()) {
            return;
        }
        $this->ship->hit();
        $__compartment = $this->__prepareEnter("ShipDying", [], []);
        $this->__transition($__compartment);
        return;
    }

    private function _s_Playing_hdl_user_ship_hyperspace($__e, $compartment) {
        $this->ship->hyperspace();
    }

    private function _s_Playing_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $court_size = $__e->_parameters[1];
        $this->last_court_size = $court_size;
        $this->ship->tick($dt);
        $this->field->advance($dt, $court_size);
    }

    private function _s_ShipDying_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $court_size = $__e->_parameters[1];
        $this->last_court_size = $court_size;
        $this->ship->tick($dt);
        $this->field->advance($dt, $court_size);
        if ($this->ship->get_current_state_name() == "Respawning") {
            $__compartment = $this->__prepareEnter("Playing", [], []);
            $this->__transition($__compartment);
            return;
        } elseif ($this->ship->get_current_state_name() == "Dead") {
            $__compartment = $this->__prepareEnter("GameOver", [], []);
            $this->__transition($__compartment);
            return;
        }
    }

    private function _s_WaveClear_hdl_frame_enter($__e, $compartment) {
        $this->wave_timer = 0.0;
    }

    private function _s_WaveClear_hdl_user_tick($__e, $compartment) {
        $dt = $__e->_parameters[0];
        $court_size = $__e->_parameters[1];
        $this->last_court_size = $court_size;
        $this->ship->tick($dt);
        $this->wave_timer = $this->wave_timer + $dt;
        if ($this->wave_timer >= $this->wave_pause) {
            $this->wave = $this->wave + 1;
            $n = $this->asteroids_for_wave($this->wave);
            $this->field->spawn_wave($n, $court_size);
            $__compartment = $this->__prepareEnter("Playing", [], []);
            $this->__transition($__compartment);
            return;
        }
    }

    private function _s_Paused_hdl_user_get_difficulty($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->difficulty;
    }

    private function _s_Paused_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->ship->get_lives();
    }

    private function _s_Paused_hdl_user_get_score($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->score;
    }

    private function _s_Paused_hdl_user_get_wave($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->wave;
    }

    private function _s_Paused_hdl_user_is_paused($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = true;
    }

    private function _s_Paused_hdl_user_resume($__e, $compartment) {
        $__saved = array_pop($this->_state_stack);
        $this->__transition($__saved);
        return;
    }

    private function _s_GameOver_hdl_user_get_difficulty($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->difficulty;
    }

    private function _s_GameOver_hdl_user_get_lives($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->ship->get_lives();
    }

    private function _s_GameOver_hdl_user_get_score($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->score;
    }

    private function _s_GameOver_hdl_user_get_wave($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = $this->wave;
    }

    private function _s_GameOver_hdl_user_is_paused($__e, $compartment) {
        $this->_context_stack[count($this->_context_stack) - 1]->_return = false;
    }

    private function _s_GameOver_hdl_user_restart($__e, $compartment) {
        $__compartment = $this->__prepareEnter("Attract", [], []);
        $this->__transition($__compartment);
        return;
    }

    private function asteroids_for_wave($wave) {
                    $base_count = 2 + $this->difficulty;
                    return $base_count + $wave - 1;
    }

    private function size_points($index) {
                    $sz = $this->field->size_of($index);
                    if ($sz == 3) { return 20; }
                    if ($sz == 2) { return 50; }
                    return 100;
    }

    public function get_current_state_name() {
         return $this->__compartment->state; 
    }

    public function get_bullets_in_flight() {
         return $this->bullets_in_flight; 
    }

    public function get_max_bullets() {
         return $this->max_bullets; 
    }
}

