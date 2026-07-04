import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser";
import asteroidsRb from "./asteroids.rb";
import mainRb from "./main.rb";

(async () => {
  const status = document.getElementById("status");
  try {
    const resp = await fetch("./ruby.wasm");
    const mod = await WebAssembly.compileStreaming(resp);
    const { vm } = await DefaultRubyVM(mod);
    vm.eval(`require "js"`);
    vm.eval(asteroidsRb);
    vm.eval(mainRb);
    if (status) status.style.display = "none";
  } catch (e) {
    console.log("RUBY_BOOT_ERR " + e);
    if (status) status.textContent = "error: " + e;
  }
})();
