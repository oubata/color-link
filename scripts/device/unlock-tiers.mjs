/**
 * Unlock every tier on the connected phone, for testing.
 *
 *   npm run unlock:device             # back up, then seed the gate tiers
 *   npm run unlock:device -- --restore # put the backed-up progress back
 *
 * Talks to the running app's WebView over adb, so nothing in the repo changes
 * and no rebuild is needed. Undone by --restore, or by Settings -> Reset
 * progress on the phone.
 *
 * Needs the app open on a connected device with the port forwarded:
 *
 *   PID=$(adb shell pidof com.oubata.colorlink)
 *   adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
 *
 * The backup it writes is the phone's own progress. It stays out of git: it is
 * device state, it goes stale the moment you play, and restoring someone
 * else's would be worse than useless.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKUP = join(HERE, 'progress-backup.json');
const restore = process.argv.includes('--restore');

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!target) throw new Error('no page target — is the app open on the phone?');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const evaluate = (expr) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    socket.send(
      JSON.stringify({
        id: n,
        method: 'Runtime.evaluate',
        params: {
          expression: `(function(){${expr}})()`,
          returnByValue: true,
        },
      }),
    );
  });

const KEY = 'colorlink:v1:progress';

if (restore) {
  if (!existsSync(BACKUP)) throw new Error(`no backup at ${BACKUP}`);
  const saved = readFileSync(BACKUP, 'utf8');
  await evaluate(`
    const saved = ${JSON.stringify(saved)};
    if (saved === 'null') localStorage.removeItem('${KEY}');
    else localStorage.setItem('${KEY}', saved);
    localStorage.removeItem('colorlink:v1:inProgress');
    return 1;
  `);
  console.log('restored the backed-up progress');
} else {
  const before = await evaluate(
    `return localStorage.getItem('${KEY}') || 'null';`,
  );
  writeFileSync(BACKUP, before.result.value);
  console.log(`backed up current progress to ${BACKUP}`);

  const out = await evaluate(`
    const TIERS = ['easy','normal','hard','extreme','expert','master'];
    const raw = JSON.parse(localStorage.getItem('${KEY}') || 'null') || { tiers: {} };
    for (const id of TIERS) if (!raw.tiers[id]) raw.tiers[id] = { solved: {} };
    // Each tier opens on 20 solves in the one before it (spec 7.1).
    for (const gate of ['hard','extreme','expert']) {
      for (let i = 1; i <= 20; i++) {
        if (!raw.tiers[gate].solved[i]) {
          raw.tiers[gate].solved[i] = {
            bestMs: 60000, hint: true, perfect: false,
            at: new Date().toISOString(),
          };
        }
      }
    }
    localStorage.setItem('${KEY}', JSON.stringify(raw));
    localStorage.removeItem('colorlink:v1:inProgress');
    return TIERS.map((t) => t + ' ' + Object.keys(raw.tiers[t].solved).length);
  `);
  console.log('seeded:', out.result.value.join(', '));
}

// Reload so Home re-reads storage.
await new Promise((resolve) => {
  const n = ++id;
  pending.set(n, resolve);
  socket.send(JSON.stringify({ id: n, method: 'Page.reload', params: {} }));
});
socket.close();
