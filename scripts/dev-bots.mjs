// Geliştirme aracı: bir odaya kendi kendine oynayan botlar ekler (arayüzü kalabalık odada denemek için).
// Kullanım: node scripts/dev-bots.mjs <ODA_KODU> [bot sayısı=5] [sunucu=http://localhost:3001]
// Botlar: Kırık Telefon'da yazar/çizer/tahmin eder, Sahtekâr'da sırası gelince çizip oy verir,
// Çizim Yarışı'nda çizen olunca karalar, değilse takımına tahmin yazar,
// klasik modda çizen olunca kelime seçip çizer. Ctrl+C ile kapatılır.
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';

const [code, countArg = '5', url = 'http://localhost:3001'] = process.argv.slice(2);
if (!code) {
  console.error('Kullanım: node scripts/dev-bots.mjs <ODA_KODU> [bot sayısı] [sunucu]');
  process.exit(1);
}

// En uzun isimler (16 karakter) arayüzde taşma olup olmadığını görmek için.
const NAMES = [
  'Çiğdemnurgülsüm',
  'Abdurrahmangazi',
  'Mehmetalihaydar',
  'Zeynepsudenaz1',
  'Kalabalıkİsimli',
  'UzunSoyadlıBot1',
  'Şükriyeümmühan',
  'Bot',
];
const AVATARS = ['😀', '😎', '🤓', '🥳', '😺', '🐶', '🦊', '🐸'];
const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#b197fc'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bot(i) {
  const socket = io(url, { transports: ['websocket'] });
  const name = NAMES[i % NAMES.length].slice(0, 16);
  const session = randomBytes(18).toString('base64url');
  let me = null;
  let state = null;
  let doneTurn = '';

  const scribble = (emit) => {
    const x = 100 + Math.random() * 500;
    const y = 100 + Math.random() * 350;
    emit({ t: 'start', color: '#000000', size: 8, x, y });
    emit({ t: 'move', pts: [x + 60, y + 30, x + 120, y - 20] });
  };

  socket.on('connect', async () => {
    const res = await socket.emitWithAck('room:join', {
      name,
      avatar: { color: COLORS[i % 8], face: AVATARS[i % 8] },
      sessionId: session,
      code,
    });
    if (res.ok) me = res.playerId;
    console.log(`${name}: ${res.ok ? 'katıldı' : res.error}`);
  });

  // Kırık Telefon
  socket.on('tp:task', async (task) => {
    if (task.submitted) return;
    await sleep(800 + Math.random() * 1500);
    if (task.kind === 'draw') {
      scribble((op) => socket.emit('tp:draw', task.step, op));
      await sleep(200);
      socket.emit('tp:submit', task.step);
    } else {
      socket.emit(
        'tp:submit',
        task.step,
        task.kind === 'write' ? (task.suggestion ?? 'uçan inek') : 'galiba bir kedi çok uzun bir tahmin cümlesi',
      );
    }
  });

  // Klasik: çizen olunca seç ve çiz
  socket.on('word:choices', async () => {
    await sleep(1000);
    socket.emit('word:choose', 0);
    await sleep(800);
    scribble((op) => socket.emit('draw:op', op));
  });

  socket.on('room:state', async (s) => {
    state = s;
    // Çizim Yarışı: çizen olunca karala, tahmin eden olunca takımına yanlış bir tahmin yaz.
    const race = s.teams?.race;
    if (race?.stage === 'draw' && me) {
      const key = `team-${race.turn}`;
      if (doneTurn === key) return;
      doneTurn = key;
      await sleep(600 + Math.random() * 1200);
      if (Object.values(race.drawers).includes(me)) scribble((op) => socket.emit('draw:op', op));
      else socket.emit('chat:send', ['kedi mi?', 'bir ev', 'galiba araba', 'uçak!'][i % 4]);
      return;
    }
    const imp = s.impostor;
    if (!imp || !me) return;
    if (imp.stage === 'draw' && imp.turnPlayerId === me) {
      const key = `${imp.round}-${imp.lap}`;
      if (doneTurn === key) return;
      doneTurn = key;
      await sleep(700);
      scribble((op) => socket.emit('draw:op', op));
      await sleep(200);
      socket.emit('imp:done');
    }
    if (imp.stage === 'vote' && !imp.voted.includes(me)) {
      await sleep(500 + Math.random() * 1000);
      const others = imp.order.filter((id) => id !== me);
      socket.emit('imp:vote', others[Math.floor(Math.random() * others.length)]);
    }
  });

  socket.on('tp:reveal', async () => {
    if (Math.random() < 0.5) {
      await sleep(400);
      socket.emit('tp:laugh');
    }
  });

  return () => state;
}

const count = Math.min(7, Number(countArg) || 5);
for (let i = 0; i < count; i++) bot(i);
