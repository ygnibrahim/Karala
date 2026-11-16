import type { Server, Socket } from 'socket.io';
import {
  applyOp, CANVAS_H, CANVAS_W, CATEGORIES, SHAPE_KINDS, DEFAULT_SETTINGS, DRAW_TIME_OPTIONS, MAX_PLAYER_OPTIONS, ROUND_OPTIONS,
  type Avatar, type ChatKind, type ChatMessage, type ClientToServer, type DrawItem, type DrawOp, type Phase,
  type RoomState, type ServerToClient, type Settings, type TurnResult,
} from '../../shared/protocol';
import { WORDS } from './words';
import { isClose, normalizeGuess, pickRandom } from './util';

type IO = Server<ClientToServer, ServerToClient>;
type Sock = Socket<ClientToServer, ServerToClient>;

const CHOOSE_MS = 15_000;
const TURN_END_MS = 6_000;
const RECONNECT_GRACE_MS = 30_000;
const MAX_HISTORY_POINTS = 200_000;
const HINT_THRESHOLDS = [0.5, 0.7, 0.85];

interface Player {
  id: string;
  socketId: string | null;
  name: string;
  avatar: Avatar;
  score: number;
  guessed: boolean;
  reacted: boolean;
  leaveTimer: NodeJS.Timeout | null;
}

export class Room {
  players: Player[] = [];
  hostId: string | null = null;
  settings: Settings = { ...DEFAULT_SETTINGS, customWords: [] };
  phase: Phase = 'lobby';
  round = 0;
  drawerId: string | null = null;

  private queue: string[] = [];
  private choices: string[] = [];
  private word: string | null = null;
  private revealed = new Set<number>();
  private hintsGiven = 0;
  private phaseStart = 0;
  private deadline = 0;
  private ticker: NodeJS.Timeout | null = null;
  private history: DrawItem[] = [];
  private historyPoints = 0;
  private usedWords = new Set<string>();
  private turnGains: Record<string, number> = {};
  private turnResult: TurnResult | null = null;
  private msgId = 0;

  constructor(private io: IO, public code: string, private onEmpty: (room: Room) => void) {}

  // ---------- Oyuncu yönetimi ----------

  get connectedPlayers() {
    return this.players.filter((p) => p.socketId !== null);
  }

  findPlayer(id: string) {
    return this.players.find((p) => p.id === id);
  }

  /** Oyuncuyu odaya ekler ya da yeniden bağlar. Hata varsa mesajını döner. */
  join(socket: Sock, sessionId: string, name: string, avatar: Avatar): string | null {
    let player = this.findPlayer(sessionId);
    if (player) {
      if (player.leaveTimer) clearTimeout(player.leaveTimer);
      player.leaveTimer = null;
      const wasOffline = player.socketId === null;
      // Geri dönen oyuncu odadaki adını/avatarını korur.
      player.socketId = socket.id;
      if (wasOffline) this.system(`${player.name} geri döndü.`);
    } else {
      if (this.players.length >= this.settings.maxPlayers) return 'Oda dolu.';
      player = { id: sessionId, socketId: socket.id, name, avatar, score: 0, guessed: false, reacted: false, leaveTimer: null };
      this.players.push(player);
      this.system(`${name} odaya katıldı.`);
    }
    if (!this.hostId || !this.findPlayer(this.hostId)) this.hostId = player.id;
    socket.join(this.code);
    this.broadcastState();
    this.sendPrivateState(socket, player);
    return null;
  }

  /** Bağlantı koptu: kısa bir süre geri dönmesini bekle. */
  disconnect(playerId: string) {
    const p = this.findPlayer(playerId);
    if (!p) return;
    p.socketId = null;
    p.leaveTimer = setTimeout(() => this.remove(playerId), RECONNECT_GRACE_MS);
    if (this.phase !== 'lobby' && this.phase !== 'gameEnd') {
      if (p.id === this.drawerId && (this.phase === 'choosing' || this.phase === 'drawing')) {
        this.system(`${p.name} (çizen) bağlantıyı kaybetti.`);
        this.endTurn('drawerLeft');
      } else {
        // Oyuncu sayısı kontrolünü hemen yapma: sayfa yenileyen oyuncu birkaç saniyede geri döner.
        // Gerçekten ayrıldıysa süre dolunca remove() bunu halleder.
        this.checkAllGuessed();
      }
    }
    this.reassignHost();
    this.broadcastState();
  }

  /** Oyuncuyu odadan tamamen çıkarır. */
  remove(playerId: string, socket?: Sock) {
    const p = this.findPlayer(playerId);
    if (!p) return;
    if (p.leaveTimer) clearTimeout(p.leaveTimer);
    socket?.leave(this.code);
    this.players = this.players.filter((x) => x.id !== playerId);
    this.queue = this.queue.filter((id) => id !== playerId);
    this.system(`${p.name} odadan ayrıldı.`);
    if (this.players.length === 0) {
      this.stopTicker();
      this.onEmpty(this);
      return;
    }
    this.reassignHost();
    if (p.id === this.drawerId && (this.phase === 'choosing' || this.phase === 'drawing')) {
      this.endTurn('drawerLeft');
    } else {
      this.checkEnoughPlayers();
      this.checkAllGuessed();
    }
    this.broadcastState();
  }

  private reassignHost() {
    const host = this.hostId ? this.findPlayer(this.hostId) : undefined;
    if (host && host.socketId) return;
    const next = this.connectedPlayers[0];
    if (next && next.id !== this.hostId) {
      this.hostId = next.id;
      this.system(`${next.name} artık oda sahibi.`);
    }
  }

  private checkEnoughPlayers() {
    if (this.phase === 'lobby' || this.phase === 'gameEnd') return;
    if (this.connectedPlayers.length < 2) {
      this.system('Yeterli oyuncu kalmadı, lobiye dönülüyor.');
      this.backToLobby();
    }
  }

  // ---------- Ayarlar & akış ----------

  updateSettings(playerId: string, s: Partial<Settings>) {
    if (playerId !== this.hostId || this.phase !== 'lobby') return;
    const next = { ...this.settings };
    if (typeof s.rounds === 'number' && ROUND_OPTIONS.includes(s.rounds)) next.rounds = s.rounds;
    if (typeof s.drawTime === 'number' && DRAW_TIME_OPTIONS.includes(s.drawTime)) next.drawTime = s.drawTime;
    if (typeof s.maxPlayers === 'number' && MAX_PLAYER_OPTIONS.includes(s.maxPlayers)) {
      next.maxPlayers = Math.max(s.maxPlayers, this.players.length);
    }
    if (typeof s.category === 'string' && CATEGORIES.some((c) => c.id === s.category)) next.category = s.category;
    if (Array.isArray(s.customWords)) {
      next.customWords = [...new Set(
        s.customWords
          .filter((w): w is string => typeof w === 'string')
          .map((w) => w.trim().toLocaleLowerCase('tr').slice(0, 30))
          .filter((w) => normalizeGuess(w).length >= 2),
      )].slice(0, 200);
    }
    this.settings = next;
    this.broadcastState();
  }

  start(playerId: string) {
    if (playerId !== this.hostId || this.phase !== 'lobby') return;
    if (this.connectedPlayers.length < 2) return;
    if (this.wordPool().length < 3) {
      this.system('Oyunu başlatmak için en az 3 kelime gerekli.');
      return;
    }
    for (const p of this.players) p.score = 0;
    this.usedWords.clear();
    this.round = 1;
    this.queue = this.connectedPlayers.map((p) => p.id);
    this.system('Oyun başladı! İyi eğlenceler 🎨');
    this.nextTurn();
  }

  restart(playerId: string) {
    if (playerId !== this.hostId || this.phase !== 'gameEnd') return;
    this.backToLobby();
  }

  private backToLobby() {
    this.stopTicker();
    this.phase = 'lobby';
    this.round = 0;
    this.drawerId = null;
    this.word = null;
    this.turnResult = null;
    this.history = [];
    for (const p of this.players) {
      p.score = 0;
      p.guessed = false;
    }
    this.io.to(this.code).emit('draw:history', []);
    this.broadcastState();
  }

  private nextTurn() {
    this.stopTicker();
    let drawer: Player | undefined;
    while (!drawer) {
      if (this.queue.length === 0) {
        this.round++;
        if (this.round > this.settings.rounds) return this.endGame();
        this.queue = this.connectedPlayers.map((p) => p.id);
        if (this.queue.length === 0) return this.backToLobby();
      }
      const id = this.queue.shift()!;
      const p = this.findPlayer(id);
      if (p && p.socketId) drawer = p;
    }

    this.phase = 'choosing';
    this.drawerId = drawer.id;
    this.word = null;
    this.choices = this.pickWords(3);
    this.history = [];
    this.historyPoints = 0;
    this.turnGains = {};
    this.turnResult = null;
    for (const p of this.players) {
      p.guessed = false;
      p.reacted = false;
    }
    this.setPhaseTimer(CHOOSE_MS);
    this.io.to(this.code).emit('draw:history', []);
    this.broadcastState();
    if (drawer.socketId) this.io.to(drawer.socketId).emit('word:choices', this.choices);
  }

  chooseWord(playerId: string, index: number) {
    if (this.phase !== 'choosing' || playerId !== this.drawerId) return;
    const word = this.choices[index];
    if (word) this.beginDrawing(word);
  }

  private beginDrawing(word: string) {
    this.phase = 'drawing';
    this.word = word;
    this.usedWords.add(word);
    this.revealed.clear();
    this.hintsGiven = 0;
    this.setPhaseTimer(this.settings.drawTime * 1000);
    this.broadcastState();
    const drawer = this.drawerId ? this.findPlayer(this.drawerId) : undefined;
    if (drawer?.socketId) this.io.to(drawer.socketId).emit('word:secret', word);
    if (drawer) this.system(`${drawer.name} çiziyor!`);
  }

  private endTurn(reason: TurnResult['reason']) {
    if (this.phase !== 'choosing' && this.phase !== 'drawing') return;
    const word = this.word ?? '';
    this.phase = 'turnEnd';
    this.turnResult = { word, drawerId: this.drawerId, gains: { ...this.turnGains }, reason };
    this.setPhaseTimer(TURN_END_MS);
    if (word) this.system(`Kelime "${word}" idi.`);
    this.broadcastState();
  }

  private endGame() {
    this.stopTicker();
    this.phase = 'gameEnd';
    this.drawerId = null;
    this.word = null;
    this.round = this.settings.rounds;
    const winner = [...this.players].sort((a, b) => b.score - a.score)[0];
    if (winner) this.system(`Oyun bitti! Kazanan: ${winner.name} 🏆`);
    this.broadcastState();
  }

  // ---------- Zamanlayıcı ----------

  private setPhaseTimer(ms: number) {
    this.phaseStart = Date.now();
    this.deadline = this.phaseStart + ms;
    if (!this.ticker) this.ticker = setInterval(() => this.tick(), 250);
  }

  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private tick() {
    const now = Date.now();
    if (this.phase === 'drawing' && this.word) {
      const progress = (now - this.phaseStart) / (this.deadline - this.phaseStart);
      const maxHints = this.maxHints(this.word);
      if (this.hintsGiven < maxHints && progress >= HINT_THRESHOLDS[this.hintsGiven]) {
        this.revealLetter();
      }
    }
    if (now < this.deadline) return;
    if (this.phase === 'choosing') this.beginDrawing(this.choices[Math.floor(Math.random() * this.choices.length)]);
    else if (this.phase === 'drawing') this.endTurn('time');
    else if (this.phase === 'turnEnd') this.nextTurn();
  }

  private maxHints(word: string) {
    const letters = word.replace(/ /g, '').length;
    return letters <= 3 ? 0 : Math.min(HINT_THRESHOLDS.length, Math.floor(letters / 3));
  }

  private revealLetter() {
    if (!this.word) return;
    const hidden = [...this.word].map((c, i) => (c !== ' ' && !this.revealed.has(i) ? i : -1)).filter((i) => i >= 0);
    // Son harfi asla açma: kelimenin tamamı açılmasın.
    if (hidden.length <= 1) return;
    this.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]);
    this.hintsGiven++;
    this.broadcastState();
  }

  // ---------- Kelimeler ----------

  private wordPool(): string[] {
    const custom = this.settings.customWords;
    if (this.settings.category === 'ozel') return custom;
    return [...new Set([...(WORDS[this.settings.category] ?? WORDS.karisik), ...custom])];
  }

  private pickWords(n: number): string[] {
    const pool = this.wordPool();
    let fresh = pool.filter((w) => !this.usedWords.has(w));
    if (fresh.length < n) {
      this.usedWords.clear();
      fresh = pool;
    }
    return pickRandom(fresh, n);
  }

  // ---------- Tahmin & sohbet ----------

  chat(playerId: string, raw: string) {
    const p = this.findPlayer(playerId);
    if (!p || typeof raw !== 'string') return;
    const text = raw.trim().slice(0, 100);
    if (!text) return;

    if (this.phase === 'drawing' && this.word) {
      // Çizen ya da bilen oyuncular sadece kendi aralarında konuşur (kelime sızmasın diye).
      if (p.id === this.drawerId || p.guessed) {
        const msg = this.msg('insider', text, p);
        for (const other of this.players) {
          if (other.socketId && (other.id === this.drawerId || other.guessed)) {
            this.io.to(other.socketId).emit('chat:message', msg);
          }
        }
        return;
      }

      const guess = normalizeGuess(text);
      const target = normalizeGuess(this.word);
      if (guess === target) return this.correctGuess(p);
      if (isClose(guess, target) && p.socketId) {
        this.io.to(p.socketId).emit('chat:message', this.msg('close', `"${text}" çok yakın!`));
      }
    }

    this.io.to(this.code).emit('chat:message', this.msg('chat', text, p));
  }

  private correctGuess(p: Player) {
    const total = this.deadline - this.phaseStart;
    const left = Math.max(0, this.deadline - Date.now());
    const first = !this.players.some((x) => x.guessed);
    const points = Math.round(50 + 250 * (left / total)) + (first ? 50 : 0);
    p.guessed = true;
    p.score += points;
    this.turnGains[p.id] = (this.turnGains[p.id] ?? 0) + points;

    const drawer = this.drawerId ? this.findPlayer(this.drawerId) : undefined;
    if (drawer) {
      drawer.score += 60;
      this.turnGains[drawer.id] = (this.turnGains[drawer.id] ?? 0) + 60;
    }

    this.io.to(this.code).emit('chat:message', this.msg('correct', `${p.name} kelimeyi bildi! (+${points})`));
    if (p.socketId && this.word) this.io.to(p.socketId).emit('word:secret', this.word);
    this.broadcastState();
    this.checkAllGuessed();
  }

  private checkAllGuessed() {
    if (this.phase !== 'drawing') return;
    const guessers = this.connectedPlayers.filter((p) => p.id !== this.drawerId);
    if (guessers.length > 0 && guessers.every((p) => p.guessed)) this.endTurn('allGuessed');
  }

  react(playerId: string, kind: 'like' | 'dislike') {
    const p = this.findPlayer(playerId);
    if (!p || this.phase !== 'drawing' || p.id === this.drawerId || p.reacted) return;
    if (kind !== 'like' && kind !== 'dislike') return;
    p.reacted = true;
    this.io.to(this.code).emit('reaction', { kind, name: p.name });
  }

  // ---------- Çizim ----------

  draw(playerId: string, socket: Sock, op: DrawOp) {
    if (this.phase !== 'drawing' || playerId !== this.drawerId) return;
    const clean = sanitizeOp(op);
    if (!clean) return;
    if (clean.t === 'move') {
      if (this.historyPoints + clean.pts.length > MAX_HISTORY_POINTS) return;
      this.historyPoints += clean.pts.length;
    }
    applyOp(this.history, clean);
    socket.to(this.code).emit('draw:op', clean);
  }

  // ---------- Yayın ----------

  publicState(): RoomState {
    const timed = this.phase === 'choosing' || this.phase === 'drawing' || this.phase === 'turnEnd';
    return {
      code: this.code,
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        guessed: p.guessed,
        connected: p.socketId !== null,
        isHost: p.id === this.hostId,
      })),
      settings: this.settings,
      round: this.round,
      drawerId: this.drawerId,
      hint: this.phase === 'drawing' && this.word
        ? [...this.word].map((c, i) => (c === ' ' ? ' ' : this.revealed.has(i) ? c : '_'))
        : null,
      timeLeftMs: timed ? Math.max(0, this.deadline - Date.now()) : null,
      phaseDurationMs: timed ? this.deadline - this.phaseStart : null,
      turnResult: this.phase === 'turnEnd' ? this.turnResult : null,
    };
  }

  broadcastState() {
    this.io.to(this.code).emit('room:state', this.publicState());
  }

  /** Yeni bağlanan/geri dönen oyuncuya özel bilgileri gönderir. */
  private sendPrivateState(socket: Sock, p: Player) {
    socket.emit('draw:history', this.history);
    if (this.phase === 'choosing' && p.id === this.drawerId) socket.emit('word:choices', this.choices);
    if (this.phase === 'drawing' && this.word && (p.id === this.drawerId || p.guessed)) {
      socket.emit('word:secret', this.word);
    }
  }

  private msg(kind: ChatKind, text: string, from?: Player): ChatMessage {
    return { id: ++this.msgId, kind, text, name: from?.name, color: from?.avatar.color };
  }

  private system(text: string) {
    this.io.to(this.code).emit('chat:message', this.msg('system', text));
  }
}

function sanitizeOp(op: DrawOp): DrawOp | null {
  if (!op || typeof op !== 'object') return null;
  const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : null);
  const color = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
  switch (op.t) {
    case 'start': {
      const x = num(op.x, CANVAS_W), y = num(op.y, CANVAS_H), c = color(op.color), size = num(op.size, 80);
      return x !== null && y !== null && c && size ? { t: 'start', color: c, size, x, y } : null;
    }
    case 'move': {
      if (!Array.isArray(op.pts) || op.pts.length === 0 || op.pts.length > 400 || op.pts.length % 2) return null;
      const pts: number[] = [];
      for (let i = 0; i < op.pts.length; i += 2) {
        const x = num(op.pts[i], CANVAS_W), y = num(op.pts[i + 1], CANVAS_H);
        if (x === null || y === null) return null;
        pts.push(x, y);
      }
      return { t: 'move', pts };
    }
    case 'fill': {
      const x = num(op.x, CANVAS_W - 1), y = num(op.y, CANVAS_H - 1), c = color(op.color);
      return x !== null && y !== null && c ? { t: 'fill', color: c, x, y } : null;
    }
    case 'shape': {
      const x1 = num(op.x1, CANVAS_W), y1 = num(op.y1, CANVAS_H), x2 = num(op.x2, CANVAS_W), y2 = num(op.y2, CANVAS_H);
      const c = color(op.color), size = num(op.size, 80);
      if (x1 === null || y1 === null || x2 === null || y2 === null || !c || !size || !SHAPE_KINDS.includes(op.shape)) return null;
      return { t: 'shape', shape: op.shape, color: c, size, x1, y1, x2, y2 };
    }
    case 'undo':
      return { t: 'undo' };
    case 'clear':
      return { t: 'clear' };
    default:
      return null;
  }
}
