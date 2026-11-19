// Kırık Telefon modu: herkes aynı anda kendi önündeki zincire bir adım ekler.
// Adım 0: herkes bir şey yazar. Tek adımlar: bir öncekinin yazdığını çiz. Çift adımlar: önceki çizimi tahmin et.
// Her adımda zincirler bir kişi kayar; böylece her zincir sırayla farklı oyunculardan geçer.
// Sonunda zincirler adım adım herkese gösterilir ve en çok güldüren seçilir.
import type { DrawItem, DrawOp, RevealData, RevealEntry, TelephonePublic, TelephoneStepKind, TelephoneTask } from '@shared';
import { TELEPHONE } from '../config';
import { DrawingBuffer } from './DrawingBuffer';

export interface TelephonePlayer {
  id: string;
  name: string;
  socketId: string | null;
}

/** Oyunun odayla konuştuğu noktalar (oyun mantığı socket'lerden habersizdir). */
export interface TelephoneHooks {
  find(id: string): TelephonePlayer | undefined;
  sendTask(playerId: string, task: TelephoneTask): void;
  broadcastReveal(data: RevealData): void;
  /** Herkese açık durum değişti. */
  changed(): void;
  /** Yazma adımı için öneri ve boş bırakanların yerine kullanılacak metin. */
  randomPrompt(): string;
  finished(laughs: Record<string, number>): void;
}

type Entry =
  | { kind: 'text'; authorId: string; authorName: string; text: string }
  | { kind: 'drawing'; authorId: string; authorName: string; drawing: DrawItem[] };

export const stepKind = (step: number): TelephoneStepKind => (step === 0 ? 'write' : step % 2 === 1 ? 'draw' : 'guess');

/** `step` adımında, sırada `playerIndex` konumundaki oyuncunun üzerinde çalıştığı zincir. */
export const chainIndexFor = (playerIndex: number, step: number, playerCount: number): number =>
  (((playerIndex - step) % playerCount) + playerCount) % playerCount;

/** Zincir sayısı oyuncu sayısı kadardır; adım sayısı ise üst sınırla kısıtlanır. */
export const totalStepsFor = (playerCount: number): number => Math.min(playerCount, TELEPHONE.maxSteps);

export class TelephoneGame {
  readonly order: readonly string[];
  readonly totalSteps: number;
  step = 0;
  phase: 'play' | 'reveal' = 'play';

  private chains: Entry[][];
  private submitted = new Set<string>();
  private drafts = new Map<string, DrawingBuffer>();
  private suggestions = new Map<string, string>();
  private stepStart = 0;
  private stepDurationMs = 0;
  private timer: NodeJS.Timeout | null = null;
  private revealChain = 0;
  private revealEntry = 0;
  private laughs: Record<string, number> = {};
  private laughedAt = new Set<string>();

  constructor(
    order: readonly string[],
    private readonly drawMs: number,
    private readonly hooks: TelephoneHooks,
  ) {
    this.order = [...order];
    this.chains = order.map(() => []);
    this.totalSteps = totalStepsFor(order.length);
  }

  start(): void {
    this.beginStep(0);
  }

  get kind(): TelephoneStepKind {
    return stepKind(this.step);
  }

  /** Oynama aşamasında kalan/toplam süre (ek süre hariç). */
  timing(): { timeLeftMs: number; durationMs: number } | null {
    if (this.phase !== 'play') return null;
    return { timeLeftMs: Math.max(0, this.stepStart + this.stepDurationMs - Date.now()), durationMs: this.stepDurationMs };
  }

  // ---------- Oynama ----------

  private beginStep(step: number): void {
    this.step = step;
    this.submitted.clear();
    this.drafts.clear();
    this.suggestions.clear();
    const kind = this.kind;
    this.stepDurationMs = kind === 'draw' ? this.drawMs : kind === 'write' ? TELEPHONE.writeMs : TELEPHONE.guessMs;
    this.stepStart = Date.now();
    this.schedule(this.stepDurationMs + TELEPHONE.graceMs, () => this.endStep());
    for (const id of this.order) this.sendTaskTo(id);
    this.hooks.changed();
  }

  /** Oyuncunun bu adımdaki görevi; zincire katılmıyorsa null. */
  taskFor(playerId: string): TelephoneTask | null {
    const index = this.order.indexOf(playerId);
    if (index < 0 || this.phase !== 'play') return null;
    const chain = this.chains[chainIndexFor(index, this.step, this.order.length)];
    const previous = this.step > 0 ? chain[this.step - 1] : undefined;
    const task: TelephoneTask = {
      step: this.step,
      kind: this.kind,
      prompt: !previous ? null : previous.kind === 'text' ? { text: previous.text } : { drawing: previous.drawing },
      submitted: this.submitted.has(playerId),
    };
    if (this.kind === 'write') task.suggestion = this.suggestionFor(playerId);
    return task;
  }

  sendTaskTo(playerId: string): void {
    const task = this.taskFor(playerId);
    if (task) this.hooks.sendTask(playerId, task);
  }

  /** Yazma/tahmin adımında metni, çizim adımında "bitti"yi kaydeder. */
  submit(playerId: string, step: number, text: string | null): boolean {
    if (!this.canAct(playerId, step)) return false;
    if (this.kind !== 'draw') {
      if (!text) return false;
      this.setEntry(playerId, { kind: 'text', ...this.author(playerId), text });
    }
    this.submitted.add(playerId);
    this.hooks.changed();
    this.advanceIfEveryoneDone();
    return true;
  }

  /** Çizim adımında oyuncunun kendi tuvaline işlem ekler (kimseye iletilmez). */
  draw(playerId: string, step: number, op: DrawOp): boolean {
    if (!this.canAct(playerId, step) || this.kind !== 'draw') return false;
    let draft = this.drafts.get(playerId);
    if (!draft) {
      draft = new DrawingBuffer();
      this.drafts.set(playerId, draft);
    }
    return draft.apply(op);
  }

  rejectDraw(playerId: string): void {
    this.drafts.get(playerId)?.reject();
  }

  /** Oyuncunun bu adımdaki yarım çizimi (yeniden bağlanınca ya da eşitlemede). */
  draftOf(playerId: string): DrawItem[] | null {
    if (this.phase !== 'play' || this.kind !== 'draw' || !this.order.includes(playerId)) return null;
    return this.drafts.get(playerId)?.items ?? [];
  }

  /** Bir oyuncu bağlandı/ayrıldı: kalanların hepsi bitirdiyse beklemeden ilerle. */
  onPresenceChange(): void {
    if (this.phase === 'play') this.advanceIfEveryoneDone();
  }

  private canAct(playerId: string, step: number): boolean {
    return this.phase === 'play' && step === this.step && this.order.includes(playerId) && !this.submitted.has(playerId);
  }

  private advanceIfEveryoneDone(): void {
    // Bağlantısı anlık kopanları da bekle (süre dolunca zaten ilerlenir); sadece odadan çıkanlar beklenmez.
    const active = this.order.filter((id) => this.hooks.find(id));
    if (active.length > 0 && active.every((id) => this.submitted.has(id))) {
      this.schedule(TELEPHONE.nextStepDelayMs, () => this.endStep());
    }
  }

  private endStep(): void {
    // Çizimler adım boyunca taslakta durur; şimdi zincire yazılır. Metin göndermeyenlerin yerine
    // öneri ya da "…" kullanılır. Böylece zincir hiç kopmaz.
    this.order.forEach((id, index) => {
      const chain = this.chains[chainIndexFor(index, this.step, this.order.length)];
      if (chain[this.step]) return;
      const author = this.author(id);
      if (this.kind === 'draw') this.setEntry(id, { kind: 'drawing', ...author, drawing: this.drafts.get(id)?.items ?? [] });
      else if (this.kind === 'write') this.setEntry(id, { kind: 'text', ...author, text: this.suggestionFor(id) });
      else this.setEntry(id, { kind: 'text', ...author, text: '…' });
    });
    if (this.step + 1 >= this.totalSteps) this.startReveal();
    else this.beginStep(this.step + 1);
  }

  private setEntry(playerId: string, entry: Entry): void {
    const index = this.order.indexOf(playerId);
    this.chains[chainIndexFor(index, this.step, this.order.length)][this.step] = entry;
  }

  private author(playerId: string): { authorId: string; authorName: string } {
    return { authorId: playerId, authorName: this.hooks.find(playerId)?.name ?? '?' };
  }

  private suggestionFor(playerId: string): string {
    let s = this.suggestions.get(playerId);
    if (!s) {
      s = this.hooks.randomPrompt();
      this.suggestions.set(playerId, s);
    }
    return s;
  }

  // ---------- Gösterim ----------

  private startReveal(): void {
    this.phase = 'reveal';
    this.revealChain = 0;
    this.revealEntry = 0;
    this.showCurrent();
  }

  /** Oda sahibi: sonraki adıma ya da zincire geç; hepsi bittiyse oyunu bitir. */
  next(): void {
    if (this.phase !== 'reveal') return;
    this.revealEntry++;
    if (this.revealEntry >= this.chains[this.revealChain].length) {
      this.revealChain++;
      this.revealEntry = 0;
    }
    if (this.revealChain >= this.chains.length) {
      this.clearTimer();
      this.hooks.finished({ ...this.laughs });
      return;
    }
    this.showCurrent();
  }

  /** Açık olan adıma 😂 (kendi adımına ve aynı adıma iki kez olmaz). */
  laugh(playerId: string): boolean {
    if (this.phase !== 'reveal') return false;
    const entry = this.chains[this.revealChain][this.revealEntry];
    const key = `${this.revealChain}:${this.revealEntry}:${playerId}`;
    if (!entry || entry.authorId === playerId || this.laughedAt.has(key)) return false;
    this.laughedAt.add(key);
    this.laughs[entry.authorId] = (this.laughs[entry.authorId] ?? 0) + 1;
    this.hooks.changed();
    return true;
  }

  revealData(): RevealData | null {
    if (this.phase !== 'reveal') return null;
    const chain = this.chains[this.revealChain];
    const ownerId = this.order[this.revealChain];
    return {
      chain: this.revealChain,
      ownerName: this.hooks.find(ownerId)?.name ?? chain[0]?.authorName ?? 'Biri',
      entries: chain.slice(0, this.revealEntry + 1).map(toRevealEntry),
    };
  }

  private showCurrent(): void {
    const data = this.revealData();
    if (data) this.hooks.broadcastReveal(data);
    this.schedule(TELEPHONE.revealAutoMs, () => this.next());
    this.hooks.changed();
  }

  // ---------- Durum ----------

  publicState(): TelephonePublic {
    return {
      step: this.step,
      totalSteps: this.totalSteps,
      kind: this.kind,
      submitted: [...this.submitted],
      participants: [...this.order],
      reveal:
        this.phase === 'reveal'
          ? {
              chain: this.revealChain,
              entry: this.revealEntry,
              totalChains: this.chains.length,
              chainLength: this.chains[this.revealChain]?.length ?? 0,
            }
          : null,
      laughs: { ...this.laughs },
    };
  }

  dispose(): void {
    this.clearTimer();
  }

  private schedule(ms: number, fn: () => void): void {
    this.clearTimer();
    this.timer = setTimeout(fn, ms);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

function toRevealEntry(e: Entry): RevealEntry {
  return e.kind === 'text'
    ? { kind: 'text', authorId: e.authorId, authorName: e.authorName, text: e.text }
    : { kind: 'drawing', authorId: e.authorId, authorName: e.authorName, drawing: e.drawing };
}
