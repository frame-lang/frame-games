
// ============================================================
// Asteroids — Rust/gdext port of the Frame controller.
// Three systems: Ship, AsteroidField, AsteroidsGame. FSM logic is
// identical to asteroids.fgd; only the native bodies differ (// comments,
// braces + parens, explicit Rust types, gdext APIs). The FSMs are plain
// Rust structs — gdext wrapping lives in the gameplay layer.
// ============================================================

use godot::prelude::*;

// An asteroid is plain data — the field owns a typed Vec of them (the
// Rust analog of the GDScript Array<Dictionary>).
#[derive(Clone, Copy)]
pub struct Asteroid {
    pub pos: Vector2,
    pub vel: Vector2,
    pub size: i32,
    pub alive: bool,
}

fn rf() -> f32 { godot::global::randf() as f32 }

// ------------------------------------------------------------ Ship
#[allow(dead_code)]
#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[allow(unused_variables)]
#[allow(unused_mut)]
#[allow(unused_imports)]
#[allow(clippy::assign_op_pattern)]
#[allow(clippy::clone_on_copy)]
#[allow(clippy::derivable_impls)]
#[allow(clippy::match_single_binding)]
#[allow(clippy::needless_return)]
#[allow(clippy::new_without_default)]
#[allow(clippy::single_match)]
mod _ship_framec {
    use super::*;
    extern crate alloc;
    use alloc::{vec, format};
    #[derive(Clone, Debug)]
    #[allow(dead_code, non_camel_case_types)]
    enum ShipFrameEvent {
        Tick { dt: f32 },
        Hit {  },
        Hyperspace {  },
        Respawn {  },
        Fire {  },
        CanFire {  },
        CanBeHit {  },
        CanHyperspace {  },
        IsVisible {  },
        IsAlive {  },
        GetLives {  },
        FrameEnter {},
        FrameExit {},
    }

    #[derive(Clone)]
    #[allow(dead_code, non_camel_case_types)]
    enum ShipFrameReturn {
        CanBeHit(bool),
        CanFire(bool),
        CanHyperspace(bool),
        GetLives(i32),
        IsAlive(bool),
        IsVisible(bool),
        _Lifecycle(alloc::rc::Rc<dyn core::any::Any>),
    }

    #[allow(dead_code)]
    impl ShipFrameEvent {
        fn name(&self) -> &'static str {
            match self {
                ShipFrameEvent::Tick { .. } => "tick",
                ShipFrameEvent::Hit { .. } => "hit",
                ShipFrameEvent::Hyperspace { .. } => "hyperspace",
                ShipFrameEvent::Respawn { .. } => "respawn",
                ShipFrameEvent::Fire { .. } => "fire",
                ShipFrameEvent::CanFire { .. } => "can_fire",
                ShipFrameEvent::CanBeHit { .. } => "can_be_hit",
                ShipFrameEvent::CanHyperspace { .. } => "can_hyperspace",
                ShipFrameEvent::IsVisible { .. } => "is_visible",
                ShipFrameEvent::IsAlive { .. } => "is_alive",
                ShipFrameEvent::GetLives { .. } => "get_lives",
                ShipFrameEvent::FrameEnter { .. } => "$>",
                ShipFrameEvent::FrameExit { .. } => "<$",
            }
        }
    }

    #[derive(Clone, Debug)]
    #[allow(dead_code, non_camel_case_types)]
    enum ShipFrameValue {
        Int(i64),
        Float(f64),
        Bool(bool),
        Str(String),
        List(Vec<Self>),
        Dict(alloc::collections::BTreeMap<String, Self>),
    }

    #[allow(dead_code, non_camel_case_types)]
    struct ShipFrameContext {
        event: alloc::rc::Rc<ShipFrameEvent>,
        _return: Option<ShipFrameReturn>,
        _data: alloc::collections::BTreeMap<String, ShipFrameValue>,
        _transitioned: bool,
    }

    impl ShipFrameContext {
        fn new(event: alloc::rc::Rc<ShipFrameEvent>, default_return: Option<ShipFrameReturn>) -> Self {
            Self {
                event,
                _return: default_return,
                _data: alloc::collections::BTreeMap::new(),
                _transitioned: false,
            }
        }
    }

    #[derive(Clone)]
    struct AliveContext {
        cooldown: f32,
    }

    impl Default for AliveContext {
        fn default() -> Self {
            Self {
                cooldown: 0.0,
            }
        }
    }

    #[derive(Clone)]
    struct InHyperspaceContext {
        timer: f32,
        duration: f32,
    }

    impl Default for InHyperspaceContext {
        fn default() -> Self {
            Self {
                timer: 0.0,
                duration: 0.4,
            }
        }
    }

    #[derive(Clone)]
    struct ExplodingContext {
        timer: f32,
        duration: f32,
    }

    impl Default for ExplodingContext {
        fn default() -> Self {
            Self {
                timer: 0.0,
                duration: 1.0,
            }
        }
    }

    #[derive(Clone)]
    struct RespawningContext {
        timer: f32,
        duration: f32,
    }

    impl Default for RespawningContext {
        fn default() -> Self {
            Self {
                timer: 0.0,
                duration: 2.0,
            }
        }
    }

    #[allow(dead_code, non_camel_case_types)]
    #[derive(Clone)]
    enum ShipStateContext {
        Alive(AliveContext),
        InHyperspace(InHyperspaceContext),
        Exploding(ExplodingContext),
        Respawning(RespawningContext),
        Dead,
        __NoContext,
    }

    impl Default for ShipStateContext {
        fn default() -> Self {
            ShipStateContext::Alive(AliveContext::default())
        }
    }

    #[allow(dead_code, non_camel_case_types)]
    #[derive(Clone)]
    struct ShipCompartment {
        state: String,
        state_context: ShipStateContext,
        forward_event: Option<ShipFrameEvent>,
        parent_compartment: Option<Box<ShipCompartment>>,
    }

    impl ShipCompartment {
        fn new(state: &str) -> Self {
            let state_context = match state {
                "Alive" => ShipStateContext::Alive(AliveContext::default()),
                "InHyperspace" => ShipStateContext::InHyperspace(InHyperspaceContext::default()),
                "Exploding" => ShipStateContext::Exploding(ExplodingContext::default()),
                "Respawning" => ShipStateContext::Respawning(RespawningContext::default()),
                "Dead" => ShipStateContext::Dead,
                _ => ShipStateContext::__NoContext,
            };
            Self {
                state: state.to_string(),
                state_context,
                forward_event: None,
                parent_compartment: None,
            }
        }
    }

    #[allow(dead_code)]
    pub struct Ship {
        _state_stack: Vec<ShipCompartment>,
        __compartment: ShipCompartment,
        __next_compartment: Option<ShipCompartment>,
        _context_stack: Vec<ShipFrameContext>,
        pub host: Gd<Node>,
        pub lives_remaining: i32,
        pub starting_lives: i32,
        pub hyperspaces_remaining: i32,
        pub starting_hyperspaces: i32,
    }

    #[allow(non_snake_case)]
    impl Ship {
        pub fn __create(host: Gd<Node>) -> Self {
            let mut c = Self {
                _state_stack: Vec::new(),
                _context_stack: Vec::new(),
                lives_remaining: 3,
                starting_lives: 3,
                hyperspaces_remaining: 3,
                starting_hyperspaces: 3,
                __compartment: ShipCompartment::new("Alive"),
                __next_compartment: None,
                host: host,
            };
            c.__compartment = c.__prepareEnter("Alive");
            let __e = alloc::rc::Rc::new(ShipFrameEvent::FrameEnter {});
            let __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            c._context_stack.push(__ctx);
            c.__kernel(&__e);
            c._context_stack.pop();
            c
        }

        fn __hsm_chain(&mut self, leaf: &str) -> &'static [&'static str] {
            match leaf {
                "Alive" => &["Alive"],
                "InHyperspace" => &["InHyperspace"],
                "Exploding" => &["Exploding"],
                "Respawning" => &["Respawning"],
                "Dead" => &["Dead"],
                _ => &[],
            }
        }

        fn __prepareEnter(&mut self, leaf: &str) -> ShipCompartment {
            let chain = self.__hsm_chain(leaf);
            let mut comp: Option<ShipCompartment> = None;
            for name in chain.iter() {
                let mut new_comp = ShipCompartment::new(name);
                if let Some(parent) = comp.take() {
                    new_comp.parent_compartment = Some(Box::new(parent));
                }
                comp = Some(new_comp);
            }
            comp.expect("chain must contain at least the leaf state")
        }

        fn __kernel(&mut self, __e: &alloc::rc::Rc<ShipFrameEvent>) {
            // Route event to current state.
            self.__router(__e);
            // Drain any transitions queued by the handler.
            while self.__next_compartment.is_some() {
                let next_compartment = self.__next_compartment.take().expect("invariant: while-loop guard checked is_some()");
                // Exit the current (leaf) state. RFC-0025.1: exit args live in the
                // source state's typed ctx (written at the transition site), so the
                // synthesized `<$` event carries no payload.
                let exit_event = alloc::rc::Rc::new(ShipFrameEvent::FrameExit {});
                self.__router(&exit_event);
                // Switch to the new compartment.
                self.__compartment = next_compartment;
                // Three-branch forward-event handling (RFC-0025 Track B.1: forward
                // event is matched on enum variant; $> recognition is now a
                // structural match, not a string compare).
                match self.__compartment.forward_event.take() {
                    None => {
                        // No forwarded event — synthesize a fresh $>. RFC-0025.1:
                        // enter args live in the destination's typed ctx.
                        let enter_event = alloc::rc::Rc::new(ShipFrameEvent::FrameEnter {});
                        self.__router(&enter_event);
                    }
                    Some(fwd) if matches!(fwd, ShipFrameEvent::FrameEnter { .. }) => {
                        // Forwarded event IS $> — dispatch directly so the
                        // destination's $> handler receives the caller's payload.
                        let fwd_rc = alloc::rc::Rc::new(fwd);
                        self.__router(&fwd_rc);
                    }
                    Some(fwd) => {
                        // Forwarded event is not $> — initialize the destination
                        // with a fresh $>, then dispatch the forward.
                        let enter_event = alloc::rc::Rc::new(ShipFrameEvent::FrameEnter {});
                        self.__router(&enter_event);
                        let fwd_rc = alloc::rc::Rc::new(fwd);
                        self.__router(&fwd_rc);
                    }
                }
                for ctx in self._context_stack.iter_mut() {
                    ctx._transitioned = true;
                }
            }
        }

        fn __router(&mut self, __e: &alloc::rc::Rc<ShipFrameEvent>) {
            let __ev: &ShipFrameEvent = __e;
            match self.__compartment.state.as_str() {
                "Alive" => self._state_Alive(__ev),
                "InHyperspace" => self._state_InHyperspace(__ev),
                "Exploding" => self._state_Exploding(__ev),
                "Respawning" => self._state_Respawning(__ev),
                "Dead" => self._state_Dead(__ev),
                _ => {}
            }
        }

        fn __transition(&mut self, next_compartment: ShipCompartment) {
            self.__next_compartment = Some(next_compartment);
        }

        pub fn tick(&mut self, dt: f32) {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::Tick { dt: dt.clone() });
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn hit(&mut self) {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::Hit {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn hyperspace(&mut self) {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::Hyperspace {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn respawn(&mut self) {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::Respawn {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn fire(&mut self) {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::Fire {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn can_fire(&mut self) -> bool {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::CanFire {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(ShipFrameReturn::CanFire(v)) => v,
                Some(ShipFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn can_be_hit(&mut self) -> bool {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::CanBeHit {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(ShipFrameReturn::CanBeHit(v)) => v,
                Some(ShipFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn can_hyperspace(&mut self) -> bool {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::CanHyperspace {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(ShipFrameReturn::CanHyperspace(v)) => v,
                Some(ShipFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn is_visible(&mut self) -> bool {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::IsVisible {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(ShipFrameReturn::IsVisible(v)) => v,
                Some(ShipFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn is_alive(&mut self) -> bool {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::IsAlive {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(ShipFrameReturn::IsAlive(v)) => v,
                Some(ShipFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn get_lives(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(ShipFrameEvent::GetLives {});
            let mut __ctx = ShipFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(ShipFrameReturn::GetLives(v)) => v,
                Some(ShipFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        fn _state_Alive(&mut self, __e: &ShipFrameEvent) {
            match __e {
                ShipFrameEvent::CanBeHit { .. } => { self._s_Alive_hdl_user_can_be_hit(__e); }
                ShipFrameEvent::CanFire { .. } => { self._s_Alive_hdl_user_can_fire(__e); }
                ShipFrameEvent::CanHyperspace { .. } => { self._s_Alive_hdl_user_can_hyperspace(__e); }
                ShipFrameEvent::Fire { .. } => { self._s_Alive_hdl_user_fire(__e); }
                ShipFrameEvent::GetLives { .. } => { self._s_Alive_hdl_user_get_lives(__e); }
                ShipFrameEvent::Hit { .. } => { self._s_Alive_hdl_user_hit(__e); }
                ShipFrameEvent::Hyperspace { .. } => { self._s_Alive_hdl_user_hyperspace(__e); }
                ShipFrameEvent::IsAlive { .. } => { self._s_Alive_hdl_user_is_alive(__e); }
                ShipFrameEvent::IsVisible { .. } => { self._s_Alive_hdl_user_is_visible(__e); }
                ShipFrameEvent::Tick { dt, .. } => {
                    self._s_Alive_hdl_user_tick(__e, *dt);
                }
                _ => {}
            }
        }

        fn _state_InHyperspace(&mut self, __e: &ShipFrameEvent) {
            match __e {
                ShipFrameEvent::FrameExit { .. } => { self._s_InHyperspace_hdl_frame_exit(__e); }
                ShipFrameEvent::FrameEnter { .. } => { self._s_InHyperspace_hdl_frame_enter(__e); }
                ShipFrameEvent::CanBeHit { .. } => { self._s_InHyperspace_hdl_user_can_be_hit(__e); }
                ShipFrameEvent::CanFire { .. } => { self._s_InHyperspace_hdl_user_can_fire(__e); }
                ShipFrameEvent::CanHyperspace { .. } => { self._s_InHyperspace_hdl_user_can_hyperspace(__e); }
                ShipFrameEvent::GetLives { .. } => { self._s_InHyperspace_hdl_user_get_lives(__e); }
                ShipFrameEvent::IsAlive { .. } => { self._s_InHyperspace_hdl_user_is_alive(__e); }
                ShipFrameEvent::IsVisible { .. } => { self._s_InHyperspace_hdl_user_is_visible(__e); }
                ShipFrameEvent::Tick { dt, .. } => {
                    self._s_InHyperspace_hdl_user_tick(__e, *dt);
                }
                _ => {}
            }
        }

        fn _state_Exploding(&mut self, __e: &ShipFrameEvent) {
            match __e {
                ShipFrameEvent::FrameEnter { .. } => { self._s_Exploding_hdl_frame_enter(__e); }
                ShipFrameEvent::CanBeHit { .. } => { self._s_Exploding_hdl_user_can_be_hit(__e); }
                ShipFrameEvent::CanFire { .. } => { self._s_Exploding_hdl_user_can_fire(__e); }
                ShipFrameEvent::CanHyperspace { .. } => { self._s_Exploding_hdl_user_can_hyperspace(__e); }
                ShipFrameEvent::GetLives { .. } => { self._s_Exploding_hdl_user_get_lives(__e); }
                ShipFrameEvent::IsAlive { .. } => { self._s_Exploding_hdl_user_is_alive(__e); }
                ShipFrameEvent::IsVisible { .. } => { self._s_Exploding_hdl_user_is_visible(__e); }
                ShipFrameEvent::Tick { dt, .. } => {
                    self._s_Exploding_hdl_user_tick(__e, *dt);
                }
                _ => {}
            }
        }

        fn _state_Respawning(&mut self, __e: &ShipFrameEvent) {
            match __e {
                ShipFrameEvent::FrameEnter { .. } => { self._s_Respawning_hdl_frame_enter(__e); }
                ShipFrameEvent::CanBeHit { .. } => { self._s_Respawning_hdl_user_can_be_hit(__e); }
                ShipFrameEvent::CanFire { .. } => { self._s_Respawning_hdl_user_can_fire(__e); }
                ShipFrameEvent::CanHyperspace { .. } => { self._s_Respawning_hdl_user_can_hyperspace(__e); }
                ShipFrameEvent::GetLives { .. } => { self._s_Respawning_hdl_user_get_lives(__e); }
                ShipFrameEvent::IsAlive { .. } => { self._s_Respawning_hdl_user_is_alive(__e); }
                ShipFrameEvent::IsVisible { .. } => { self._s_Respawning_hdl_user_is_visible(__e); }
                ShipFrameEvent::Tick { dt, .. } => {
                    self._s_Respawning_hdl_user_tick(__e, *dt);
                }
                _ => {}
            }
        }

        fn _state_Dead(&mut self, __e: &ShipFrameEvent) {
            match __e {
                ShipFrameEvent::CanBeHit { .. } => { self._s_Dead_hdl_user_can_be_hit(__e); }
                ShipFrameEvent::CanFire { .. } => { self._s_Dead_hdl_user_can_fire(__e); }
                ShipFrameEvent::CanHyperspace { .. } => { self._s_Dead_hdl_user_can_hyperspace(__e); }
                ShipFrameEvent::GetLives { .. } => { self._s_Dead_hdl_user_get_lives(__e); }
                ShipFrameEvent::IsAlive { .. } => { self._s_Dead_hdl_user_is_alive(__e); }
                ShipFrameEvent::IsVisible { .. } => { self._s_Dead_hdl_user_is_visible(__e); }
                ShipFrameEvent::Respawn { .. } => { self._s_Dead_hdl_user_respawn(__e); }
                _ => {}
            }
        }

        fn _s_Alive_hdl_user_can_be_hit(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanBeHit(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Alive_hdl_user_can_fire(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanFire({ let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Alive" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Alive(ctx) => ctx.cooldown, _ => unreachable!() } } <= 0.0);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Alive_hdl_user_can_hyperspace(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanHyperspace(self.hyperspaces_remaining > 0);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Alive_hdl_user_fire(&mut self, __e: &ShipFrameEvent) {
             
            {
                let __rhs = 0.22;
                let mut __cursor: Option<&mut ShipCompartment> = Some(&mut self.__compartment);
                while let Some(__c) = __cursor {
                    if __c.state == "Alive" {
                        if let ShipStateContext::Alive(ref mut ctx) = __c.state_context {
                            ctx.cooldown = __rhs;
                        }
                        break;
                    }
                    __cursor = __c.parent_compartment.as_deref_mut();
                }
            }
        }

        fn _s_Alive_hdl_user_get_lives(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::GetLives(self.lives_remaining);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Alive_hdl_user_hit(&mut self, __e: &ShipFrameEvent) {
            let mut __compartment = self.__prepareEnter("Exploding");
            self.__transition(__compartment);
            return;
        }

        fn _s_Alive_hdl_user_hyperspace(&mut self, __e: &ShipFrameEvent) {
            if self.hyperspaces_remaining > 0 {
                self.hyperspaces_remaining = self.hyperspaces_remaining - 1;
                let mut __compartment = self.__prepareEnter("InHyperspace");
                self.__transition(__compartment);
                return;
            }
        }

        fn _s_Alive_hdl_user_is_alive(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsAlive(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Alive_hdl_user_is_visible(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsVisible(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Alive_hdl_user_tick(&mut self, __e: &ShipFrameEvent, dt: f32) {
                            if { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Alive" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Alive(ctx) => ctx.cooldown, _ => unreachable!() } } > 0.0 {
                                
            {
                let __rhs = { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Alive" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Alive(ctx) => ctx.cooldown, _ => unreachable!() } } - dt;
                let mut __cursor: Option<&mut ShipCompartment> = Some(&mut self.__compartment);
                while let Some(__c) = __cursor {
                    if __c.state == "Alive" {
                        if let ShipStateContext::Alive(ref mut ctx) = __c.state_context {
                            ctx.cooldown = __rhs;
                        }
                        break;
                    }
                    __cursor = __c.parent_compartment.as_deref_mut();
                }
            }
                            }
        }

        fn _s_InHyperspace_hdl_frame_exit(&mut self, __e: &ShipFrameEvent) {
            self.host.call_deferred("warp_in", &[]);
        }

        fn _s_InHyperspace_hdl_frame_enter(&mut self, __e: &ShipFrameEvent) {
            self.host.call_deferred("warp_out", &[]);
        }

        fn _s_InHyperspace_hdl_user_can_be_hit(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanBeHit(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InHyperspace_hdl_user_can_fire(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanFire(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InHyperspace_hdl_user_can_hyperspace(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanHyperspace(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InHyperspace_hdl_user_get_lives(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::GetLives(self.lives_remaining);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InHyperspace_hdl_user_is_alive(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsAlive(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InHyperspace_hdl_user_is_visible(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsVisible(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InHyperspace_hdl_user_tick(&mut self, __e: &ShipFrameEvent, dt: f32) {
                            
            {
                let __rhs = { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "InHyperspace" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::InHyperspace(ctx) => ctx.timer, _ => unreachable!() } } + dt;
                let mut __cursor: Option<&mut ShipCompartment> = Some(&mut self.__compartment);
                while let Some(__c) = __cursor {
                    if __c.state == "InHyperspace" {
                        if let ShipStateContext::InHyperspace(ref mut ctx) = __c.state_context {
                            ctx.timer = __rhs;
                        }
                        break;
                    }
                    __cursor = __c.parent_compartment.as_deref_mut();
                }
            }
                            if { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "InHyperspace" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::InHyperspace(ctx) => ctx.timer, _ => unreachable!() } } >= { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "InHyperspace" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::InHyperspace(ctx) => ctx.duration, _ => unreachable!() } } {
                                let mut __compartment = self.__prepareEnter("Alive");
                                self.__transition(__compartment);
                                return;
                            }
        }

        fn _s_Exploding_hdl_frame_enter(&mut self, __e: &ShipFrameEvent) {
            self.host.call_deferred("spawn_explosion", &[]);
        }

        fn _s_Exploding_hdl_user_can_be_hit(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanBeHit(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Exploding_hdl_user_can_fire(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanFire(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Exploding_hdl_user_can_hyperspace(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanHyperspace(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Exploding_hdl_user_get_lives(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::GetLives(self.lives_remaining);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Exploding_hdl_user_is_alive(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsAlive(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Exploding_hdl_user_is_visible(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsVisible(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Exploding_hdl_user_tick(&mut self, __e: &ShipFrameEvent, dt: f32) {
                            
            {
                let __rhs = { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Exploding" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Exploding(ctx) => ctx.timer, _ => unreachable!() } } + dt;
                let mut __cursor: Option<&mut ShipCompartment> = Some(&mut self.__compartment);
                while let Some(__c) = __cursor {
                    if __c.state == "Exploding" {
                        if let ShipStateContext::Exploding(ref mut ctx) = __c.state_context {
                            ctx.timer = __rhs;
                        }
                        break;
                    }
                    __cursor = __c.parent_compartment.as_deref_mut();
                }
            }
                            if { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Exploding" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Exploding(ctx) => ctx.timer, _ => unreachable!() } } >= { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Exploding" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Exploding(ctx) => ctx.duration, _ => unreachable!() } } {
                                self.lives_remaining = self.lives_remaining - 1;
                                if self.lives_remaining <= 0 {
                                    let mut __compartment = self.__prepareEnter("Dead");
                                    self.__transition(__compartment);
                                    return;
                                } else {
                                    let mut __compartment = self.__prepareEnter("Respawning");
                                    self.__transition(__compartment);
                                    return;
                                }
                            }
        }

        fn _s_Respawning_hdl_frame_enter(&mut self, __e: &ShipFrameEvent) {
            self.host.call_deferred("reset_ship", &[]);
        }

        fn _s_Respawning_hdl_user_can_be_hit(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanBeHit(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Respawning_hdl_user_can_fire(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanFire(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Respawning_hdl_user_can_hyperspace(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanHyperspace(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Respawning_hdl_user_get_lives(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::GetLives(self.lives_remaining);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Respawning_hdl_user_is_alive(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsAlive(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Respawning_hdl_user_is_visible(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsVisible(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Respawning_hdl_user_tick(&mut self, __e: &ShipFrameEvent, dt: f32) {
                            
            {
                let __rhs = { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Respawning" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Respawning(ctx) => ctx.timer, _ => unreachable!() } } + dt;
                let mut __cursor: Option<&mut ShipCompartment> = Some(&mut self.__compartment);
                while let Some(__c) = __cursor {
                    if __c.state == "Respawning" {
                        if let ShipStateContext::Respawning(ref mut ctx) = __c.state_context {
                            ctx.timer = __rhs;
                        }
                        break;
                    }
                    __cursor = __c.parent_compartment.as_deref_mut();
                }
            }
                            if { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Respawning" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Respawning(ctx) => ctx.timer, _ => unreachable!() } } >= { let mut __sv_comp = &self.__compartment; while __sv_comp.state != "Respawning" { __sv_comp = __sv_comp.parent_compartment.as_ref().expect("invariant: state-var target found in ancestor chain"); } match &__sv_comp.state_context { ShipStateContext::Respawning(ctx) => ctx.duration, _ => unreachable!() } } {
                                let mut __compartment = self.__prepareEnter("Alive");
                                self.__transition(__compartment);
                                return;
                            }
        }

        fn _s_Dead_hdl_user_can_be_hit(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanBeHit(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Dead_hdl_user_can_fire(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanFire(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Dead_hdl_user_can_hyperspace(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::CanHyperspace(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Dead_hdl_user_get_lives(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::GetLives(0);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Dead_hdl_user_is_alive(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsAlive(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Dead_hdl_user_is_visible(&mut self, __e: &ShipFrameEvent) {
            let __return_val = ShipFrameReturn::IsVisible(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Dead_hdl_user_respawn(&mut self, __e: &ShipFrameEvent) {
            self.lives_remaining = self.starting_lives;
            self.hyperspaces_remaining = self.starting_hyperspaces;
            let mut __compartment = self.__prepareEnter("Respawning");
            self.__transition(__compartment);
            return;
        }

        pub fn get_current_state_name(&mut self) -> String {
             return self.__compartment.state.clone(); 
        }

        pub fn get_hyperspaces_remaining(&mut self) -> i32 {
             return self.hyperspaces_remaining; 
        }
    }
}
pub use _ship_framec::*;

// ------------------------------------------------------------ AsteroidField
#[allow(dead_code)]
#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[allow(unused_variables)]
#[allow(unused_mut)]
#[allow(unused_imports)]
#[allow(clippy::assign_op_pattern)]
#[allow(clippy::clone_on_copy)]
#[allow(clippy::derivable_impls)]
#[allow(clippy::match_single_binding)]
#[allow(clippy::needless_return)]
#[allow(clippy::new_without_default)]
#[allow(clippy::single_match)]
mod _asteroid_field_framec {
    use super::*;
    extern crate alloc;
    use alloc::{vec, format};
    #[derive(Clone, Debug)]
    #[allow(dead_code, non_camel_case_types)]
    enum AsteroidFieldFrameEvent {
        SpawnWave { count: i32, court_size: Vector2 },
        Split { index: i32 },
        Remove { index: i32 },
        Clear {  },
        Advance { dt: f32, court_size: Vector2 },
        Count {  },
        AliveCount {  },
        IsAlive { index: i32 },
        Position { index: i32 },
        Velocity { index: i32 },
        SizeOf { index: i32 },
        RadiusOf { index: i32 },
        FrameEnter {},
        FrameExit {},
    }

    #[derive(Clone)]
    #[allow(dead_code, non_camel_case_types)]
    enum AsteroidFieldFrameReturn {
        AliveCount(i32),
        Count(i32),
        IsAlive(bool),
        Position(Vector2),
        RadiusOf(f32),
        SizeOf(i32),
        Split(bool),
        Velocity(Vector2),
        _Lifecycle(alloc::rc::Rc<dyn core::any::Any>),
    }

    #[allow(dead_code)]
    impl AsteroidFieldFrameEvent {
        fn name(&self) -> &'static str {
            match self {
                AsteroidFieldFrameEvent::SpawnWave { .. } => "spawn_wave",
                AsteroidFieldFrameEvent::Split { .. } => "split",
                AsteroidFieldFrameEvent::Remove { .. } => "remove",
                AsteroidFieldFrameEvent::Clear { .. } => "clear",
                AsteroidFieldFrameEvent::Advance { .. } => "advance",
                AsteroidFieldFrameEvent::Count { .. } => "count",
                AsteroidFieldFrameEvent::AliveCount { .. } => "alive_count",
                AsteroidFieldFrameEvent::IsAlive { .. } => "is_alive",
                AsteroidFieldFrameEvent::Position { .. } => "position",
                AsteroidFieldFrameEvent::Velocity { .. } => "velocity",
                AsteroidFieldFrameEvent::SizeOf { .. } => "size_of",
                AsteroidFieldFrameEvent::RadiusOf { .. } => "radius_of",
                AsteroidFieldFrameEvent::FrameEnter { .. } => "$>",
                AsteroidFieldFrameEvent::FrameExit { .. } => "<$",
            }
        }
    }

    #[derive(Clone, Debug)]
    #[allow(dead_code, non_camel_case_types)]
    enum AsteroidFieldFrameValue {
        Int(i64),
        Float(f64),
        Bool(bool),
        Str(String),
        List(Vec<Self>),
        Dict(alloc::collections::BTreeMap<String, Self>),
    }

    #[allow(dead_code, non_camel_case_types)]
    struct AsteroidFieldFrameContext {
        event: alloc::rc::Rc<AsteroidFieldFrameEvent>,
        _return: Option<AsteroidFieldFrameReturn>,
        _data: alloc::collections::BTreeMap<String, AsteroidFieldFrameValue>,
        _transitioned: bool,
    }

    impl AsteroidFieldFrameContext {
        fn new(event: alloc::rc::Rc<AsteroidFieldFrameEvent>, default_return: Option<AsteroidFieldFrameReturn>) -> Self {
            Self {
                event,
                _return: default_return,
                _data: alloc::collections::BTreeMap::new(),
                _transitioned: false,
            }
        }
    }

    #[allow(dead_code, non_camel_case_types)]
    #[derive(Clone)]
    enum AsteroidFieldStateContext {
        Active,
        __NoContext,
    }

    impl Default for AsteroidFieldStateContext {
        fn default() -> Self {
            AsteroidFieldStateContext::Active
        }
    }

    #[allow(dead_code, non_camel_case_types)]
    #[derive(Clone)]
    struct AsteroidFieldCompartment {
        state: String,
        state_context: AsteroidFieldStateContext,
        forward_event: Option<AsteroidFieldFrameEvent>,
        parent_compartment: Option<Box<AsteroidFieldCompartment>>,
    }

    impl AsteroidFieldCompartment {
        fn new(state: &str) -> Self {
            let state_context = match state {
                "Active" => AsteroidFieldStateContext::Active,
                _ => AsteroidFieldStateContext::__NoContext,
            };
            Self {
                state: state.to_string(),
                state_context,
                forward_event: None,
                parent_compartment: None,
            }
        }
    }

    #[allow(dead_code)]
    pub struct AsteroidField {
        _state_stack: Vec<AsteroidFieldCompartment>,
        __compartment: AsteroidFieldCompartment,
        __next_compartment: Option<AsteroidFieldCompartment>,
        _context_stack: Vec<AsteroidFieldFrameContext>,
        pub asteroids: Vec<Asteroid>,
    }

    #[allow(non_snake_case)]
    impl AsteroidField {
        pub fn new() -> Self {
            Self {
                _state_stack: Vec::new(),
                _context_stack: Vec::new(),
                asteroids: Vec::new(),
                __compartment: AsteroidFieldCompartment::new("Active"),
                __next_compartment: None,
            }
        }

        pub fn __create() -> Self {
            let mut c = Self::new();
            c.__compartment = c.__prepareEnter("Active");
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::FrameEnter {});
            let __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            c._context_stack.push(__ctx);
            c.__kernel(&__e);
            c._context_stack.pop();
            c
        }

        fn __hsm_chain(&mut self, leaf: &str) -> &'static [&'static str] {
            match leaf {
                "Active" => &["Active"],
                _ => &[],
            }
        }

        fn __prepareEnter(&mut self, leaf: &str) -> AsteroidFieldCompartment {
            let chain = self.__hsm_chain(leaf);
            let mut comp: Option<AsteroidFieldCompartment> = None;
            for name in chain.iter() {
                let mut new_comp = AsteroidFieldCompartment::new(name);
                if let Some(parent) = comp.take() {
                    new_comp.parent_compartment = Some(Box::new(parent));
                }
                comp = Some(new_comp);
            }
            comp.expect("chain must contain at least the leaf state")
        }

        fn __kernel(&mut self, __e: &alloc::rc::Rc<AsteroidFieldFrameEvent>) {
            // Route event to current state.
            self.__router(__e);
            // Drain any transitions queued by the handler.
            while self.__next_compartment.is_some() {
                let next_compartment = self.__next_compartment.take().expect("invariant: while-loop guard checked is_some()");
                // Exit the current (leaf) state. RFC-0025.1: exit args live in the
                // source state's typed ctx (written at the transition site), so the
                // synthesized `<$` event carries no payload.
                let exit_event = alloc::rc::Rc::new(AsteroidFieldFrameEvent::FrameExit {});
                self.__router(&exit_event);
                // Switch to the new compartment.
                self.__compartment = next_compartment;
                // Three-branch forward-event handling (RFC-0025 Track B.1: forward
                // event is matched on enum variant; $> recognition is now a
                // structural match, not a string compare).
                match self.__compartment.forward_event.take() {
                    None => {
                        // No forwarded event — synthesize a fresh $>. RFC-0025.1:
                        // enter args live in the destination's typed ctx.
                        let enter_event = alloc::rc::Rc::new(AsteroidFieldFrameEvent::FrameEnter {});
                        self.__router(&enter_event);
                    }
                    Some(fwd) if matches!(fwd, AsteroidFieldFrameEvent::FrameEnter { .. }) => {
                        // Forwarded event IS $> — dispatch directly so the
                        // destination's $> handler receives the caller's payload.
                        let fwd_rc = alloc::rc::Rc::new(fwd);
                        self.__router(&fwd_rc);
                    }
                    Some(fwd) => {
                        // Forwarded event is not $> — initialize the destination
                        // with a fresh $>, then dispatch the forward.
                        let enter_event = alloc::rc::Rc::new(AsteroidFieldFrameEvent::FrameEnter {});
                        self.__router(&enter_event);
                        let fwd_rc = alloc::rc::Rc::new(fwd);
                        self.__router(&fwd_rc);
                    }
                }
                for ctx in self._context_stack.iter_mut() {
                    ctx._transitioned = true;
                }
            }
        }

        fn __router(&mut self, __e: &alloc::rc::Rc<AsteroidFieldFrameEvent>) {
            let __ev: &AsteroidFieldFrameEvent = __e;
            match self.__compartment.state.as_str() {
                "Active" => self._state_Active(__ev),
                _ => {}
            }
        }

        fn __transition(&mut self, next_compartment: AsteroidFieldCompartment) {
            self.__next_compartment = Some(next_compartment);
        }

        pub fn spawn_wave(&mut self, count: i32, court_size: Vector2) {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::SpawnWave { count: count.clone(), court_size: court_size.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn split(&mut self, index: i32) -> bool {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Split { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::Split(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn remove(&mut self, index: i32) {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Remove { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn clear(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Clear {});
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn advance(&mut self, dt: f32, court_size: Vector2) {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Advance { dt: dt.clone(), court_size: court_size.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn count(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Count {});
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::Count(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn alive_count(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::AliveCount {});
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::AliveCount(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn is_alive(&mut self, index: i32) -> bool {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::IsAlive { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::IsAlive(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn position(&mut self, index: i32) -> Vector2 {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Position { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::Position(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<Vector2>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn velocity(&mut self, index: i32) -> Vector2 {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::Velocity { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::Velocity(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<Vector2>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn size_of(&mut self, index: i32) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::SizeOf { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::SizeOf(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn radius_of(&mut self, index: i32) -> f32 {
            let __e = alloc::rc::Rc::new(AsteroidFieldFrameEvent::RadiusOf { index: index.clone() });
            let mut __ctx = AsteroidFieldFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidFieldFrameReturn::RadiusOf(v)) => v,
                Some(AsteroidFieldFrameReturn::_Lifecycle(v)) => v.downcast_ref::<f32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        fn _state_Active(&mut self, __e: &AsteroidFieldFrameEvent) {
            match __e {
                AsteroidFieldFrameEvent::Advance { dt, court_size, .. } => {
                    self._s_Active_hdl_user_advance(__e, *dt, *court_size);
                }
                AsteroidFieldFrameEvent::AliveCount { .. } => { self._s_Active_hdl_user_alive_count(__e); }
                AsteroidFieldFrameEvent::Clear { .. } => { self._s_Active_hdl_user_clear(__e); }
                AsteroidFieldFrameEvent::Count { .. } => { self._s_Active_hdl_user_count(__e); }
                AsteroidFieldFrameEvent::IsAlive { index, .. } => {
                    self._s_Active_hdl_user_is_alive(__e, *index);
                }
                AsteroidFieldFrameEvent::Position { index, .. } => {
                    self._s_Active_hdl_user_position(__e, *index);
                }
                AsteroidFieldFrameEvent::RadiusOf { index, .. } => {
                    self._s_Active_hdl_user_radius_of(__e, *index);
                }
                AsteroidFieldFrameEvent::Remove { index, .. } => {
                    self._s_Active_hdl_user_remove(__e, *index);
                }
                AsteroidFieldFrameEvent::SizeOf { index, .. } => {
                    self._s_Active_hdl_user_size_of(__e, *index);
                }
                AsteroidFieldFrameEvent::SpawnWave { count, court_size, .. } => {
                    self._s_Active_hdl_user_spawn_wave(__e, *count, *court_size);
                }
                AsteroidFieldFrameEvent::Split { index, .. } => {
                    self._s_Active_hdl_user_split(__e, *index);
                }
                AsteroidFieldFrameEvent::Velocity { index, .. } => {
                    self._s_Active_hdl_user_velocity(__e, *index);
                }
                _ => {}
            }
        }

        fn _s_Active_hdl_user_advance(&mut self, __e: &AsteroidFieldFrameEvent, dt: f32, court_size: Vector2) {
            let mut i: usize = 0;
            while i < self.asteroids.len() {
                if self.asteroids[i].alive {
                    let mut a = self.asteroids[i];
                    a.pos = a.pos + a.vel * dt;
                    if a.pos.x < 0.0 { a.pos.x = a.pos.x + court_size.x; }
                    if a.pos.x > court_size.x { a.pos.x = a.pos.x - court_size.x; }
                    if a.pos.y < 0.0 { a.pos.y = a.pos.y + court_size.y; }
                    if a.pos.y > court_size.y { a.pos.y = a.pos.y - court_size.y; }
                    self.asteroids[i] = a;
                }
                i = i + 1;
            }
        }

        fn _s_Active_hdl_user_alive_count(&mut self, __e: &AsteroidFieldFrameEvent) {
                            let mut c: i32 = 0;
                            let mut i: usize = 0;
                            while i < self.asteroids.len() {
                                if self.asteroids[i].alive { c = c + 1; }
                                i = i + 1;
                            }
            let __return_val = AsteroidFieldFrameReturn::AliveCount(c);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_clear(&mut self, __e: &AsteroidFieldFrameEvent) {
            self.asteroids.clear();
        }

        fn _s_Active_hdl_user_count(&mut self, __e: &AsteroidFieldFrameEvent) {
            let __return_val = AsteroidFieldFrameReturn::Count(self.asteroids.len() as i32);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_is_alive(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
                            if index < 0 || index as usize >= self.asteroids.len() {
            let __return_val = AsteroidFieldFrameReturn::IsAlive(false);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
            let __return_val = AsteroidFieldFrameReturn::IsAlive(self.asteroids[index as usize].alive);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_position(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
                            if index < 0 || index as usize >= self.asteroids.len() {
            let __return_val = AsteroidFieldFrameReturn::Position(Vector2::ZERO);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
            let __return_val = AsteroidFieldFrameReturn::Position(self.asteroids[index as usize].pos);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_radius_of(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
                            if index < 0 || index as usize >= self.asteroids.len() {
            let __return_val = AsteroidFieldFrameReturn::RadiusOf(0.0);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
                            let sz: i32 = self.asteroids[index as usize].size;
                            if sz == 3 { 
            let __return_val = AsteroidFieldFrameReturn::RadiusOf(32.0);
                                         if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                         return; }
                            if sz == 2 { 
            let __return_val = AsteroidFieldFrameReturn::RadiusOf(18.0);
                                         if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                         return; }
            let __return_val = AsteroidFieldFrameReturn::RadiusOf(10.0);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_remove(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
            if index < 0 || index as usize >= self.asteroids.len() {
                return;
            }
            self.asteroids[index as usize].alive = false;
        }

        fn _s_Active_hdl_user_size_of(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
                            if index < 0 || index as usize >= self.asteroids.len() {
            let __return_val = AsteroidFieldFrameReturn::SizeOf(0);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
            let __return_val = AsteroidFieldFrameReturn::SizeOf(self.asteroids[index as usize].size);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_spawn_wave(&mut self, __e: &AsteroidFieldFrameEvent, count: i32, court_size: Vector2) {
            self.asteroids.clear();
            let mut i: i32 = 0;
            while i < count {
                self.spawn_large(court_size);
                i = i + 1;
            }
        }

        fn _s_Active_hdl_user_split(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
                            if index < 0 || index as usize >= self.asteroids.len() {
            let __return_val = AsteroidFieldFrameReturn::Split(false);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
                            if !self.asteroids[index as usize].alive {
            let __return_val = AsteroidFieldFrameReturn::Split(false);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
                            self.asteroids[index as usize].alive = false;
                            let sz: i32 = self.asteroids[index as usize].size;
                            let p: Vector2 = self.asteroids[index as usize].pos;
                            if sz > 1 {
                                self.spawn_child(p, sz - 1);
                                self.spawn_child(p, sz - 1);
                            }
            let __return_val = AsteroidFieldFrameReturn::Split(true);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Active_hdl_user_velocity(&mut self, __e: &AsteroidFieldFrameEvent, index: i32) {
                            if index < 0 || index as usize >= self.asteroids.len() {
            let __return_val = AsteroidFieldFrameReturn::Velocity(Vector2::ZERO);
                                if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
                                return;
                            }
            let __return_val = AsteroidFieldFrameReturn::Velocity(self.asteroids[index as usize].vel);
                            if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn spawn_large(&mut self, court_size: Vector2) {
                        let edge: i32 = (godot::global::randi() % 4) as i32;
                        let mut pos: Vector2 = Vector2::ZERO;
                        if edge == 0 {
                            pos = Vector2::new(0.0, rf() * court_size.y);
                        } else if edge == 1 {
                            pos = Vector2::new(court_size.x, rf() * court_size.y);
                        } else if edge == 2 {
                            pos = Vector2::new(rf() * court_size.x, 0.0);
                        } else {
                            pos = Vector2::new(rf() * court_size.x, court_size.y);
                        }
                        let angle: f32 = rf() * std::f32::consts::TAU;
                        let speed: f32 = 40.0 + rf() * 30.0;
                        let vel: Vector2 = Vector2::from_angle(angle) * speed;
                        self.asteroids.push(Asteroid { pos: pos, vel: vel, size: 3, alive: true });
        }

        fn spawn_child(&mut self, pos: Vector2, size: i32) {
                        let angle: f32 = rf() * std::f32::consts::TAU;
                        let speed: f32 = 60.0 + rf() * 40.0 + ((3 - size) as f32) * 20.0;
                        let vel: Vector2 = Vector2::from_angle(angle) * speed;
                        self.asteroids.push(Asteroid { pos: pos, vel: vel, size: size, alive: true });
        }
    }
}
pub use _asteroid_field_framec::*;

// ------------------------------------------------------------ AsteroidsGame
#[allow(dead_code)]
#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[allow(unused_variables)]
#[allow(unused_mut)]
#[allow(unused_imports)]
#[allow(clippy::assign_op_pattern)]
#[allow(clippy::clone_on_copy)]
#[allow(clippy::derivable_impls)]
#[allow(clippy::match_single_binding)]
#[allow(clippy::needless_return)]
#[allow(clippy::new_without_default)]
#[allow(clippy::single_match)]
mod _asteroids_game_framec {
    use super::*;
    extern crate alloc;
    use alloc::{vec, format};
    #[derive(Clone, Debug)]
    #[allow(dead_code, non_camel_case_types)]
    enum AsteroidsGameFrameEvent {
        Start {  },
        Restart {  },
        Pause {  },
        Resume {  },
        Tick { dt: f32, court_size: Vector2 },
        ShipHitAsteroid { index: i32 },
        BulletHitAsteroid { index: i32 },
        ShipHyperspace {  },
        BulletFired {  },
        BulletExpired {  },
        GetScore {  },
        GetLives {  },
        GetWave {  },
        GetDifficulty {  },
        IsPaused {  },
        FrameEnter {},
        FrameExit {},
    }

    #[derive(Clone)]
    #[allow(dead_code, non_camel_case_types)]
    enum AsteroidsGameFrameReturn {
        GetDifficulty(i32),
        GetLives(i32),
        GetScore(i32),
        GetWave(i32),
        IsPaused(bool),
        _Lifecycle(alloc::rc::Rc<dyn core::any::Any>),
    }

    #[allow(dead_code)]
    impl AsteroidsGameFrameEvent {
        fn name(&self) -> &'static str {
            match self {
                AsteroidsGameFrameEvent::Start { .. } => "start",
                AsteroidsGameFrameEvent::Restart { .. } => "restart",
                AsteroidsGameFrameEvent::Pause { .. } => "pause",
                AsteroidsGameFrameEvent::Resume { .. } => "resume",
                AsteroidsGameFrameEvent::Tick { .. } => "tick",
                AsteroidsGameFrameEvent::ShipHitAsteroid { .. } => "ship_hit_asteroid",
                AsteroidsGameFrameEvent::BulletHitAsteroid { .. } => "bullet_hit_asteroid",
                AsteroidsGameFrameEvent::ShipHyperspace { .. } => "ship_hyperspace",
                AsteroidsGameFrameEvent::BulletFired { .. } => "bullet_fired",
                AsteroidsGameFrameEvent::BulletExpired { .. } => "bullet_expired",
                AsteroidsGameFrameEvent::GetScore { .. } => "get_score",
                AsteroidsGameFrameEvent::GetLives { .. } => "get_lives",
                AsteroidsGameFrameEvent::GetWave { .. } => "get_wave",
                AsteroidsGameFrameEvent::GetDifficulty { .. } => "get_difficulty",
                AsteroidsGameFrameEvent::IsPaused { .. } => "is_paused",
                AsteroidsGameFrameEvent::FrameEnter { .. } => "$>",
                AsteroidsGameFrameEvent::FrameExit { .. } => "<$",
            }
        }
    }

    #[derive(Clone, Debug)]
    #[allow(dead_code, non_camel_case_types)]
    enum AsteroidsGameFrameValue {
        Int(i64),
        Float(f64),
        Bool(bool),
        Str(String),
        List(Vec<Self>),
        Dict(alloc::collections::BTreeMap<String, Self>),
    }

    #[allow(dead_code, non_camel_case_types)]
    struct AsteroidsGameFrameContext {
        event: alloc::rc::Rc<AsteroidsGameFrameEvent>,
        _return: Option<AsteroidsGameFrameReturn>,
        _data: alloc::collections::BTreeMap<String, AsteroidsGameFrameValue>,
        _transitioned: bool,
    }

    impl AsteroidsGameFrameContext {
        fn new(event: alloc::rc::Rc<AsteroidsGameFrameEvent>, default_return: Option<AsteroidsGameFrameReturn>) -> Self {
            Self {
                event,
                _return: default_return,
                _data: alloc::collections::BTreeMap::new(),
                _transitioned: false,
            }
        }
    }

    #[allow(dead_code, non_camel_case_types)]
    #[derive(Clone)]
    enum AsteroidsGameStateContext {
        Attract,
        InGame,
        Playing,
        ShipDying,
        WaveClear,
        Paused,
        GameOver,
        __NoContext,
    }

    impl Default for AsteroidsGameStateContext {
        fn default() -> Self {
            AsteroidsGameStateContext::Attract
        }
    }

    #[allow(dead_code, non_camel_case_types)]
    #[derive(Clone)]
    struct AsteroidsGameCompartment {
        state: String,
        state_context: AsteroidsGameStateContext,
        forward_event: Option<AsteroidsGameFrameEvent>,
        parent_compartment: Option<Box<AsteroidsGameCompartment>>,
    }

    impl AsteroidsGameCompartment {
        fn new(state: &str) -> Self {
            let state_context = match state {
                "Attract" => AsteroidsGameStateContext::Attract,
                "InGame" => AsteroidsGameStateContext::InGame,
                "Playing" => AsteroidsGameStateContext::Playing,
                "ShipDying" => AsteroidsGameStateContext::ShipDying,
                "WaveClear" => AsteroidsGameStateContext::WaveClear,
                "Paused" => AsteroidsGameStateContext::Paused,
                "GameOver" => AsteroidsGameStateContext::GameOver,
                _ => AsteroidsGameStateContext::__NoContext,
            };
            Self {
                state: state.to_string(),
                state_context,
                forward_event: None,
                parent_compartment: None,
            }
        }
    }

    #[allow(dead_code)]
    pub struct AsteroidsGame {
        _state_stack: Vec<AsteroidsGameCompartment>,
        __compartment: AsteroidsGameCompartment,
        __next_compartment: Option<AsteroidsGameCompartment>,
        _context_stack: Vec<AsteroidsGameFrameContext>,
        pub difficulty: i32,
        pub score: i32,
        pub wave: i32,
        pub wave_timer: f32,
        pub wave_pause: f32,
        pub bullets_in_flight: i32,
        pub max_bullets: i32,
        pub last_court_size: Vector2,
        pub ship: Ship,
        pub field: AsteroidField,
    }

    #[allow(non_snake_case)]
    impl AsteroidsGame {
        pub fn __create(difficulty: i32, ship_host: Gd<Node>) -> Self {
            let mut c = Self {
                _state_stack: Vec::new(),
                _context_stack: Vec::new(),
                score: 0,
                wave: 1,
                wave_timer: 0.0,
                wave_pause: 2.0,
                bullets_in_flight: 0,
                max_bullets: 4,
                last_court_size: Vector2::new(640.0, 480.0),
                field: AsteroidField::__create(),
                __compartment: AsteroidsGameCompartment::new("Attract"),
                __next_compartment: None,
                difficulty: difficulty,
                ship: Ship::__create(ship_host),
            };
            c.__compartment = c.__prepareEnter("Attract");
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::FrameEnter {});
            let __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            c._context_stack.push(__ctx);
            c.__kernel(&__e);
            c._context_stack.pop();
            c
        }

        fn __hsm_chain(&mut self, leaf: &str) -> &'static [&'static str] {
            match leaf {
                "Attract" => &["Attract"],
                "InGame" => &["InGame"],
                "Playing" => &["InGame", "Playing"],
                "ShipDying" => &["InGame", "ShipDying"],
                "WaveClear" => &["InGame", "WaveClear"],
                "Paused" => &["Paused"],
                "GameOver" => &["GameOver"],
                _ => &[],
            }
        }

        fn __prepareEnter(&mut self, leaf: &str) -> AsteroidsGameCompartment {
            let chain = self.__hsm_chain(leaf);
            let mut comp: Option<AsteroidsGameCompartment> = None;
            for name in chain.iter() {
                let mut new_comp = AsteroidsGameCompartment::new(name);
                if let Some(parent) = comp.take() {
                    new_comp.parent_compartment = Some(Box::new(parent));
                }
                comp = Some(new_comp);
            }
            comp.expect("chain must contain at least the leaf state")
        }

        fn __kernel(&mut self, __e: &alloc::rc::Rc<AsteroidsGameFrameEvent>) {
            // Route event to current state.
            self.__router(__e);
            // Drain any transitions queued by the handler.
            while self.__next_compartment.is_some() {
                let next_compartment = self.__next_compartment.take().expect("invariant: while-loop guard checked is_some()");
                // Exit the current (leaf) state. RFC-0025.1: exit args live in the
                // source state's typed ctx (written at the transition site), so the
                // synthesized `<$` event carries no payload.
                let exit_event = alloc::rc::Rc::new(AsteroidsGameFrameEvent::FrameExit {});
                self.__router(&exit_event);
                // Switch to the new compartment.
                self.__compartment = next_compartment;
                // Three-branch forward-event handling (RFC-0025 Track B.1: forward
                // event is matched on enum variant; $> recognition is now a
                // structural match, not a string compare).
                match self.__compartment.forward_event.take() {
                    None => {
                        // No forwarded event — synthesize a fresh $>. RFC-0025.1:
                        // enter args live in the destination's typed ctx.
                        let enter_event = alloc::rc::Rc::new(AsteroidsGameFrameEvent::FrameEnter {});
                        self.__router(&enter_event);
                    }
                    Some(fwd) if matches!(fwd, AsteroidsGameFrameEvent::FrameEnter { .. }) => {
                        // Forwarded event IS $> — dispatch directly so the
                        // destination's $> handler receives the caller's payload.
                        let fwd_rc = alloc::rc::Rc::new(fwd);
                        self.__router(&fwd_rc);
                    }
                    Some(fwd) => {
                        // Forwarded event is not $> — initialize the destination
                        // with a fresh $>, then dispatch the forward.
                        let enter_event = alloc::rc::Rc::new(AsteroidsGameFrameEvent::FrameEnter {});
                        self.__router(&enter_event);
                        let fwd_rc = alloc::rc::Rc::new(fwd);
                        self.__router(&fwd_rc);
                    }
                }
                for ctx in self._context_stack.iter_mut() {
                    ctx._transitioned = true;
                }
            }
        }

        fn __router(&mut self, __e: &alloc::rc::Rc<AsteroidsGameFrameEvent>) {
            let __ev: &AsteroidsGameFrameEvent = __e;
            match self.__compartment.state.as_str() {
                "Attract" => self._state_Attract(__ev),
                "InGame" => self._state_InGame(__ev),
                "Playing" => self._state_Playing(__ev),
                "ShipDying" => self._state_ShipDying(__ev),
                "WaveClear" => self._state_WaveClear(__ev),
                "Paused" => self._state_Paused(__ev),
                "GameOver" => self._state_GameOver(__ev),
                _ => {}
            }
        }

        fn __transition(&mut self, next_compartment: AsteroidsGameCompartment) {
            self.__next_compartment = Some(next_compartment);
        }

        pub fn start(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::Start {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn restart(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::Restart {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn pause(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::Pause {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn resume(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::Resume {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn tick(&mut self, dt: f32, court_size: Vector2) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::Tick { dt: dt.clone(), court_size: court_size.clone() });
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn ship_hit_asteroid(&mut self, index: i32) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::ShipHitAsteroid { index: index.clone() });
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn bullet_hit_asteroid(&mut self, index: i32) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::BulletHitAsteroid { index: index.clone() });
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn ship_hyperspace(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::ShipHyperspace {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn bullet_fired(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::BulletFired {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn bullet_expired(&mut self) {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::BulletExpired {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            self._context_stack.pop();
        }

        pub fn get_score(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::GetScore {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidsGameFrameReturn::GetScore(v)) => v,
                Some(AsteroidsGameFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn get_lives(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::GetLives {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidsGameFrameReturn::GetLives(v)) => v,
                Some(AsteroidsGameFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn get_wave(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::GetWave {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidsGameFrameReturn::GetWave(v)) => v,
                Some(AsteroidsGameFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn get_difficulty(&mut self) -> i32 {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::GetDifficulty {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidsGameFrameReturn::GetDifficulty(v)) => v,
                Some(AsteroidsGameFrameReturn::_Lifecycle(v)) => v.downcast_ref::<i32>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        pub fn is_paused(&mut self) -> bool {
            let __e = alloc::rc::Rc::new(AsteroidsGameFrameEvent::IsPaused {});
            let mut __ctx = AsteroidsGameFrameContext::new(alloc::rc::Rc::clone(&__e), None);
            self._context_stack.push(__ctx);
            self.__kernel(&__e);
            let __ctx = self._context_stack.pop().expect("invariant: handler must have pushed a context before reading return");
            match __ctx._return {
                Some(AsteroidsGameFrameReturn::IsPaused(v)) => v,
                Some(AsteroidsGameFrameReturn::_Lifecycle(v)) => v.downcast_ref::<bool>().cloned().unwrap_or_default(),
                _ => Default::default(),
            }
        }

        fn _state_Attract(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::FrameEnter { .. } => { self._s_Attract_hdl_frame_enter(__e); }
                AsteroidsGameFrameEvent::GetDifficulty { .. } => { self._s_Attract_hdl_user_get_difficulty(__e); }
                AsteroidsGameFrameEvent::GetLives { .. } => { self._s_Attract_hdl_user_get_lives(__e); }
                AsteroidsGameFrameEvent::GetScore { .. } => { self._s_Attract_hdl_user_get_score(__e); }
                AsteroidsGameFrameEvent::GetWave { .. } => { self._s_Attract_hdl_user_get_wave(__e); }
                AsteroidsGameFrameEvent::IsPaused { .. } => { self._s_Attract_hdl_user_is_paused(__e); }
                AsteroidsGameFrameEvent::Start { .. } => { self._s_Attract_hdl_user_start(__e); }
                _ => {}
            }
        }

        fn _state_InGame(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::BulletExpired { .. } => { self._s_InGame_hdl_user_bullet_expired(__e); }
                AsteroidsGameFrameEvent::BulletFired { .. } => { self._s_InGame_hdl_user_bullet_fired(__e); }
                AsteroidsGameFrameEvent::GetDifficulty { .. } => { self._s_InGame_hdl_user_get_difficulty(__e); }
                AsteroidsGameFrameEvent::GetLives { .. } => { self._s_InGame_hdl_user_get_lives(__e); }
                AsteroidsGameFrameEvent::GetScore { .. } => { self._s_InGame_hdl_user_get_score(__e); }
                AsteroidsGameFrameEvent::GetWave { .. } => { self._s_InGame_hdl_user_get_wave(__e); }
                AsteroidsGameFrameEvent::IsPaused { .. } => { self._s_InGame_hdl_user_is_paused(__e); }
                AsteroidsGameFrameEvent::Pause { .. } => { self._s_InGame_hdl_user_pause(__e); }
                _ => {}
            }
        }

        fn _state_Playing(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::BulletHitAsteroid { index, .. } => {
                    self._s_Playing_hdl_user_bullet_hit_asteroid(__e, *index);
                }
                AsteroidsGameFrameEvent::ShipHitAsteroid { index, .. } => {
                    self._s_Playing_hdl_user_ship_hit_asteroid(__e, *index);
                }
                AsteroidsGameFrameEvent::ShipHyperspace { .. } => { self._s_Playing_hdl_user_ship_hyperspace(__e); }
                AsteroidsGameFrameEvent::Tick { dt, court_size, .. } => {
                    self._s_Playing_hdl_user_tick(__e, *dt, *court_size);
                }
                _ => self._state_InGame(__e),
            }
        }

        fn _state_ShipDying(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::Tick { dt, court_size, .. } => {
                    self._s_ShipDying_hdl_user_tick(__e, *dt, *court_size);
                }
                _ => self._state_InGame(__e),
            }
        }

        fn _state_WaveClear(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::FrameEnter { .. } => { self._s_WaveClear_hdl_frame_enter(__e); }
                AsteroidsGameFrameEvent::Tick { dt, court_size, .. } => {
                    self._s_WaveClear_hdl_user_tick(__e, *dt, *court_size);
                }
                _ => self._state_InGame(__e),
            }
        }

        fn _state_Paused(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::GetDifficulty { .. } => { self._s_Paused_hdl_user_get_difficulty(__e); }
                AsteroidsGameFrameEvent::GetLives { .. } => { self._s_Paused_hdl_user_get_lives(__e); }
                AsteroidsGameFrameEvent::GetScore { .. } => { self._s_Paused_hdl_user_get_score(__e); }
                AsteroidsGameFrameEvent::GetWave { .. } => { self._s_Paused_hdl_user_get_wave(__e); }
                AsteroidsGameFrameEvent::IsPaused { .. } => { self._s_Paused_hdl_user_is_paused(__e); }
                AsteroidsGameFrameEvent::Resume { .. } => { self._s_Paused_hdl_user_resume(__e); }
                _ => {}
            }
        }

        fn _state_GameOver(&mut self, __e: &AsteroidsGameFrameEvent) {
            match __e {
                AsteroidsGameFrameEvent::GetDifficulty { .. } => { self._s_GameOver_hdl_user_get_difficulty(__e); }
                AsteroidsGameFrameEvent::GetLives { .. } => { self._s_GameOver_hdl_user_get_lives(__e); }
                AsteroidsGameFrameEvent::GetScore { .. } => { self._s_GameOver_hdl_user_get_score(__e); }
                AsteroidsGameFrameEvent::GetWave { .. } => { self._s_GameOver_hdl_user_get_wave(__e); }
                AsteroidsGameFrameEvent::IsPaused { .. } => { self._s_GameOver_hdl_user_is_paused(__e); }
                AsteroidsGameFrameEvent::Restart { .. } => { self._s_GameOver_hdl_user_restart(__e); }
                _ => {}
            }
        }

        fn _s_Attract_hdl_frame_enter(&mut self, __e: &AsteroidsGameFrameEvent) {
            self.score = 0;
            self.wave = 1;
            self.bullets_in_flight = 0;
        }

        fn _s_Attract_hdl_user_get_difficulty(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetDifficulty(self.difficulty);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Attract_hdl_user_get_lives(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetLives(self.ship.get_lives());
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Attract_hdl_user_get_score(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetScore(self.score);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Attract_hdl_user_get_wave(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetWave(self.wave);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Attract_hdl_user_is_paused(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::IsPaused(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Attract_hdl_user_start(&mut self, __e: &AsteroidsGameFrameEvent) {
            self.ship.respawn();
            let n: i32 = self.asteroids_for_wave(1);
            self.field.spawn_wave(n, self.last_court_size);
            let mut __compartment = self.__prepareEnter("Playing");
            self.__transition(__compartment);
            return;
        }

        fn _s_InGame_hdl_user_bullet_expired(&mut self, __e: &AsteroidsGameFrameEvent) {
            if self.bullets_in_flight > 0 {
                self.bullets_in_flight = self.bullets_in_flight - 1;
            }
        }

        fn _s_InGame_hdl_user_bullet_fired(&mut self, __e: &AsteroidsGameFrameEvent) {
            self.bullets_in_flight = self.bullets_in_flight + 1;
        }

        fn _s_InGame_hdl_user_get_difficulty(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetDifficulty(self.difficulty);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InGame_hdl_user_get_lives(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetLives(self.ship.get_lives());
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InGame_hdl_user_get_score(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetScore(self.score);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InGame_hdl_user_get_wave(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetWave(self.wave);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InGame_hdl_user_is_paused(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::IsPaused(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_InGame_hdl_user_pause(&mut self, __e: &AsteroidsGameFrameEvent) {
            self._state_stack.push(self.__compartment.clone());
            let __compartment = self.__prepareEnter("Paused");
            self.__transition(__compartment);
            return;
        }

        fn _s_Playing_hdl_user_bullet_hit_asteroid(&mut self, __e: &AsteroidsGameFrameEvent, index: i32) {
            if self.field.split(index) {
                let sz: i32 = self.size_points(index);
                self.score = self.score + sz * self.difficulty;
                if self.field.alive_count() <= 0 {
                    let mut __compartment = self.__prepareEnter("WaveClear");
                    self.__transition(__compartment);
                    return;
                }
            }
        }

        fn _s_Playing_hdl_user_ship_hit_asteroid(&mut self, __e: &AsteroidsGameFrameEvent, index: i32) {
            if !self.ship.can_be_hit() {
                return;
            }
            self.ship.hit();
            let mut __compartment = self.__prepareEnter("ShipDying");
            self.__transition(__compartment);
            return;
        }

        fn _s_Playing_hdl_user_ship_hyperspace(&mut self, __e: &AsteroidsGameFrameEvent) {
            self.ship.hyperspace();
        }

        fn _s_Playing_hdl_user_tick(&mut self, __e: &AsteroidsGameFrameEvent, dt: f32, court_size: Vector2) {
            self.last_court_size = court_size;
            self.ship.tick(dt);
            self.field.advance(dt, court_size);
        }

        fn _s_ShipDying_hdl_user_tick(&mut self, __e: &AsteroidsGameFrameEvent, dt: f32, court_size: Vector2) {
            self.last_court_size = court_size;
            self.ship.tick(dt);
            self.field.advance(dt, court_size);
            if self.ship.get_current_state_name() == "Respawning" {
                let mut __compartment = self.__prepareEnter("Playing");
                self.__transition(__compartment);
                return;
            } else if self.ship.get_current_state_name() == "Dead" {
                let mut __compartment = self.__prepareEnter("GameOver");
                self.__transition(__compartment);
                return;
            }
        }

        fn _s_WaveClear_hdl_frame_enter(&mut self, __e: &AsteroidsGameFrameEvent) {
            self.wave_timer = 0.0;
        }

        fn _s_WaveClear_hdl_user_tick(&mut self, __e: &AsteroidsGameFrameEvent, dt: f32, court_size: Vector2) {
            self.last_court_size = court_size;
            self.ship.tick(dt);
            self.wave_timer = self.wave_timer + dt;
            if self.wave_timer >= self.wave_pause {
                self.wave = self.wave + 1;
                let n: i32 = self.asteroids_for_wave(self.wave);
                self.field.spawn_wave(n, court_size);
                let mut __compartment = self.__prepareEnter("Playing");
                self.__transition(__compartment);
                return;
            }
        }

        fn _s_Paused_hdl_user_get_difficulty(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetDifficulty(self.difficulty);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Paused_hdl_user_get_lives(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetLives(self.ship.get_lives());
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Paused_hdl_user_get_score(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetScore(self.score);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Paused_hdl_user_get_wave(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetWave(self.wave);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Paused_hdl_user_is_paused(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::IsPaused(true);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_Paused_hdl_user_resume(&mut self, __e: &AsteroidsGameFrameEvent) {
            let mut __popped = self._state_stack.pop().expect("invariant: pop$ must follow push$");
            self.__transition(__popped);
            return;
        }

        fn _s_GameOver_hdl_user_get_difficulty(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetDifficulty(self.difficulty);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_GameOver_hdl_user_get_lives(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetLives(self.ship.get_lives());
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_GameOver_hdl_user_get_score(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetScore(self.score);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_GameOver_hdl_user_get_wave(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::GetWave(self.wave);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_GameOver_hdl_user_is_paused(&mut self, __e: &AsteroidsGameFrameEvent) {
            let __return_val = AsteroidsGameFrameReturn::IsPaused(false);
             if let Some(ctx) = self._context_stack.last_mut() { ctx._return = Some(__return_val); }
        }

        fn _s_GameOver_hdl_user_restart(&mut self, __e: &AsteroidsGameFrameEvent) {
            let mut __compartment = self.__prepareEnter("Attract");
            self.__transition(__compartment);
            return;
        }

        fn asteroids_for_wave(&mut self, wave: i32) -> i32 {
                        let base: i32 = 2 + self.difficulty;
                        return base + wave - 1;
        }

        fn size_points(&mut self, index: i32) -> i32 {
                        let sz: i32 = self.field.size_of(index);
                        if sz == 3 { return 20; }
                        if sz == 2 { return 50; }
                        return 100;
        }

        pub fn get_current_state_name(&mut self) -> String {
             return self.__compartment.state.clone(); 
        }

        pub fn get_bullets_in_flight(&mut self) -> i32 {
             return self.bullets_in_flight; 
        }

        pub fn get_max_bullets(&mut self) -> i32 {
             return self.max_bullets; 
        }
    }
}
pub use _asteroids_game_framec::*;
