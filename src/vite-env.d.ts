/// <reference types="vite/client" />

// The generated Frame state machines (vendor/.../*.machine.js) ship without
// types; they're imported only for their runtime factory + interface duck-typing.
declare module "*.machine.js";
