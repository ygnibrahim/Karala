// Minimal Chrome DevTools Protocol yardımcıları (headless Chrome). Mağaza görsellerini üretmek için;
// oyunun kendisi bunu kullanmaz. Chrome yolu CHROME_PATH ile değiştirilebilir.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width, height, scale, lang = 'tr' }) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = mkdtempSync(join(tmpdir(), 'kcdp-'));
  const proc = spawn(
    process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      '--no-first-run',
      '--hide-scrollbars',
      `--lang=${lang}`,
      '--mute-audio',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: true });
  await send('Emulation.setLocaleOverride', { locale: lang === 'tr' ? 'tr-TR' : 'en-US' }).catch(() => {});

  const page = {
    send,
    async goto(url) {
      await send('Page.navigate', { url });
      await sleep(1500);
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval error');
      return r.result.value;
    },
    async waitFor(expr, ms = 20000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await page.eval(`!!(${expr})`).catch(() => false)) return;
        await sleep(150);
      }
      throw new Error(`timeout: ${expr}`);
    },
    click: (sel) => page.eval(`(() => { const el = ${sel}; el.click(); return true; })()`),
    async type(sel, text) {
      await page.eval(`(() => { const el = ${sel}; el.focus(); el.select?.(); return true; })()`);
      await send('Input.insertText', { text });
    },
    async drag(points) {
      const [x0, y0] = points[0];
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
      for (const [x, y] of points.slice(1)) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
        await sleep(8);
      }
      const [x1, y1] = points[points.length - 1];
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', buttons: 0, clickCount: 1 });
    },
    async shot(file) {
      const { writeFileSync } = await import('node:fs');
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      console.log('📸', file);
    },
    close() {
      ws.close();
      proc.kill();
    },
  };
  return page;
}
