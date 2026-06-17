use godot::prelude::*;
use godot::classes::{Control, IControl, Label};

struct SpikeExtension;

#[gdextension]
unsafe impl ExtensionLibrary for SpikeExtension {}

/// Minimal proof-of-life node. If this text appears on the browser canvas,
/// a native Rust GDExtension compiled to WASM ran inside Godot's web build.
#[derive(GodotClass)]
#[class(base = Control, init)]
struct SpikeProbe {
    base: Base<Control>,
}

#[godot_api]
impl IControl for SpikeProbe {
    fn ready(&mut self) {
        godot_print!("[spike] Rust GDExtension alive inside Godot web build");

        let mut label = Label::new_alloc();
        label.set_text("RUST GDEXTENSION ALIVE ✓");
        label.set_position(Vector2::new(180.0, 280.0));
        self.base_mut().add_child(&label);
    }
}

#[allow(dead_code, unused)]
pub mod asteroids;

pub mod gameplay;
