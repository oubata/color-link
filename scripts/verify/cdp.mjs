/**
 * A very small Chrome DevTools Protocol client: enough to drive a headless
 * browser, press real keys and take screenshots, with no npm dependency beyond
 * Node's built-in fetch and WebSocket.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATES = [
  process.env['CHROME_PATH'],
  // Windows
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
];

export function findBrowser() {
  for (const path of CANDIDATES) {
    if (path && existsSync(path)) return path;
  }
  throw new Error(
    'No Chromium-based browser found. Set CHROME_PATH to one to run the browser checks.',
  );
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function launch({
  port = 9333,
  profile,
  browser = findBrowser(),
}) {
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });

  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(250);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await response.json();
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch {
      // Still starting up.
    }
  }
  if (!target) {
    child.kill();
    throw new Error('The browser never exposed a debugging target');
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const logs = [];
  const requests = [];

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }

    if (message.method === 'Runtime.consoleAPICalled') {
      logs.push({
        level: message.params.type,
        text: message.params.args
          .map((a) => a.value ?? a.description ?? '')
          .join(' '),
      });
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      logs.push({
        level: 'error',
        text: details.exception?.description ?? details.text,
      });
    }
    if (message.method === 'Network.requestWillBeSent') {
      requests.push({
        url: message.params.request.url,
        type: message.params.type,
      });
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  const KEYCODES = {
    Tab: 9,
    Enter: 13,
    Escape: 27,
    ' ': 32,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
  };

  return {
    logs,
    requests,
    send,

    async setViewport(width, height, dpr = 3) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile: true,
      });
    },

    async navigate(url) {
      await send('Page.navigate', { url });
      await this.settled();
    },

    /** Tear the app down so nothing of it is alive to write to storage. */
    async blank() {
      await send('Page.navigate', { url: 'about:blank' });
      await sleep(300);
    },

    /**
     * Wipe storage from outside the page. Clearing it with page script races
     * the app's own save-on-hide, which fires as the document unloads.
     */
    async clearOriginData(origin) {
      await send('Storage.clearDataForOrigin', {
        origin,
        storageTypes: 'local_storage,cookies,indexeddb',
      });
    },

    async reload() {
      await send('Page.reload', {});
      await this.settled();
    },

    /** Wait for the document to finish loading and the app to paint a screen. */
    async settled(timeout = 15_000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        await sleep(100);
        try {
          const ready = await this.evaluate(`
            return document.readyState === 'complete'
              && document.querySelector('#app > .screen') !== null;
          `);
          if (ready) return true;
        } catch {
          // The context is swapping under us mid-navigation.
        }
      }
      return false;
    },

    /** Runs `expression` as a function body in the page and returns its value. */
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression: `(function(){${expression}})()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text,
        );
      }
      return result.result.value;
    },

    /** A real key event through the browser, not a synthesised DOM event. */
    async key(name, { shift = false } = {}) {
      const code = KEYCODES[name] ?? name.toUpperCase().charCodeAt(0);
      const printable = name.length === 1 && name !== ' ';
      const base = {
        key: name,
        code: printable
          ? `Key${name.toUpperCase()}`
          : name === ' '
            ? 'Space'
            : name,
        windowsVirtualKeyCode: code,
        nativeVirtualKeyCode: code,
        modifiers: shift ? 8 : 0,
      };
      const text = printable
        ? name
        : name === 'Enter'
          ? '\r'
          : name === ' '
            ? ' '
            : undefined;
      await send('Input.dispatchKeyEvent', {
        ...base,
        type: text === undefined ? 'rawKeyDown' : 'keyDown',
        text,
      });
      await send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
    },

    async enableNetwork() {
      await send('Network.enable');
    },

    async screenshot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    },

    async close() {
      try {
        socket.close();
      } catch {
        // Already closed.
      }
      child.kill();
    },
  };
}
