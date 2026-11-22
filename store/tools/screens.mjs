// Play Store ekran görüntüleri: headless Chrome'da gerçek bir oyun (tarayıcı + 3 bot).
// Önce yerelde "npm run dev" çalışıyor olmalı (istemci 5173, sunucu 3001). Kullanım: node store/tools/screens.mjs
// Tarayıcı ilk turda "ev" kelimesini alamazsa 3 koduyla çıkar; tekrar çalıştır.

import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const require = createRequire(new URL('../../package.json', import.meta.url));
const { io } = require('socket.io-client');

const OUT = fileURLToPath(new URL('../assets/screenshots', import.meta.url));
const APP = 'http://localhost:5173/';
const p = await launch({ width: 432, height: 768, scale: 2.5 });
await p.goto(APP);
await p.eval(`localStorage.setItem('karala:lang','tr'); true`);
await p.goto(APP);

// 1) Ana ekran
await p.waitFor(`document.querySelector('.home-card input.input')`);
await p.type(`document.querySelector('.home-card input.input')`, 'Deniz');
await sleep(400);
await p.shot(`${OUT}/01-ana-ekran.png`);

// 2) Oda kur, botlar katılsın
await p.click(`document.querySelector('.home-card .btn-primary.btn-big')`);
await p.waitFor(`document.querySelector('.room-code strong')`);
const code = await p.eval(`document.querySelector('.room-code strong').textContent.trim()`);
console.log('code', code);

const botsDef = [
  ['Ayşe', '#ff6b6b', '😺'],
  ['Mehmet', '#4dabf7', '🐶'],
  ['Zeynep', '#69db7c', '🦊'],
];
const bots = [];
for (const [name, color, face] of botsDef) {
  const s = io('http://localhost:3001', { transports: ['websocket'] });
  await new Promise((r) => s.on('connect', r));
  const bot = { s, name, secret: null, state: null };
  s.on('word:secret', (w) => (bot.secret = w));
  s.on('word:choices', (w) => (bot.choices = w));
  s.on('room:state', (st) => (bot.state = st));
  const r = await s.emitWithAck('room:join', {
    name,
    avatar: { color, face },
    sessionId: randomBytes(18).toString('base64url'),
    code,
  });
  bot.id = r.playerId;
  bots.push(bot);
  await sleep(300);
}
bots[0].s.emit('chat:send', 'selam herkese 👋');
await sleep(300);
bots[1].s.emit('chat:send', 'hadi başlayalım!');
await sleep(300);
bots[2].s.emit('chat:send', 'bu sefer ben kazanıcam 😎');
await sleep(1200);
await p.shot(`${OUT}/02-lobi.png`);

// Özel kelimeler: çizimler kelimelerle eşleşsin (galeride doğru isimler).
const WORDS = ['ev', 'güneş', 'balık', 'kedi', 'ağaç', 'çiçek', 'araba', 'dondurma'];
await p.type(`document.querySelector('.settings textarea')`, WORDS.join(', '));
await p.eval(`document.querySelector('.settings textarea').blur(), true`);
await sleep(500);
await p.eval(`(() => {
  const sel = [...document.querySelectorAll('.settings select')].find((s) => [...s.options].some((o) => o.value === 'ozel'));
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(sel, 'ozel'); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
await sleep(500);
// Tur sayısı 2 (en az); sonra başlat.
await p.eval(`(() => {
  const sel = document.querySelector('.settings select');
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(sel, '2'); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
await sleep(500);
await p.click(`document.querySelector('.card .btn-primary.btn-big')`);

const st = () => bots[0].state;
const line = (e, color, size, pts) => {
  e({ t: 'start', color, size, x: pts[0], y: pts[1] });
  e({ t: 'move', pts: pts.slice(2).length ? pts.slice(2) : [pts[0] + 1, pts[1] + 1] });
};
const drawings = {
  ev: (e) => {
    e({ t: 'shape', shape: 'rect', color: '#1864ab', size: 8, x1: 240, y1: 260, x2: 560, y2: 500 });
    e({ t: 'fill', color: '#a5d8ff', x: 300, y: 380 });
    e({ t: 'shape', shape: 'triangle', color: '#c92a2a', size: 8, x1: 200, y1: 110, x2: 600, y2: 260 });
    e({ t: 'fill', color: '#ff6b6b', x: 400, y: 220 });
    e({ t: 'shape', shape: 'rect', color: '#8d5a2b', size: 8, x1: 360, y1: 400, x2: 440, y2: 500 });
    e({ t: 'fill', color: '#c08552', x: 400, y: 450 });
  },
  güneş: (e) => {
    e({ t: 'shape', shape: 'ellipse', color: '#f08c00', size: 8, x1: 300, y1: 200, x2: 500, y2: 400 });
    e({ t: 'fill', color: '#fcc419', x: 400, y: 300 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(e, '#f08c00', 10, [
        400 + Math.cos(a) * 130,
        300 + Math.sin(a) * 130,
        400 + Math.cos(a) * 190,
        300 + Math.sin(a) * 190,
      ]);
    }
    line(e, '#000000', 14, [360, 280]);
    line(e, '#000000', 14, [440, 280]);
    line(e, '#000000', 8, [350, 330, 380, 355, 420, 355, 450, 330]);
  },
  balık: (e) => {
    e({ t: 'shape', shape: 'ellipse', color: '#1971c2', size: 8, x1: 200, y1: 200, x2: 500, y2: 400 });
    e({ t: 'fill', color: '#74c0fc', x: 360, y: 300 });
    e({ t: 'shape', shape: 'triangle', color: '#1971c2', size: 8, x1: 490, y1: 220, x2: 630, y2: 380 });
    e({ t: 'fill', color: '#4dabf7', x: 560, y: 330 });
    line(e, '#000000', 18, [270, 280]);
    line(e, '#4dabf7', 8, [170, 190, 165, 180]);
    line(e, '#4dabf7', 8, [150, 140, 146, 130]);
  },
  kedi: (e) => {
    e({ t: 'shape', shape: 'ellipse', color: '#fd7e14', size: 10, x1: 270, y1: 170, x2: 530, y2: 410 });
    e({ t: 'fill', color: '#ffa94d', x: 400, y: 290 });
    line(e, '#fd7e14', 10, [290, 215, 300, 120, 360, 180]);
    line(e, '#fd7e14', 10, [510, 215, 500, 120, 440, 180]);
    line(e, '#000000', 14, [350, 270]);
    line(e, '#000000', 14, [450, 270]);
    line(e, '#e64980', 10, [392, 315, 408, 315, 400, 325, 392, 315]);
    line(e, '#000000', 4, [330, 320, 240, 300]);
    line(e, '#000000', 4, [330, 335, 240, 345]);
    line(e, '#000000', 4, [470, 320, 560, 300]);
    line(e, '#000000', 4, [470, 335, 560, 345]);
  },
  ağaç: (e) => {
    e({ t: 'shape', shape: 'rect', color: '#8d5524', size: 8, x1: 370, y1: 330, x2: 430, y2: 520 });
    e({ t: 'fill', color: '#a0522d', x: 400, y: 430 });
    e({ t: 'shape', shape: 'ellipse', color: '#2f9e44', size: 8, x1: 260, y1: 120, x2: 540, y2: 360 });
    e({ t: 'fill', color: '#51cf66', x: 400, y: 240 });
    line(e, '#c92a2a', 20, [340, 220]);
    line(e, '#c92a2a', 20, [450, 190]);
    line(e, '#c92a2a', 20, [430, 290]);
    line(e, '#2f9e44', 12, [60, 525, 300, 518, 520, 530, 740, 522]);
  },
  çiçek: (e) => {
    line(e, '#2f9e44', 12, [400, 300, 400, 540]);
    line(e, '#2f9e44', 10, [400, 450, 340, 410, 330, 440, 400, 470]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cx = 400 + Math.cos(a) * 75;
      const cy = 220 + Math.sin(a) * 75;
      e({ t: 'shape', shape: 'ellipse', color: '#d6336c', size: 6, x1: cx - 48, y1: cy - 48, x2: cx + 48, y2: cy + 48 });
      e({ t: 'fill', color: '#f783ac', x: cx + Math.cos(a) * 20, y: cy + Math.sin(a) * 20 });
    }
    e({ t: 'shape', shape: 'ellipse', color: '#f08c00', size: 6, x1: 355, y1: 175, x2: 445, y2: 265 });
    e({ t: 'fill', color: '#fcc419', x: 400, y: 220 });
  },
  araba: (e) => {
    e({ t: 'shape', shape: 'rect', color: '#c92a2a', size: 8, x1: 160, y1: 280, x2: 640, y2: 400 });
    e({ t: 'fill', color: '#ff6b6b', x: 400, y: 340 });
    e({ t: 'shape', shape: 'rect', color: '#c92a2a', size: 8, x1: 270, y1: 190, x2: 530, y2: 280 });
    e({ t: 'fill', color: '#a5d8ff', x: 400, y: 235 });
    line(e, '#c92a2a', 8, [400, 190, 400, 280]);
    e({ t: 'shape', shape: 'ellipse', color: '#000000', size: 8, x1: 210, y1: 360, x2: 310, y2: 460 });
    e({ t: 'fill', color: '#495057', x: 260, y: 410 });
    e({ t: 'shape', shape: 'ellipse', color: '#000000', size: 8, x1: 490, y1: 360, x2: 590, y2: 460 });
    e({ t: 'fill', color: '#495057', x: 540, y: 410 });
  },
  dondurma: (e) => {
    e({ t: 'shape', shape: 'triangle', color: '#c08552', size: 8, x1: 320, y1: 540, x2: 480, y2: 300 });
    e({ t: 'fill', color: '#ffd8a8', x: 400, y: 360 });
    e({ t: 'shape', shape: 'ellipse', color: '#d6336c', size: 8, x1: 310, y1: 200, x2: 490, y2: 330 });
    e({ t: 'fill', color: '#fcc2d7', x: 400, y: 265 });
    e({ t: 'shape', shape: 'ellipse', color: '#8d5a2b', size: 8, x1: 330, y1: 100, x2: 470, y2: 220 });
    e({ t: 'fill', color: '#c08552', x: 400, y: 160 });
    line(e, '#c92a2a', 22, [400, 90]);
  },
};

const shotsTaken = { draw: false, guess: false };
for (;;) {
  while (!st() || (st().phase !== 'choosing' && st().phase !== 'gameEnd')) await sleep(100);
  if (st().phase === 'gameEnd') break;
  const drawerBot = bots.find((b) => b.id === st().drawerId);
  if (!drawerBot) {
    // Tarayıcı çiziyor: kelimeyi seç ve ev çiz.
    await p.waitFor(`document.querySelector('.choices .btn')`);
    const offered = await p.eval(`[...document.querySelectorAll('.choices .btn')].map((b) => b.textContent.trim())`);
    const evIdx = offered.findIndex((w) => w.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü]/g, '') === 'ev');
    if (!shotsTaken.draw && evIdx < 0) {
      console.log('ev yok, teklif:', offered.join(','));
      process.exit(3);
    }
    await p.click(`document.querySelectorAll('.choices .btn')[${Math.max(0, evIdx)}]`);
    await p.waitFor(`document.querySelector('.word-secret')`);
    const word = (await p.eval(`document.querySelector('.word-secret').textContent`)).replace(/^Çiz:\s*/, '').trim();
    if (!shotsTaken.draw) {
      const r = await p.eval(
        `(() => { const b = document.querySelector('.board-canvas-wrap canvas').getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })()`,
      );
      const P = (x, y) => [r[0] + (x / 800) * r[2], r[1] + (y / 600) * r[3]];
      const line = (pts) => {
        const out = [];
        for (let i = 0; i < pts.length - 1; i++)
          for (let t = 0; t <= 1; t += 0.1)
            out.push(P(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t));
        return out;
      };
      const color = async (n) => p.click(`document.querySelectorAll('.colors .color')[${n}]`);
      const colors = await p.eval(
        `[...document.querySelectorAll('.colors .color')].map(b => b.getAttribute('aria-label') || b.title || b.style.background)`,
      );
      console.log('colors', colors.join(' | '));
      await color(Math.min(4, colors.length - 1));
      await p.drag(
        line([
          [200, 270],
          [400, 110],
          [600, 270],
        ]),
      );
      await color(Math.min(11, colors.length - 1));
      await p.drag(
        line([
          [240, 250],
          [240, 500],
          [560, 500],
          [560, 250],
        ]),
      );
      await p.drag(
        line([
          [360, 500],
          [360, 400],
          [440, 400],
          [440, 500],
        ]),
      );
      await sleep(400);
      bots[1].s.emit('chat:send', 'kale?');
      await sleep(250);
      bots[2].s.emit('chat:send', 'çadır mı 🤔');
      await sleep(1000);
      await p.shot(`${OUT}/03-ciz.png`);
      shotsTaken.draw = true;
    }
    for (const b of bots) {
      b.s.emit('chat:send', word);
      await sleep(150);
    }
    continue;
  }
  // Bot çiziyor
  drawerBot.secret = null;
  while (!drawerBot.choices) await sleep(50);
  const pick = Math.max(
    0,
    drawerBot.choices.findIndex((w) => drawings[w]),
  );
  drawerBot.s.emit('word:choose', pick);
  drawerBot.choices = null;
  while (!drawerBot.secret) await sleep(50);
  drawings[drawerBot.secret]?.((op) => drawerBot.s.emit('draw:op', op));
  const others = bots.filter((b) => b !== drawerBot);
  if (!shotsTaken.guess) {
    await sleep(600);
    others[0].s.emit('chat:send', 'aslan!');
    await sleep(300);
    await p.waitFor(`document.querySelector('.chat-input input')`);
    await p.type(`document.querySelector('.chat-input input')`, 'kaplan');
    await p.eval(`document.querySelector('.chat-input .btn').click(), true`);
    await sleep(300);
    others[1].s.emit('chat:send', drawerBot.secret);
    await sleep(1500);
    await p.shot(`${OUT}/04-tahmin.png`);
    shotsTaken.guess = true;
    await p.type(`document.querySelector('.chat-input input')`, drawerBot.secret);
    await p.eval(`document.querySelector('.chat-input .btn').click(), true`);
    await sleep(200);
    others[0].s.emit('chat:send', drawerBot.secret);
  } else {
    await sleep(500);
    for (const b of others) {
      b.s.emit('chat:send', drawerBot.secret);
      await sleep(200);
    }
    const typed = await p.eval(`!!document.querySelector('.chat-input input')`);
    if (typed) {
      await p.type(`document.querySelector('.chat-input input')`, drawerBot.secret);
      await p.eval(`document.querySelector('.chat-input .btn').click(), true`);
    }
  }
  while (st().phase === 'drawing') await sleep(100);
}

// 5) Oyun sonu
await p.waitFor(`document.querySelector('.end .podium')`);
await sleep(2500);
await p.shot(`${OUT}/05-oyun-sonu.png`);
await p.eval(`document.querySelector('.gallery')?.scrollIntoView({ block: 'center' }), true`);
await sleep(1200);
await p.shot(`${OUT}/06-galeri.png`);
p.close();
for (const b of bots) b.s.close();
process.exit(0);
