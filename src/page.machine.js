
// PageController — Frame state machine that manages which game version
// (JS or Godot WASM) is mounted on the showcase page. Two states, two
// events. The host parameter is an object the entry/exit handlers call
// to actually mount and tear down each runtime — that way the page
// state-transition logic lives in Frame, not in ad-hoc DOM toggling.
//
// On entry into $JavaScript the host re-enables Phaser keyboard input
// and resumes the scene; on exit it pauses + disables the keyboard so
// SPACE/arrows stop firing into the canvas. On entry into $Godot the
// host shows the Godot stage and (re)creates the iframe; on exit it
// destroys the iframe so the WASM is freed.
//
// Initial state is $JavaScript — the page boots with JS visible, and
// the $>() handler fires once to align the host (keyboard enabled,
// Godot stage hidden, JS stage shown).
export class PageControllerFrameEvent {
    _message;
    _parameters;

    constructor(message, parameters) {
        this._message = message;
        this._parameters = parameters;
    }
}


export class PageControllerFrameContext {
    event;
    _return;
    _data;
    _transitioned;

    constructor(event, default_return) {
        this.event = event;
        this._return = default_return;
        this._data = {  };
        this._transitioned = false;
    }
}


export class PageControllerCompartment {
    state;
    state_args;
    state_vars;
    enter_args;
    exit_args;
    forward_event;
    parent_compartment;

    constructor(state, parent_compartment = null) {
        this.state = state;
        this.state_args = [];
        this.state_vars = {  };
        this.enter_args = [];
        this.exit_args = [];
        this.forward_event = null;
        this.parent_compartment = parent_compartment;
    }

    copy() {
        const c = new PageControllerCompartment(this.state, this.parent_compartment);
        c.state_args = {...this.state_args};
        c.state_vars = {...this.state_vars};
        c.enter_args = {...this.enter_args};
        c.exit_args = {...this.exit_args};
        c.forward_event = this.forward_event;
        return c;
    }
}


export class PageController {
    _state_stack;
    __compartment;
    __next_compartment;
    _context_stack;
    host;

    constructor() {
        this._state_stack = [];
        this._context_stack = [];
        this.__compartment = this.__prepareEnter("JavaScript", [], []);
        this.__next_compartment = null;
    }

    _frame_init(host) {
        this.host = host;
        const __e = new PageControllerFrameEvent("$>", this.__compartment.enter_args);
        const __ctx = new PageControllerFrameContext(__e, null);
        this._context_stack.push(__ctx);
        this.__kernel(__e);
        this._context_stack.pop();
    }

    static _create(host) {
        const c = new PageController();
        c._frame_init(host);
        return c;
    }

    static _HSM_CHAIN = {
        "JavaScript": ["JavaScript"],
        "Godot": ["Godot"],
    };
    __prepareEnter(leaf, state_args, enter_args) {
        let comp = null;
        for (const name of PageController._HSM_CHAIN[leaf]) {
            const new_comp = new PageControllerCompartment(name);
            new_comp.state_args = [...state_args];
            new_comp.enter_args = [...enter_args];
            new_comp.parent_compartment = comp;
            comp = new_comp;
        }
        return comp;
    }

    __prepareExit(exit_args) {
        let comp = this.__compartment;
        while (comp !== null) {
            comp.exit_args = [...exit_args];
            comp = comp.parent_compartment;
        }
    }

    __kernel(__e) {
        // Route event to current state.
        this.__router(__e);
        // Drain any transitions queued by the handler.
        while (this.__next_compartment !== null) {
            const next_compartment = this.__next_compartment;
            this.__next_compartment = null;
            // Exit the current (leaf) state.
            const exit_event = new PageControllerFrameEvent("<$", this.__compartment.exit_args);
            this.__router(exit_event);
            // Switch to the new compartment.
            this.__compartment = next_compartment;
            // Three-branch forward-event handling.
            const forward_event = next_compartment.forward_event;
            next_compartment.forward_event = null;
            if (forward_event === null) {
                // No forwarded event — synthesize a fresh $>.
                const enter_event = new PageControllerFrameEvent("$>", this.__compartment.enter_args);
                this.__router(enter_event);
            } else if (forward_event._message === "$>") {
                // Forwarded event IS $> — dispatch directly so the
                // destination's $> handler receives the caller's payload.
                this.__router(forward_event);
            } else {
                // Forwarded event is not $> — initialize the destination
                // with a fresh $>, then dispatch the forward.
                const enter_event = new PageControllerFrameEvent("$>", this.__compartment.enter_args);
                this.__router(enter_event);
                this.__router(forward_event);
            }
            for (const ctx of this._context_stack) {
                ctx._transitioned = true;
            }
        }
    }

    __router(__e) {
        const handler_name = `_state_${this.__compartment.state}`;
        const handler = this[handler_name];
        if (handler) {
            handler.call(this, __e, this.__compartment);
        }
    }

    __transition(next_compartment) {
        this.__next_compartment = next_compartment;
    }

    switch_to_js() {
        const __e = new PageControllerFrameEvent("switch_to_js", []);
        const __ctx = new PageControllerFrameContext(__e, null);
        this._context_stack.push(__ctx);
        this.__kernel(__e);
        return this._context_stack.pop()._return;
    }

    switch_to_godot() {
        const __e = new PageControllerFrameEvent("switch_to_godot", []);
        const __ctx = new PageControllerFrameContext(__e, null);
        this._context_stack.push(__ctx);
        this.__kernel(__e);
        return this._context_stack.pop()._return;
    }

    _state_JavaScript(__e, compartment) {
        if (__e._message === "<$") {
            this._s_JavaScript_hdl_frame_exit(__e, compartment);
            return;
        }
        if (__e._message === "$>") {
            this._s_JavaScript_hdl_frame_enter(__e, compartment);
            return;
        }
        if (__e._message === "switch_to_godot") {
            this._s_JavaScript_hdl_user_switch_to_godot(__e, compartment);
            return;
        }
    }

    _state_Godot(__e, compartment) {
        if (__e._message === "<$") {
            this._s_Godot_hdl_frame_exit(__e, compartment);
            return;
        }
        if (__e._message === "$>") {
            this._s_Godot_hdl_frame_enter(__e, compartment);
            return;
        }
        if (__e._message === "switch_to_js") {
            this._s_Godot_hdl_user_switch_to_js(__e, compartment);
            return;
        }
    }

    _s_JavaScript_hdl_frame_exit(__e, compartment) {
        this.host.hide_js()
    }

    _s_JavaScript_hdl_frame_enter(__e, compartment) {
        this.host.show_js()
    }

    _s_JavaScript_hdl_user_switch_to_godot(__e, compartment) {
        const __compartment = this.__prepareEnter("Godot", [], []);
        this.__transition(__compartment);
        return;
    }

    _s_Godot_hdl_frame_exit(__e, compartment) {
        this.host.hide_godot()
    }

    _s_Godot_hdl_frame_enter(__e, compartment) {
        this.host.show_godot()
    }

    _s_Godot_hdl_user_switch_to_js(__e, compartment) {
        const __compartment = this.__prepareEnter("JavaScript", [], []);
        this.__transition(__compartment);
        return;
    }

    current_state() {
         return this.__compartment.state; 
    }
}

