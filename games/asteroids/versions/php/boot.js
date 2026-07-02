import { PhpWeb } from './php-wasm/PhpWeb.mjs';
(async () => {
  const status = document.getElementById('status');
  try {
    const php = new PhpWeb();
    php.addEventListener('output', e => { const d = e.detail ?? ''; if (String(d).trim()) console.log('PHP ' + d); });
    await php.binary;
    const fsm  = await (await fetch('./asteroids.php')).text();
    const host = await (await fetch('./main.php')).text();
    const combined = fsm + "\n" + host.replace(/^\s*<\?php/, '');
    if (status) status.style.display = 'none';
    console.log("PHP_RUN_START");
    await php.run(combined);
  } catch (e) { console.log('PHP_ERR ' + e + ' | ' + (e && e.stack)); if (status) status.textContent = 'error: ' + e; }
})();
