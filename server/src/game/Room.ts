// Tek bir oyun odasının durumu ve kuralları.
// Gelen veriler bu sınıfa ulaşmadan önce socket katmanında doğrulanmış olur (bkz. validation/).

import {
  type Avatar,
  type ChatKind,
  type ChatMessage,
  type ClientToServer,
  CUSTOM_ONLY_CATEGORY,
  DEFAULT_SETTINGS,
  type DrawOp,
  GAME_MODES,
  type Phase,
  type ReactionKind,
  type RoomState,
  type ServerToClient,
  type Settings,
  type TurnResult,
} from '@shared';
import type { Server, Socket } from 'socket.io';
import { TIMING } from '../config';
import { randomId, randomItem } from '../utils/random';
import { isClose, normalizeGuess } from '../utils/text';
import { applySettings } from '../validation/settings';
import { DrawingBuffer } from './DrawingBuffer';
import { hintsDue, maskWord, maxHints, revealableIndexes } from './hints';
import { ImpostorGame } from './ImpostorGame';
import { DRAWER_POINTS_PER_GUESS, guessPoints } from './scoring';
import { TelephoneGame } from './TelephoneGame';
import { categoryOf, pickWords, wordPool } from './wordPicker';

export type IO = Server<ClientToServer, ServerToClient>;
export type GameSocket = Socket<ClientToServer, ServerToClient>;

export interface Player {
  /** Herkese açık kimlik (rastgele). */
  id: string;
  /** Gizli oturum anahtarı: yeniden bağlanırken oyuncuyu tanımak için. Asla yayınlanmaz. */
  sessionId: string;
  socketId: string | null;
  name: string;
  avatar: Avatar;
  score: number;
  guessed: boolean;
  reacted: boolean;
  leaveTimer: NodeJS.Timeout | null;
}

export type JoinResult = { ok: true; playerId: string } | { ok: false; error: string };

const isActiveTurn = (phase: Phase) => phase === 'choosing' || phase === 'drawing';
const isInGame = (phase: Phase) => phase !== 'lobby' && phase !== 'gameEnd';
const isTelephone = (phase: Phase) => phase === 'telephone' || phase === 'reveal';

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
  private phaseStart = 0;
  private deadline = 0;
  private ticker: NodeJS.Timeout | null = null;
  /** Klasik modda odanın ortak tuvali. */
  private canvas = new DrawingBuffer();
  /** Kırık Telefon oyunu (sadece o modda). */
  private telephone: TelephoneGame | null = null;
  /** Sahtekâr oyunu (sadece o modda). */
  private impostor: ImpostorGame | null = null;
  private usedWords = new Set<string>();
  private turnGains: Record<string, number> = {};
  private turnResult: TurnResult | null = null;
  private msgId = 0;
  /** Bağlantısı kopan çizenin dönmesini bekleyen zamanlayıcı. */
  private drawerGraceTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly io: IO,
    readonly code: string,
    private readonly onEmpty: (room: Room) => void,
  ) {}

  // ---------- Oyuncu yönetimi ----------

  get connectedPlayers(): Player[] {
    return this.players.filter((p) => p.socketId !== null);
  }

  findPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  /** Oyuncuyu odaya ekler ya da aynı oturum anahtarıyla gelen oyuncuyu yeniden bağlar. */
  join(socket: GameSocket, sessionId: string, name: string, avatar: Avatar): JoinResult {
    let player = this.players.find((p) => p.sessionId === sessionId);

    if (player) {
      if (player.leaveTimer) clearTimeout(player.leaveTimer);
      player.leaveTimer = null;
      const previousSocket = player.socketId;
      if (previousSocket && previousSocket !== socket.id) {
        // Aynı oyuncu başka bir bağlantıdan döndü: eski bağlantı artık odanın yayınlarını almasın.
        this.io.in(previousSocket).socketsLeave(this.code);
      }
      player.socketId = socket.id;
      if (player.id === this.drawerId) this.clearDrawerGrace();
      // Geri dönen oyuncu odadaki adını/avatarını korur.
      if (!previousSocket) this.system(`${player.name} geri döndü.`);
    } else {
      if (this.players.length >= this.settings.maxPlayers) return { ok: false, error: 'Oda dolu.' };
      player = {
        id: randomId(),
        sessionId,
        socketId: socket.id,
        name,
        avatar,
        score: 0,
        guessed: false,
        reacted: false,
        leaveTimer: null,
      };
      this.players.push(player);
      this.system(`${name} odaya katıldı.`);
    }

    if (!this.hostId || !this.findPlayer(this.hostId)) this.hostId = player.id;
    socket.join(this.code);
    this.broadcastState();
    this.sendPrivateState(socket, player);
    return { ok: true, playerId: player.id };
  }

  /** Bağlantı koptu: oyuncunun geri dönmesi için kısa bir süre bekle. */
  disconnect(playerId: string): void {
    const p = this.findPlayer(playerId);
    if (!p) return;
    p.socketId = null;
    p.leaveTimer = setTimeout(() => this.remove(playerId), TIMING.reconnectGraceMs);

    if (p.id === this.drawerId && isActiveTurn(this.phase)) {
      // Kısa kopmalarda (tünel, ağ değişimi) turu hemen bitirme: çizenin dönmesini bekle.
      this.system(`${p.name} (çizen) bağlantıyı kaybetti, bekleniyor…`);
      this.clearDrawerGrace();
      this.drawerGraceTimer = setTimeout(() => {
        this.drawerGraceTimer = null;
        const drawer = this.drawerId ? this.findPlayer(this.drawerId) : undefined;
        if (drawer && !drawer.socketId && isActiveTurn(this.phase)) {
          this.endTurn('drawerLeft');
        }
      }, TIMING.drawerGraceMs);
    } else {
      // Oyuncu sayısını hemen kontrol etme: sayfayı yenileyen oyuncu birkaç saniyede döner.
      // Gerçekten ayrıldıysa süre dolunca remove() bunu halleder.
      this.checkAllGuessed();
    }
    this.reassignHost();
    this.telephone?.onPresenceChange();
    this.impostor?.onPresenceChange();
    this.broadcastState();
  }

  /** Oyuncuyu odadan tamamen çıkarır. */
  remove(playerId: string, socket?: GameSocket): void {
    const p = this.findPlayer(playerId);
    if (!p) return;
    if (p.leaveTimer) clearTimeout(p.leaveTimer);
    socket?.leave(this.code);
    this.players = this.players.filter((x) => x.id !== playerId);
    this.queue = this.queue.filter((id) => id !== playerId);
    this.system(`${p.name} odadan ayrıldı.`);

    if (this.players.length === 0) {
      this.dispose();
      this.onEmpty(this);
      return;
    }
    this.reassignHost();
    if (p.id === this.drawerId && isActiveTurn(this.phase)) {
      this.endTurn('drawerLeft');
    } else {
      this.checkEnoughPlayers();
      this.checkAllGuessed();
    }
    this.telephone?.onPresenceChange();
    this.impostor?.onPresenceChange();
    this.broadcastState();
  }

  /** Odanın zamanlayıcılarını durdurur (oda kapanırken). */
  dispose(): void {
    this.stopTicker();
    this.clearDrawerGrace();
    this.telephone?.dispose();
    this.impostor?.dispose();
    for (const p of this.players) if (p.leaveTimer) clearTimeout(p.leaveTimer);
  }

  private clearDrawerGrace(): void {
    if (this.drawerGraceTimer) clearTimeout(this.drawerGraceTimer);
    this.drawerGraceTimer = null;
  }

  private reassignHost(): void {
    const host = this.hostId ? this.findPlayer(this.hostId) : undefined;
    if (host?.socketId) return;
    const next = this.connectedPlayers[0];
    if (next && next.id !== this.hostId) {
      this.hostId = next.id;
      this.system(`${next.name} artık oda sahibi.`);
      this.sendCustomWords(next);
    }
  }

  private checkEnoughPlayers(): void {
    if (!isInGame(this.phase)) return;
    if (this.connectedPlayers.length < 2) {
      this.system('Yeterli oyuncu kalmadı, lobiye dönülüyor.');
      this.backToLobby();
    }
  }

  // ---------- Ayarlar & oyun akışı ----------

  updateSettings(playerId: string, input: unknown): void {
    if (playerId !== this.hostId || this.phase !== 'lobby') return;
    this.settings = applySettings(this.settings, input, this.players.length);
    this.broadcastState();
    const host = this.findPlayer(playerId);
    if (host) this.sendCustomWords(host);
  }

  start(playerId: string): void {
    if (playerId !== this.hostId || this.phase !== 'lobby') return;
    const mode = GAME_MODES.find((m) => m.id === this.settings.mode) ?? GAME_MODES[0];
    if (this.connectedPlayers.length < mode.minPlayers) {
      this.system(`${mode.name} için en az ${mode.minPlayers} oyuncu gerekli.`);
      return;
    }
    if (wordPool(this.settings).length < 3) {
      this.system('Oyunu başlatmak için en az 3 kelime gerekli.');
      return;
    }
    for (const p of this.players) p.score = 0;
    if (this.settings.mode === 'telephone') {
      this.startTelephone();
      return;
    }
    if (this.settings.mode === 'impostor') {
      this.startImpostor();
      return;
    }
    this.usedWords.clear();
    this.round = 1;
    this.queue = this.connectedPlayers.map((p) => p.id);
    this.system('Oyun başladı! İyi eğlenceler 🎨');
    this.nextTurn();
  }

  restart(playerId: string): void {
    if (playerId !== this.hostId || this.phase !== 'gameEnd') return;
    this.backToLobby();
  }

  chooseWord(playerId: string, index: number): void {
    if (this.phase !== 'choosing' || playerId !== this.drawerId) return;
    const word = this.choices[index];
    if (word) this.beginDrawing(word);
  }

  private backToLobby(): void {
    this.stopTicker();
    this.clearDrawerGrace();
    this.telephone?.dispose();
    this.telephone = null;
    this.impostor?.dispose();
    this.impostor = null;
    this.phase = 'lobby';
    this.round = 0;
    this.drawerId = null;
    this.word = null;
    this.turnResult = null;
    this.canvas.reset();
    for (const p of this.players) {
      p.score = 0;
      p.guessed = false;
    }
    this.io.to(this.code).emit('draw:history', []);
    this.broadcastState();
  }

  private nextTurn(): void {
    this.stopTicker();
    const drawer = this.nextDrawer();
    if (drawer === 'gameOver') {
      this.endGame();
      return;
    }
    if (!drawer) {
      this.backToLobby();
      return;
    }

    this.phase = 'choosing';
    this.drawerId = drawer.id;
    this.word = null;
    this.choices = pickWords(wordPool(this.settings), this.usedWords, 3);
    this.canvas.reset();
    this.turnGains = {};
    this.turnResult = null;
    for (const p of this.players) {
      p.guessed = false;
      p.reacted = false;
    }
    this.setPhaseTimer(TIMING.chooseMs);
    this.io.to(this.code).emit('draw:history', []);
    this.broadcastState();
    this.emitTo(drawer, 'word:choices', this.choices);
  }

  /** Sıradaki çizeni bulur; tur biterse yeni tura geçer. Oyun bittiyse 'gameOver'. */
  private nextDrawer(): Player | 'gameOver' | null {
    for (;;) {
      if (this.queue.length === 0) {
        this.round++;
        if (this.round > this.settings.rounds) return 'gameOver';
        this.queue = this.connectedPlayers.map((p) => p.id);
        if (this.queue.length === 0) return null;
      }
      const p = this.findPlayer(this.queue.shift() as string);
      if (p?.socketId) return p;
    }
  }

  private beginDrawing(word: string): void {
    this.phase = 'drawing';
    this.word = word;
    this.usedWords.add(word);
    this.revealed.clear();
    this.setPhaseTimer(this.settings.drawTime * 1000);
    this.broadcastState();
    const drawer = this.drawerId ? this.findPlayer(this.drawerId) : undefined;
    if (drawer) {
      this.emitTo(drawer, 'word:secret', word);
      this.system(`${drawer.name} çiziyor!`);
    }
  }

  private endTurn(reason: TurnResult['reason']): void {
    if (!isActiveTurn(this.phase)) return;
    this.clearDrawerGrace();
    const word = this.word ?? '';
    this.phase = 'turnEnd';
    this.turnResult = { word, drawerId: this.drawerId, gains: { ...this.turnGains }, reason };
    this.setPhaseTimer(TIMING.turnEndMs);
    if (word) this.system(`Kelime "${word}" idi.`);
    this.broadcastState();
  }

  private endGame(): void {
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

  private setPhaseTimer(ms: number): void {
    this.phaseStart = Date.now();
    this.deadline = this.phaseStart + ms;
    if (!this.ticker) this.ticker = setInterval(() => this.tick(), TIMING.tickMs);
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private tick(): void {
    const now = Date.now();
    if (this.phase === 'drawing' && this.word) this.updateHints(now);
    if (now < this.deadline) return;
    if (this.phase === 'choosing') this.beginDrawing(randomItem(this.choices));
    else if (this.phase === 'drawing') this.endTurn('time');
    else if (this.phase === 'turnEnd') this.nextTurn();
  }

  private updateHints(now: number): void {
    if (!this.word) return;
    const progress = (now - this.phaseStart) / (this.deadline - this.phaseStart);
    if (this.revealed.size >= Math.min(hintsDue(this.word, progress), maxHints(this.word))) return;
    const candidates = revealableIndexes(this.word, this.revealed);
    if (candidates.length === 0) return;
    this.revealed.add(randomItem(candidates));
    this.broadcastState();
  }

  // ---------- Tahmin & sohbet ----------

  /** `text` socket katmanında temizlenmiş olmalı. */
  chat(playerId: string, text: string): void {
    const p = this.findPlayer(playerId);
    if (!p) return;

    if (this.impostor?.revealsWord(text)) {
      this.emitTo(p, 'chat:message', this.msg('close', 'Kelimeyi yazamazsın, sahtekâr görür! 🤫'));
      return;
    }

    if (this.phase === 'drawing' && this.word) {
      // Çizen ve bilenler sadece kendi aralarında konuşur: kelime sızmasın.
      if (p.id === this.drawerId || p.guessed) {
        const msg = this.msg('insider', text, p);
        for (const other of this.players) {
          if (other.id === this.drawerId || other.guessed) this.emitTo(other, 'chat:message', msg);
        }
        return;
      }

      const guess = normalizeGuess(text);
      const target = normalizeGuess(this.word);
      if (guess === target) {
        this.correctGuess(p);
        return;
      }
      if (isClose(guess, target)) this.emitTo(p, 'chat:message', this.msg('close', `"${text}" çok yakın!`));
    }

    this.io.to(this.code).emit('chat:message', this.msg('chat', text, p));
  }

  private correctGuess(p: Player): void {
    const isFirst = !this.players.some((x) => x.guessed);
    const points = guessPoints(this.deadline - Date.now(), this.deadline - this.phaseStart, isFirst);
    p.guessed = true;
    this.addPoints(p, points);

    const drawer = this.drawerId ? this.findPlayer(this.drawerId) : undefined;
    if (drawer) this.addPoints(drawer, DRAWER_POINTS_PER_GUESS);

    this.io.to(this.code).emit('chat:message', this.msg('correct', `${p.name} kelimeyi bildi! (+${points})`));
    if (this.word) this.emitTo(p, 'word:secret', this.word);
    this.broadcastState();
    this.checkAllGuessed();
  }

  private addPoints(p: Player, points: number): void {
    p.score += points;
    this.turnGains[p.id] = (this.turnGains[p.id] ?? 0) + points;
  }

  private checkAllGuessed(): void {
    if (this.phase !== 'drawing') return;
    // Bağlantısı anlık kopanlar da tahmin edecek sayılır: kısa kopmada tur erkenden bitmesin.
    // Gerçekten ayrılan oyuncu remove() ile listeden çıkar.
    const guessers = this.players.filter((p) => p.id !== this.drawerId);
    if (guessers.length > 0 && guessers.every((p) => p.guessed)) this.endTurn('allGuessed');
  }

  react(playerId: string, kind: ReactionKind): void {
    const p = this.findPlayer(playerId);
    if (!p || this.phase !== 'drawing' || p.id === this.drawerId || p.reacted) return;
    p.reacted = true;
    this.io.to(this.code).emit('reaction', { kind, name: p.name });
  }

  // ---------- Çizim ----------

  /** Sadece sıradaki çizen, çizim aşamasında çizebilir. `op` doğrulanmış olmalı. */
  canDraw(playerId: string): boolean {
    if (this.impostor) return this.impostor.isTurnOf(playerId);
    return this.phase === 'drawing' && playerId === this.drawerId;
  }

  /**
   * Çizim işlemini geçmişe ekleyip diğer oyunculara iletir. Kabul edilmezse false döner;
   * bu durumda çağıran, çizenin ekranını sunucudaki geçmişle yeniden eşitlemelidir.
   */
  draw(socket: GameSocket, playerId: string, op: DrawOp): boolean {
    const allowed = this.impostor ? this.impostor.allowOp(playerId, op) : this.canDraw(playerId);
    if (!allowed || !this.canvas.apply(op)) return false;
    socket.to(this.code).emit('draw:op', op);
    this.impostor?.afterOp(op);
    return true;
  }

  /** İşlem odaya ulaşmadan reddedildi (ör. istek sınırı): açık çizgiyi kapat. */
  rejectDraw(): void {
    this.canvas.reject();
  }

  /** Sunucudaki çizim geçmişini bir oyuncuya yeniden gönderir (ekranı eşitlemek için). */
  sendHistory(socket: GameSocket): void {
    socket.emit('draw:history', this.canvas.items);
  }

  /** Oyuncunun ekranındaki tahtayı sunucudaki çizimle eşitler: Kırık Telefon'da kendi taslağı, diğerlerinde ortak tuval. */
  syncDrawing(socket: GameSocket, playerId: string): void {
    const draft = this.telephone?.draftOf(playerId);
    socket.emit('draw:history', draft ?? this.canvas.items);
  }

  /** Socket'i odanın yayınlarından çıkarır (oyuncuya dokunmadan). */
  leaveChannel(socket: GameSocket): void {
    socket.leave(this.code);
  }

  /** Bu socket, oyuncunun şu anki (en son) bağlantısı mı? Eski sekmeler işlem yapamasın. */
  isActiveSocket(playerId: string, socketId: string): boolean {
    return this.findPlayer(playerId)?.socketId === socketId;
  }

  // ---------- Kırık Telefon ----------

  private startTelephone(): void {
    this.stopTicker();
    this.round = 1;
    this.drawerId = null;
    this.canvas.reset();
    this.phase = 'telephone';
    this.telephone = new TelephoneGame(
      this.connectedPlayers.map((p) => p.id),
      this.settings.drawTime * 1000,
      {
        find: (id) => this.findPlayer(id),
        sendTask: (id, task) => {
          const p = this.findPlayer(id);
          if (p) this.emitTo(p, 'tp:task', task);
        },
        broadcastReveal: (data) => this.io.to(this.code).emit('tp:reveal', data),
        changed: () => {
          if (this.telephone) this.phase = this.telephone.phase === 'play' ? 'telephone' : 'reveal';
          this.broadcastState();
        },
        randomPrompt: () => randomItem(wordPool(this.settings)),
        finished: (laughs) => this.endTelephone(laughs),
      },
    );
    this.system('Kırık Telefon başladı! Önce herkes bir şey yazsın ✍️');
    this.telephone.start();
  }

  private endTelephone(laughs: Record<string, number>): void {
    this.telephone?.dispose();
    this.telephone = null;
    for (const p of this.players) p.score = laughs[p.id] ?? 0;
    this.phase = 'gameEnd';
    const top = [...this.players].sort((a, b) => b.score - a.score)[0];
    this.system(top && top.score > 0 ? `Günün Komedyeni: ${top.name} 😂` : 'Kırık Telefon bitti! 📞');
    this.broadcastState();
  }

  /** `text` socket katmanında temizlenmiş olmalı (çizim adımında null). */
  telephoneSubmit(playerId: string, step: number, text: string | null): void {
    this.telephone?.submit(playerId, step, text);
  }

  /** Çizim adımında oyuncunun kendi tuvaline işlem; kabul edilmezse false. */
  telephoneDraw(playerId: string, step: number, op: DrawOp): boolean {
    return this.telephone?.draw(playerId, step, op) ?? false;
  }

  telephoneRejectDraw(playerId: string): void {
    this.telephone?.rejectDraw(playerId);
  }

  /** Oyuncunun ekranını sunucudaki yarım çizimiyle eşitler. */
  telephoneResync(socket: GameSocket, playerId: string): void {
    const draft = this.telephone?.draftOf(playerId);
    if (draft) socket.emit('draw:history', draft);
  }

  telephoneNext(playerId: string): void {
    if (playerId === this.hostId) this.telephone?.next();
  }

  telephoneLaugh(playerId: string): void {
    this.telephone?.laugh(playerId);
  }

  // ---------- Sahtekâr ----------

  private startImpostor(): void {
    this.stopTicker();
    this.round = 1;
    this.drawerId = null;
    this.usedWords.clear();
    this.phase = 'impostor';
    this.impostor = new ImpostorGame(
      this.connectedPlayers.map((p) => p.id),
      this.settings.rounds,
      {
        find: (id) => this.findPlayer(id),
        sendRole: (id, role) => {
          const p = this.findPlayer(id);
          if (p) this.emitTo(p, 'imp:role', role);
        },
        changed: () => {
          if (this.impostor) this.round = this.impostor.round;
          this.broadcastState();
        },
        newCanvas: () => {
          this.canvas.reset();
          this.io.to(this.code).emit('draw:history', []);
        },
        pickWord: () => {
          const [word] = pickWords(wordPool(this.settings), this.usedWords, 1);
          this.usedWords.add(word);
          return { word, category: this.settings.category === CUSTOM_ONLY_CATEGORY ? 'Özel kelime' : categoryOf(word) };
        },
        award: (gains) => {
          for (const [id, points] of Object.entries(gains)) {
            const p = this.findPlayer(id);
            if (p) p.score += points;
          }
        },
        system: (text) => this.system(text),
        finished: () => this.endImpostor(),
      },
    );
    this.system('Sahtekâr başladı! Aranızda kelimeyi bilmeyen biri var 🕵️');
    this.impostor.start();
  }

  private endImpostor(): void {
    this.impostor?.dispose();
    this.impostor = null;
    this.phase = 'gameEnd';
    this.round = this.settings.rounds;
    const winner = [...this.players].sort((a, b) => b.score - a.score)[0];
    if (winner) this.system(`Oyun bitti! Kazanan: ${winner.name} 🏆`);
    this.broadcastState();
  }

  impostorDone(playerId: string): void {
    this.impostor?.done(playerId);
  }

  impostorVote(playerId: string, targetId: string): void {
    this.impostor?.vote(playerId, targetId);
  }

  /** `text` socket katmanında temizlenmiş olmalı. */
  impostorGuess(playerId: string, text: string): void {
    this.impostor?.guessWord(playerId, text);
  }

  // ---------- Yayın ----------

  publicState(): RoomState {
    const modeTiming =
      this.phase === 'telephone' ? this.telephone?.timing() : this.phase === 'impostor' ? this.impostor?.timing() : null;
    const timed = isInGame(this.phase) && !isTelephone(this.phase) && this.phase !== 'impostor';
    const { customWords, ...settings } = this.settings;
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
      settings: { ...settings, customWordCount: customWords.length },
      round: this.round,
      drawerId: this.drawerId,
      hint: this.phase === 'drawing' && this.word ? maskWord(this.word, this.revealed) : null,
      timeLeftMs: modeTiming ? modeTiming.timeLeftMs : timed ? Math.max(0, this.deadline - Date.now()) : null,
      phaseDurationMs: modeTiming ? modeTiming.durationMs : timed ? this.deadline - this.phaseStart : null,
      turnResult: this.phase === 'turnEnd' ? this.turnResult : null,
      telephone: this.telephone && isTelephone(this.phase) ? this.telephone.publicState() : null,
      impostor: this.impostor && this.phase === 'impostor' ? this.impostor.publicState() : null,
    };
  }

  broadcastState(): void {
    this.io.to(this.code).emit('room:state', this.publicState());
  }

  /** Yeni bağlanan/geri dönen oyuncuya sadece onu ilgilendiren bilgileri gönderir. */
  private sendPrivateState(socket: GameSocket, p: Player): void {
    const draft = this.telephone?.draftOf(p.id);
    socket.emit('draw:history', draft ?? this.canvas.items);
    if (this.telephone && this.phase === 'telephone') {
      const task = this.telephone.taskFor(p.id);
      if (task) socket.emit('tp:task', task);
    }
    if (this.impostor && this.phase === 'impostor') {
      const role = this.impostor.roleFor(p.id);
      if (role) socket.emit('imp:role', role);
    }
    if (this.telephone && this.phase === 'reveal') {
      const data = this.telephone.revealData();
      if (data) socket.emit('tp:reveal', data);
    }
    if (p.id === this.hostId) socket.emit('room:customWords', this.settings.customWords);
    if (this.phase === 'choosing' && p.id === this.drawerId) socket.emit('word:choices', this.choices);
    if (this.phase === 'drawing' && this.word && (p.id === this.drawerId || p.guessed)) {
      socket.emit('word:secret', this.word);
    }
  }

  private sendCustomWords(host: Player): void {
    this.emitTo(host, 'room:customWords', this.settings.customWords);
  }

  private emitTo<E extends keyof ServerToClient>(p: Player, event: E, ...args: Parameters<ServerToClient[E]>): void {
    if (p.socketId) this.io.to(p.socketId).emit(event, ...args);
  }

  private msg(kind: ChatKind, text: string, from?: Player): ChatMessage {
    return { id: ++this.msgId, kind, text, name: from?.name, color: from?.avatar.color };
  }

  private system(text: string): void {
    this.io.to(this.code).emit('chat:message', this.msg('system', text));
  }
}
