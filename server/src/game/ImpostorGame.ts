// Sahtekâr modu: her turda bir oyuncu gizlice sahtekârdır ve kelimeyi bilmez (sadece kategoriyi bilir).
// Herkes ortak tuvale sırayla tek bir çizgi çizer, sonra sahtekâr oylanır.
// Yakalanan sahtekâr kelimeyi tahmin ederek kurtulabilir.
import type { DrawOp, ImpostorPublic, ImpostorResult, ImpostorRole, ImpostorStage } from '@shared';
import { IMPOSTOR, IMPOSTOR_SCORING } from '../config';
import { pickRandom, randomItem } from '../utils/random';
import { normalizeGuess } from '../utils/text';

export interface ImpostorPlayer {
  id: string;
  name: string;
  socketId: string | null;
}

/** Oyunun odayla konuştuğu noktalar (oyun mantığı socket'lerden habersizdir). */
export interface ImpostorHooks {
  find(id: string): ImpostorPlayer | undefined;
  sendRole(playerId: string, role: ImpostorRole): void;
  changed(): void;
  /** Yeni tur: ortak tuvali temizle. */
  newCanvas(): void;
  pickWord(): { word: string; category: string };
  award(gains: Record<string, number>): void;
  system(text: string): void;
  finished(): void;
}

/** Oylamanın sonucu: en çok oyu tek başına sahtekâr aldıysa yakalanır (beraberlikte kaçar). */
export function isCaught(votes: Record<string, string>, impostorId: string): boolean {
  const counts = new Map<string, number>();
  for (const target of Object.values(votes)) counts.set(target, (counts.get(target) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  if (max === 0) return false;
  const leaders = [...counts].filter(([, n]) => n === max).map(([id]) => id);
  return leaders.length === 1 && leaders[0] === impostorId;
}

/** Tur sonunda kimin kaç puan aldığı. */
export function impostorGains(
  participants: readonly string[],
  impostorId: string,
  votes: Record<string, string>,
  caught: boolean,
  guessedRight: boolean,
): Record<string, number> {
  if (!caught) return { [impostorId]: IMPOSTOR_SCORING.escaped };
  if (guessedRight) return { [impostorId]: IMPOSTOR_SCORING.guessedWord };
  const gains: Record<string, number> = {};
  for (const id of participants) {
    if (id === impostorId) continue;
    gains[id] = IMPOSTOR_SCORING.caught + (votes[id] === impostorId ? IMPOSTOR_SCORING.correctVote : 0);
  }
  return gains;
}

export class ImpostorGame {
  stage: ImpostorStage = 'intro';
  round = 0;

  private readonly participants: readonly string[];
  private pastImpostors = new Set<string>();
  private order: string[] = [];
  private impostorId = '';
  private word = '';
  private category = '';
  /** Toplam sıra sayacı: order.length * laps'e ulaşınca çizim biter. */
  private turn = 0;
  private strokeUsed = false;
  private votes = new Map<string, string>();
  private result: ImpostorResult | null = null;
  private stageStart = 0;
  private stageMs = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    participants: readonly string[],
    private readonly totalRounds: number,
    private readonly hooks: ImpostorHooks,
  ) {
    this.participants = [...participants];
  }

  start(): void {
    this.nextRound();
  }

  // ---------- Tur akışı ----------

  private nextRound(): void {
    const present = this.participants.filter((id) => this.hooks.find(id)?.socketId);
    this.round++;
    if (this.round > this.totalRounds || present.length < IMPOSTOR.minPlayers) {
      this.clearTimer();
      this.hooks.finished();
      return;
    }
    // Herkes sırayla sahtekâr olsun: henüz olmamışlardan rastgele seç.
    let candidates = present.filter((id) => !this.pastImpostors.has(id));
    if (candidates.length === 0) {
      this.pastImpostors.clear();
      candidates = present;
    }
    this.impostorId = randomItem(candidates);
    this.pastImpostors.add(this.impostorId);

    const { word, category } = this.hooks.pickWord();
    this.word = word;
    this.category = category;
    // Rastgele sıra; sahtekâr ilk çizen olmasın (kelimeyi bilmeden ilk çizgi çok zor).
    this.order = pickRandom(present, present.length);
    if (this.order[0] === this.impostorId) this.order.push(this.order.shift() as string);

    this.turn = 0;
    this.votes.clear();
    this.result = null;
    this.hooks.newCanvas();
    for (const id of this.participants) this.sendRoleTo(id);
    this.setStage('intro', IMPOSTOR.introMs, () => this.startDrawing());
  }

  private startDrawing(): void {
    this.turn = -1;
    this.nextTurn();
  }

  private nextTurn(): void {
    // Bağlı olmayanların sırasını atla.
    do this.turn++;
    while (this.turn < this.totalTurns && !this.hooks.find(this.currentDrawer() ?? '')?.socketId);

    if (this.turn >= this.totalTurns) {
      this.setStage('vote', IMPOSTOR.voteMs, () => this.resolveVote());
      return;
    }
    this.strokeUsed = false;
    this.setStage('draw', IMPOSTOR.turnMs, () => this.nextTurn());
  }

  private get totalTurns(): number {
    return this.order.length * IMPOSTOR.laps;
  }

  private currentDrawer(): string | null {
    return this.stage === 'draw' || this.stage === 'intro' ? (this.order[this.turn % this.order.length] ?? null) : null;
  }

  private resolveVote(): void {
    const votes = Object.fromEntries(this.votes);
    if (!isCaught(votes, this.impostorId)) {
      this.finishRound(false);
      return;
    }
    if (!this.hooks.find(this.impostorId)) {
      this.finishRound(false);
      return;
    }
    this.hooks.system('Sahtekâr yakalandı! 🕵️ Kelimeyi tahmin ederse kurtulacak…');
    this.setStage('guess', IMPOSTOR.guessMs, () => this.finishRound(false));
  }

  private finishRound(guessedRight: boolean, guess: string | null = null): void {
    const votes = Object.fromEntries(this.votes);
    const caught = isCaught(votes, this.impostorId);
    const gains = impostorGains(this.participants, this.impostorId, votes, caught, guessedRight);
    this.hooks.award(gains);
    this.result = { impostorId: this.impostorId, word: this.word, votes, caught, guess, guessedRight, gains };
    const name = this.hooks.find(this.impostorId)?.name ?? 'Sahtekâr';
    this.hooks.system(
      !caught
        ? `${name} sahtekârdı ve kaçtı! 🕵️ Kelime "${this.word}" idi.`
        : guessedRight
          ? `${name} yakalandı ama kelimeyi bildi: "${this.word}"!`
          : `${name} yakalandı! Kelime "${this.word}" idi. 🎉`,
    );
    this.setStage('result', IMPOSTOR.resultMs, () => this.nextRound());
  }

  // ---------- Oyuncu işlemleri ----------

  /** Bu oyuncunun çizme sırası mı? */
  isTurnOf(playerId: string): boolean {
    return this.stage === 'draw' && this.currentDrawer() === playerId;
  }

  /** Sırada tek bir çizgi/şekil/boya hakkı var; geri alma ve temizleme yok (başkasının çizimini silmesin). */
  allowOp(playerId: string, op: DrawOp): boolean {
    if (!this.isTurnOf(playerId)) return false;
    if (op.t === 'start' || op.t === 'shape' || op.t === 'fill') return !this.strokeUsed;
    if (op.t === 'move') return this.strokeUsed;
    return false;
  }

  /** Kabul edilen işlemden sonra: hak kullanıldı; şekil/boya tek hamlede biter. */
  afterOp(op: DrawOp): void {
    if (op.t === 'start' || op.t === 'shape' || op.t === 'fill') this.strokeUsed = true;
    if (op.t === 'shape' || op.t === 'fill') this.setStage('draw', IMPOSTOR.afterShapeMs, () => this.nextTurn(), false);
  }

  /** Sırası gelen oyuncu çizgisini bitirdi (ya da pas geçti). */
  done(playerId: string): void {
    if (this.isTurnOf(playerId)) this.nextTurn();
  }

  vote(playerId: string, targetId: string): void {
    if (this.stage !== 'vote' || !this.order.includes(playerId) || !this.order.includes(targetId)) return;
    if (playerId === targetId) return;
    this.votes.set(playerId, targetId);
    this.hooks.changed();
    this.resolveIfEveryoneVoted();
  }

  guessWord(playerId: string, text: string): void {
    if (this.stage !== 'guess' || playerId !== this.impostorId) return;
    this.finishRound(normalizeGuess(text) === normalizeGuess(this.word), text);
  }

  /** Bağlantı değişti: sırası gelen ayrıldıysa geç, oylama/tahmin bekliyorsa yeniden değerlendir. */
  onPresenceChange(): void {
    // Anlık kopmalarda süre dolana kadar beklenir; sadece odadan tamamen çıkan oyuncu atlanır.
    if (this.stage === 'draw') {
      const drawer = this.currentDrawer();
      if (drawer && !this.hooks.find(drawer)) this.nextTurn();
    } else if (this.stage === 'vote') {
      this.resolveIfEveryoneVoted();
    } else if (this.stage === 'guess' && !this.hooks.find(this.impostorId)) {
      this.finishRound(false);
    }
  }

  private resolveIfEveryoneVoted(): void {
    const voters = this.order.filter((id) => this.hooks.find(id));
    if (voters.length > 0 && voters.every((id) => this.votes.has(id))) this.resolveVote();
  }

  /** Metin kelimeyi ele veriyor mu? (Sohbette kelimeyi yazmak sahtekâra cevabı verir.) */
  revealsWord(text: string): boolean {
    if (this.stage === 'result' || !this.word) return false;
    const target = normalizeGuess(this.word);
    return target.length > 0 && normalizeGuess(text).includes(target);
  }

  // ---------- Durum ----------

  roleFor(playerId: string): ImpostorRole | null {
    if (!this.participants.includes(playerId) || !this.order.includes(playerId)) return null;
    const isImpostor = playerId === this.impostorId;
    return { round: this.round, isImpostor, word: isImpostor ? null : this.word, category: this.category };
  }

  private sendRoleTo(playerId: string): void {
    const role = this.roleFor(playerId);
    if (role) this.hooks.sendRole(playerId, role);
  }

  publicState(): ImpostorPublic {
    return {
      round: this.round,
      totalRounds: this.totalRounds,
      stage: this.stage,
      order: [...this.order],
      turnPlayerId: this.stage === 'draw' ? this.currentDrawer() : null,
      lap: Math.min(IMPOSTOR.laps, Math.floor(Math.max(0, this.turn) / Math.max(1, this.order.length)) + 1),
      totalLaps: IMPOSTOR.laps,
      category: this.category,
      voted: [...this.votes.keys()],
      result: this.result,
    };
  }

  timing(): { timeLeftMs: number; durationMs: number } {
    return { timeLeftMs: Math.max(0, this.stageStart + this.stageMs - Date.now()), durationMs: this.stageMs };
  }

  dispose(): void {
    this.clearTimer();
  }

  /** Aşamayı değiştirir, süre sayacını kurar ve herkese bildirir. `resetClock` false ise ekrandaki süre değişmez. */
  private setStage(stage: ImpostorStage, ms: number, onTimeout: () => void, resetClock = true): void {
    this.stage = stage;
    if (resetClock) {
      this.stageStart = Date.now();
      this.stageMs = ms;
    }
    this.clearTimer();
    this.timer = setTimeout(onTimeout, ms);
    this.hooks.changed();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
