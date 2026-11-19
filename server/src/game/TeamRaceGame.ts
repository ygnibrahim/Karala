// Çizim Yarışı (takım modu): iki takımdan birer çizen AYNI kelimeyi aynı anda kendi takımına çizer.
// Her takım sadece kendi tuvalini ve kendi sohbetini görür. Kelimeyi ilk bilen takım turu kazanır;
// tur sonunda iki çizim de herkese gösterilir.
import { type DrawItem, type DrawOp, TEAM_IDS, type TeamId, type TeamRacePublic, type TeamRaceStage } from '@shared';
import { TEAM_SCORING, TEAMS, TIMING } from '../config';
import { randomItem } from '../utils/random';
import { isClose, normalizeGuess } from '../utils/text';
import { DrawingBuffer } from './DrawingBuffer';
import { hintsDue, maskWord, maxHints, revealableIndexes } from './hints';

export interface TeamRacePlayer {
  id: string;
  name: string;
  socketId: string | null;
}

/** Sohbet mesajının ne olacağı: oda bu karara göre kime ileteceğini seçer. */
export type TeamChatAction =
  | { kind: 'team'; team: TeamId }
  | { kind: 'all' }
  | { kind: 'blocked' }
  | { kind: 'close' }
  | { kind: 'correct' };

/** Oyunun odayla konuştuğu noktalar (oyun mantığı socket'lerden habersizdir). */
export interface TeamRaceHooks {
  find(id: string): TeamRacePlayer | undefined;
  /** Takımın şu anki üyeleri (oda sırasıyla). */
  members(team: TeamId): string[];
  sendSecret(playerId: string, word: string): void;
  /** Bir takımın tuvali değişti (yeni tur: boş tuval). */
  sendHistory(team: TeamId, items: DrawItem[]): void;
  changed(): void;
  pickWord(): string;
  award(playerId: string, points: number): void;
  system(text: string): void;
  finished(score: Record<TeamId, number>): void;
}

export const otherTeam = (team: TeamId): TeamId => (team === 'red' ? 'blue' : 'red');

export class TeamRaceGame {
  stage: TeamRaceStage = 'intro';
  turn = 0;
  readonly score: Record<TeamId, number> = { red: 0, blue: 0 };

  private readonly canvases: Record<TeamId, DrawingBuffer> = { red: new DrawingBuffer(), blue: new DrawingBuffer() };
  /** Her takımda sıradaki çizenin sırası. */
  private drawCount: Record<TeamId, number> = { red: 0, blue: 0 };
  private drawers: Record<TeamId, string | null> = { red: null, blue: null };
  private word = '';
  private revealed = new Set<number>();
  private result: TeamRacePublic['result'] = null;
  private stageStart = 0;
  private stageMs = 0;
  private timer: NodeJS.Timeout | null = null;
  private ticker: NodeJS.Timeout | null = null;

  constructor(
    readonly totalTurns: number,
    private readonly drawTimeMs: number,
    private readonly hooks: TeamRaceHooks,
  ) {}

  start(): void {
    this.nextTurn();
  }

  // ---------- Tur akışı ----------

  private nextTurn(): void {
    this.turn++;
    if (this.turn > this.totalTurns || !this.teamsPlayable()) {
      this.finish();
      return;
    }
    this.word = this.hooks.pickWord();
    this.revealed.clear();
    this.result = null;
    for (const team of TEAM_IDS) {
      this.drawers[team] = this.nextDrawer(team);
      this.canvases[team].reset();
      this.hooks.sendHistory(team, []);
    }
    // Önce yeni tur durumu gitsin (istemci önceki turun kelimesini silsin), sonra çizenlere kelime.
    this.setStage('intro', TEAMS.introMs, () => this.startDrawing());
    for (const team of TEAM_IDS) {
      const drawer = this.drawers[team];
      if (drawer) this.hooks.sendSecret(drawer, this.word);
    }
  }

  /** Takımda sırası gelen ve bağlı olan ilk oyuncu. */
  private nextDrawer(team: TeamId): string | null {
    const members = this.hooks.members(team);
    for (let i = 0; i < members.length; i++) {
      const id = members[(this.drawCount[team] + i) % members.length];
      if (this.hooks.find(id)?.socketId) {
        this.drawCount[team] += i + 1;
        return id;
      }
    }
    return null;
  }

  private startDrawing(): void {
    this.setStage('draw', this.drawTimeMs, () => this.endTurn(null, null));
    this.ticker = setInterval(() => this.updateHints(), TIMING.tickMs);
  }

  private updateHints(): void {
    if (this.stage !== 'draw') return;
    const progress = (Date.now() - this.stageStart) / this.stageMs;
    if (this.revealed.size >= Math.min(hintsDue(this.word, progress), maxHints(this.word))) return;
    const candidates = revealableIndexes(this.word, this.revealed);
    if (candidates.length === 0) return;
    this.revealed.add(randomItem(candidates));
    this.hooks.changed();
  }

  private endTurn(winner: TeamId | null, guesserId: string | null): void {
    if (this.stage === 'result') return;
    this.stopTicker();
    if (winner) {
      this.score[winner] += TEAM_SCORING.win;
      if (guesserId) this.hooks.award(guesserId, TEAM_SCORING.guesser);
      const drawer = this.drawers[winner];
      if (drawer) this.hooks.award(drawer, TEAM_SCORING.drawer);
    } else {
      this.hooks.system(`Süre doldu! Kelime "${this.word}" idi.`);
    }
    this.result = {
      word: this.word,
      winner,
      guesserId,
      drawings: { red: [...this.canvases.red.items], blue: [...this.canvases.blue.items] },
    };
    this.setStage('result', TEAMS.resultMs, () => this.nextTurn());
  }

  private finish(): void {
    this.clearTimers();
    this.hooks.finished({ ...this.score });
  }

  /** Her takımda oyunda kalan (bağlantısı anlık kopmuş olsa da) yeterli oyuncu var mı? */
  private teamsPlayable(): boolean {
    return TEAM_IDS.every((team) => this.hooks.members(team).length >= TEAMS.minPerTeam);
  }

  // ---------- Oyuncu işlemleri ----------

  private teamOfDrawer(playerId: string): TeamId | null {
    return TEAM_IDS.find((team) => this.drawers[team] === playerId) ?? null;
  }

  /** Bu oyuncu şu an çizebilir mi? Çizebiliyorsa takımını döner. */
  drawerTeam(playerId: string): TeamId | null {
    return this.stage === 'draw' ? this.teamOfDrawer(playerId) : null;
  }

  /** Çizenin işlemini kendi takımının tuvaline uygular; kabul edildiyse takımı döner. */
  draw(playerId: string, op: DrawOp): TeamId | null {
    const team = this.drawerTeam(playerId);
    if (!team || !this.canvases[team].apply(op)) return null;
    return team;
  }

  rejectDraw(playerId: string): void {
    const team = this.teamOfDrawer(playerId);
    if (team) this.canvases[team].reject();
  }

  /** Oyuncunun görmesi gereken tuval: kendi takımınınki. */
  canvasFor(team: TeamId | undefined): DrawItem[] {
    return team ? this.canvases[team].items : [];
  }

  /**
   * Sohbet mesajını değerlendirir. Tahmin doğruysa turu bitirir.
   * `team`: mesajı yazanın takımı (takımı yoksa izleyicidir).
   */
  chat(playerId: string, team: TeamId | undefined, text: string): TeamChatAction {
    if (this.stage === 'result') return { kind: 'all' };
    if (!team) return { kind: 'blocked' };
    const guess = normalizeGuess(text);
    const target = normalizeGuess(this.word);
    if (this.teamOfDrawer(playerId)) {
      // Çizen kelimeyi yazarak takımına söyleyemez.
      return target && guess.includes(target) ? { kind: 'blocked' } : { kind: 'team', team };
    }
    if (this.stage === 'draw' && guess === target) {
      this.hooks.system(`${this.hooks.find(playerId)?.name ?? 'Biri'} bildi! Kelime "${this.word}" 🏁`);
      this.endTurn(team, playerId);
      return { kind: 'correct' };
    }
    if (this.stage === 'draw' && isClose(guess, target)) return { kind: 'close' };
    // Diğer tahminler sadece kendi takımına gider: rakip takım onlardan ipucu alamasın.
    return { kind: 'team', team };
  }

  /** Bağlantı değişti: takımlardan biri oynanamaz hale geldiyse oyun biter. */
  onPresenceChange(): void {
    if (!this.teamsPlayable()) {
      this.hooks.system('Takımlardan birinde yeterli oyuncu kalmadı.');
      this.finish();
    }
  }

  // ---------- Durum ----------

  isDrawerNow(playerId: string): boolean {
    return (this.stage === 'intro' || this.stage === 'draw') && this.teamOfDrawer(playerId) !== null;
  }

  get secretWord(): string {
    return this.word;
  }

  hint(): string[] | null {
    return this.stage === 'draw' && this.word ? maskWord(this.word, this.revealed) : null;
  }

  publicState(): TeamRacePublic {
    return {
      turn: this.turn,
      totalTurns: this.totalTurns,
      stage: this.stage,
      drawers: { ...this.drawers },
      result: this.result,
    };
  }

  timing(): { timeLeftMs: number; durationMs: number } {
    return { timeLeftMs: Math.max(0, this.stageStart + this.stageMs - Date.now()), durationMs: this.stageMs };
  }

  dispose(): void {
    this.clearTimers();
  }

  private setStage(stage: TeamRaceStage, ms: number, onTimeout: () => void): void {
    this.stage = stage;
    this.stageStart = Date.now();
    this.stageMs = ms;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(onTimeout, ms);
    this.hooks.changed();
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  private clearTimers(): void {
    this.stopTicker();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
