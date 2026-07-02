import { init } from './pkg/index.js';
try {
  await init();
  const s = document.getElementById('status');
  if (s) s.style.display = 'none';
} catch (e) {
  console.log('SWIFT_BOOT_ERR ' + e);
  const s = document.getElementById('status');
  if (s) s.textContent = 'error: ' + e;
}
