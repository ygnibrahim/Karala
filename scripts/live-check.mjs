// Canlı sunucuya karşı uçtan uca kontrol: üç mod + bağlantı kopmaları.
// Kullanım: node scripts/live-check.mjs [adres]   (varsayılan: https://karala.onrender.com)
// Gerçek oyunculara dokunmaz: kendi odalarını kurar, sonunda çıkar.
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';

const URL = process.argv[2] ?? 'https://karala.onrender.com';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = () => randomBytes(18).toString('base64url');
const avatar = { color: '#ff6b6b', face: '😀' };

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Bir oyuncu: bağlanır, olayları kaydeder, gerekirse kopup aynı oturumla geri döner. */
class Player {
  constructor(name) {
    this.name = name;
    this.session = token();
    this.log = [];
    this.id = null;
    this.code = null;
  }

  async connect() {
    this.socket = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
    this.socket.onAny((event, ...args) => this.log.push({ event, arg: args[0], at: Date.now() }));
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('connect_error', reject);
    });
  }

  async enter(kind, code) {
    const res = await this.socket.timeout(10_000).emitWithAck(kind, { name: this.name, avatar, sessionId: this.session, code });
    if (res.ok) {
      this.id = res.playerId;
      this.code = res.code;
    }
    return res;
  }

  /** Bağlantıyı koparır, `offlineMs` bekler, aynı oturumla geri döner. */
  async drop(offlineMs) {
    const oldId = this.id;
    this.socket.disconnect();
    await sleep(offlineMs);
    await this.connect();
    const res = await this.enter('room:join', this.code);
    return { res, sameId: res.ok && res.playerId === oldId };
  }

  emit(...args) {
    this.socket.emit(...args);
  }

  last(event) {
    return this.log.filter((e) => e.event === event).at(-1)?.arg;
  }

  state() {
    return this.last('room:state');
  }

  /** Koşulu sağlayan bir olay gelene kadar bekler (geçmişte gelmişse onu da sayar: `since`). */
  waitFor(event, match = () => true, ms = 15_000, since = Date.now()) {
    return new Promise((resolve, reject) => {
      const hit = this.log.find((e) => e.event === event && e.at >= since && match(e.arg));
      if (hit) return resolve(hit.arg);
      const timer = setTimeout(() => {
        this.socket.offAny(handler);
        reject(new Error(`${this.name}: "${event}" ${ms} ms içinde gelmedi`));
      }, ms);
      const handler = (name, arg) => {
        if (name === event && match(arg)) {
          clearTimeout(timer);
          this.socket.offAny(handler);
          resolve(arg);
        }
      };
      this.socket.onAny(handler);
    });
  }

  waitState(match, ms) {
    return this.waitFor('room:state', match, ms, 0);
  }

  leave() {
    this.socket?.emit('room:leave');
    this.socket?.disconnect();
  }
}

async function makeRoom(mode, names) {
  const players = names.map((n) => new Player(n));
  for (const p of players) await p.connect();
  const [host, ...others] = players;
  const created = await host.enter('room:create');
  if (!created.ok) throw new Error(`oda kurulamadı: ${created.error}`);
  for (const p of others) {
    const r = await p.enter('room:join', created.code);
    if (!r.ok) throw new Error(`${p.name} katılamadı: ${r.error}`);
  }
  // Klasik testteki kopmalar (3+4+40 sn) tur süresine sığsın diye uzun süre.
  host.emit('room:settings', { mode, rounds: 2, drawTime: mode === 'classic' ? 120 : 45 });
  await host.waitState((s) => s.settings.mode === mode && s.players.length === players.length);
  return players;
}

// ---------- Klasik ----------
async function classic() {
  console.log('\n🎨 KLASİK');
  const players = await makeRoom('classic', ['K-Ayşe', 'K-Can', 'K-Elif']);
  const [host] = players;
  host.emit('game:start');
  const choosing = await host.waitState((s) => s.phase === 'choosing');
  const drawer = players.find((p) => p.id === choosing.drawerId);
  const guessers = players.filter((p) => p !== drawer);
  const choices = await drawer.waitFor('word:choices', () => true, 10_000, 0);
  drawer.emit('word:choose', 0);
  const word = await drawer.waitFor('word:secret', () => true, 10_000, 0);
  check('Klasik: oyun başladı, çizen kelimeyi aldı', word === choices[0], word);

  drawer.emit('draw:op', { t: 'start', color: '#000000', size: 6, x: 100, y: 100 });
  drawer.emit('draw:op', { t: 'move', pts: [150, 150, 200, 120] });
  await guessers[0].waitFor('draw:op', (op) => op.t === 'move');
  check('Klasik: çizim diğer oyuncuya ulaştı', true);

  // Tahminci kısa kopma (3 sn) → aynı kimlik + çizim geçmişi
  const g = await guessers[1].drop(3_000);
  const hist = guessers[1].last('draw:history') ?? [];
  check('Klasik: tahminci 3 sn kopup döndü, aynı oyuncu', g.sameId);
  check('Klasik: dönen oyuncu mevcut çizimi aldı', hist.length === 1 && hist[0].pts.length === 6);

  // Çizen kısa kopma (4 sn, bekleme 10 sn) → tur sürüyor, kelime yeniden geldi
  const d = await drawer.drop(4_000);
  await sleep(500);
  const afterDrawerDrop = host.state();
  check('Klasik: çizen 4 sn kopup döndü, aynı oyuncu', d.sameId);
  check('Klasik: çizen dönünce tur devam ediyor', afterDrawerDrop.phase === 'drawing' && afterDrawerDrop.drawerId === drawer.id);
  check('Klasik: çizen kelimeyi yeniden aldı', drawer.last('word:secret') === word);

  // Bir tahminci bilir, diğeri 40 sn kopar (eski sürüm 30 sn'de atıyordu) → hâlâ odada, tur erken bitmedi
  guessers[0].emit('chat:send', word);
  await guessers[0].waitFor('word:secret', () => true, 10_000, 0);
  const longDrop = guessers[1].drop(40_000);
  await sleep(2_000);
  check('Klasik: biri kopukken tur "herkes bildi" diye erken bitmedi', host.state().phase === 'drawing');
  const ld = await longDrop;
  check('Klasik: 40 sn kopan oyuncu odadan atılmadı, aynı kimlikle döndü', ld.sameId);

  guessers[1].emit('chat:send', word);
  const end = await host.waitState((s) => s.phase === 'turnEnd', 15_000);
  check('Klasik: herkes bilince tur bitti', end.turnResult?.reason === 'allGuessed');
  const scores = end.players.map((p) => `${p.name}:${p.score}`).join(' ');
  check(
    'Klasik: puanlar verildi',
    end.players.every((p) => p.score > 0),
    scores,
  );
  for (const p of players) p.leave();
}

// ---------- Kırık Telefon ----------
async function telephone() {
  console.log('\n📞 KIRIK TELEFON');
  const players = await makeRoom('telephone', ['T-Ayşe', 'T-Can', 'T-Elif']);
  const [host] = players;
  const start = Date.now();
  host.emit('game:start');
  await Promise.all(players.map((p) => p.waitFor('tp:task', (t) => t.step === 0, 15_000, start)));
  check('Kırık Telefon: herkes yazma görevini aldı', true);

  let t1 = Date.now();
  for (const [i, p] of players.entries()) p.emit('tp:submit', 0, `canlı test fikri ${i}`);
  const drawTasks = await Promise.all(players.map((p) => p.waitFor('tp:task', (t) => t.step === 1, 15_000, t1)));
  check(
    'Kırık Telefon: çizim adımına geçildi',
    drawTasks.every((t) => t.kind === 'draw' && t.prompt?.text),
  );

  // Bir oyuncu çizerken kopar ve döner → taslak ve görev geri gelir
  const dropper = players[2];
  dropper.emit('tp:draw', 1, { t: 'start', color: '#000000', size: 5, x: 10, y: 10 });
  dropper.emit('tp:draw', 1, { t: 'move', pts: [50, 50] });
  await sleep(800);
  const r = await dropper.drop(3_000);
  const task = dropper.last('tp:task');
  const draft = dropper.last('draw:history') ?? [];
  check('Kırık Telefon: çizerken kopan oyuncu aynı kimlikle döndü', r.sameId);
  check('Kırık Telefon: görevi ve yarım çizimi geri geldi', task?.step === 1 && draft.length === 1);

  t1 = Date.now();
  for (const p of players) {
    p.emit('tp:draw', 1, { t: 'start', color: '#123456', size: 5, x: 30, y: 30 });
    p.emit('tp:submit', 1);
  }
  const guessTasks = await Promise.all(players.map((p) => p.waitFor('tp:task', (t) => t.step === 2, 15_000, t1)));
  check(
    'Kırık Telefon: tahmin adımına geçildi, çizimler geldi',
    guessTasks.every((t) => t.kind === 'guess' && t.prompt?.drawing?.length),
  );

  t1 = Date.now();
  for (const [i, p] of players.entries()) p.emit('tp:submit', 2, `canlı tahmin ${i}`);
  await host.waitFor('tp:reveal', () => true, 15_000, t1);
  const revealState = await host.waitState((s) => s.phase === 'reveal', 5_000);
  check('Kırık Telefon: gösterim başladı', revealState.telephone?.reveal?.entry === 0);
  // İlk adımın yazarı olmayan biri güler; sayıldığını görmeden ilerletme.
  const firstAuthor = players.find((p) => p.id === revealState.telephone.participants[0]);
  const laugher = players.find((p) => p !== firstAuthor);
  laugher.emit('tp:laugh');
  await host.waitState((s) => Object.values(s.telephone?.laughs ?? {}).reduce((a, b) => a + b, 0) === 1, 5_000);
  const ended = (async () => host.waitState((s) => s.phase === 'gameEnd', 20_000))();
  for (let i = 0; i < 9; i++) {
    host.emit('tp:next');
    await sleep(250);
  }
  const end = await ended;
  check('Kırık Telefon: oyun sonu ve gülme puanı', end.players.reduce((a, p) => a + p.score, 0) === 1);
  console.log(`   ⏱ süre: ${Math.round((Date.now() - start) / 1000)} sn`);
  for (const p of players) p.leave();
}

// ---------- Sahtekâr ----------
async function impostor() {
  console.log('\n🕵️ SAHTEKÂR');
  const players = await makeRoom('impostor', ['S-Ayşe', 'S-Can', 'S-Elif']);
  const [host] = players;
  const start = Date.now();
  host.emit('game:start');
  const roles = await Promise.all(players.map((p) => p.waitFor('imp:role', () => true, 15_000, start)));
  const imp = players[roles.findIndex((r) => r.isImpostor)];
  const word = roles.find((r) => !r.isImpostor)?.word;
  check('Sahtekâr: tek sahtekâr, diğerleri aynı kelimeyi aldı', roles.filter((r) => r.isImpostor).length === 1 && !!word);
  check('Sahtekâr: sahtekâra kelime gitmedi', !JSON.stringify(imp.log).includes(`"${word}"`));

  // Rol tanıtımında biri kopup döner → rolü geri gelir
  const someone = players.find((p) => p !== imp);
  const before = someone.last('imp:role');
  const r = await someone.drop(2_000);
  check(
    'Sahtekâr: kopup dönen oyuncu aynı rolü yeniden aldı',
    r.sameId && JSON.stringify(someone.last('imp:role')) === JSON.stringify(before),
  );

  await host.waitState((s) => s.impostor?.stage === 'draw', 15_000);
  for (let i = 0; i < 6; i++) {
    const st = host.state().impostor;
    if (st?.stage !== 'draw') break;
    const turn = players.find((p) => p.id === st.turnPlayerId);
    const t0 = Date.now();
    turn.emit('draw:op', { t: 'start', color: '#000000', size: 5, x: 20 + i * 30, y: 50 });
    turn.emit('draw:op', { t: 'move', pts: [40 + i * 30, 90] });
    turn.emit('imp:done');
    await host.waitFor('room:state', (s) => s.impostor?.stage !== 'draw' || s.impostor.turnPlayerId !== turn.id, 10_000, t0);
  }
  check('Sahtekâr: 6 sıra tamamlandı, oylamaya geçildi', host.state().impostor?.stage === 'vote');

  // Oylamada bir oyuncu kopar → oylama onu bekler; döner ve oy verir
  const crew = players.filter((p) => p !== imp);
  const voter = crew[1];
  voter.socket.disconnect();
  crew[0].emit('imp:vote', imp.id);
  imp.emit('imp:vote', crew[0].id);
  await sleep(1_500);
  check('Sahtekâr: oylama kopan oyuncuyu bekliyor', host.state().impostor?.stage === 'vote');
  await voter.connect();
  const back = await voter.enter('room:join', voter.code);
  check('Sahtekâr: kopan oyuncu oylamaya geri döndü', back.ok && back.playerId === voter.id);
  const t2 = Date.now();
  voter.emit('imp:vote', imp.id);
  await host.waitFor('room:state', (s) => s.impostor?.stage === 'guess', 10_000, t2);
  imp.emit('imp:guess', 'yanlış tahmin');
  const res = await host.waitFor('room:state', (s) => s.impostor?.stage === 'result', 10_000, t2);
  const result = res.impostor.result;
  check(
    'Sahtekâr: yakalandı, sonuç ve puanlar doğru',
    result.caught && !result.guessedRight && result.word === word && result.impostorId === imp.id,
  );
  for (const p of players) p.leave();
}

// ---------- Çalıştır ----------
const health = await fetch(`${URL}/health`).then((r) => r.json());
console.log(`Sunucu: ${URL} · sürüm ${health.version}`);
for (const [name, fn] of [
  ['klasik', classic],
  ['telefon', telephone],
  ['sahtekar', impostor],
]) {
  try {
    await fn();
  } catch (err) {
    check(`${name}: beklenmeyen hata`, false, err.message);
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\nSONUÇ: ${results.length - failed.length}/${results.length} kontrol geçti`);
process.exit(failed.length ? 1 : 0);
