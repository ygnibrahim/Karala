// Tüm sesler Web Audio ile anlık üretilir: ses dosyası yok, uygulama hafif kalır.

export type SoundName =
  | 'join' | 'leave' | 'yourTurn' | 'turnStart' | 'drawStart' | 'correct' | 'otherCorrect'
  | 'close' | 'hint' | 'tick' | 'tickHigh' | 'timeUp' | 'allGuessed' | 'victory' | 'message' | 'pop';

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted() {
  try {
    return localStorage.getItem('karala.muted') === '1';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  return ctx;
}

// Mobil tarayıcılar sesi ancak bir dokunuştan sonra açar.
function unlock() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

/** Zarflı tek bir nota çalar. t: başlangıç gecikmesi (sn). */
function tone(freq: number, t: number, dur: number, wave: Wave = 'triangle', vol = 0.25, slideTo?: number) {
  const a = audio();
  if (!a || !master) return;
  const start = a.currentTime + t;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568, C4: 262, E4: 330, G4: 392 };

const SOUNDS: Record<SoundName, () => void> = {
  join: () => { tone(N.G5, 0, 0.12); tone(N.C6, 0.08, 0.18); },
  leave: () => { tone(N.E5, 0, 0.12); tone(N.C5, 0.08, 0.2); },
  pop: () => tone(600, 0, 0.08, 'sine', 0.2, 900),
  message: () => tone(1250, 0, 0.05, 'sine', 0.06),
  hint: () => { tone(N.A5, 0, 0.1, 'sine', 0.18); tone(N.E6, 0.06, 0.16, 'sine', 0.12); },
  tick: () => tone(1000, 0, 0.05, 'square', 0.05),
  tickHigh: () => tone(1400, 0, 0.07, 'square', 0.08),
  close: () => { tone(440, 0, 0.12, 'triangle', 0.2, 494); tone(494, 0.12, 0.14, 'triangle', 0.2, 440); },
  turnStart: () => { tone(N.E5, 0, 0.14, 'sine'); tone(N.A5, 0.1, 0.22, 'sine'); },
  drawStart: () => tone(300, 0, 0.25, 'sine', 0.15, 900),
  yourTurn: () => [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.25)),
  otherCorrect: () => { tone(N.C6, 0, 0.35, 'sine', 0.2); tone(N.G6, 0.05, 0.3, 'sine', 0.08); },
  correct: () => {
    [N.E5, N.G5, N.C6, N.E6].forEach((f, i) => tone(f, i * 0.07, 0.22, 'square', 0.1));
    tone(N.G6, 0.3, 0.5, 'sine', 0.15);
  },
  timeUp: () => [N.G4, N.E4, N.C4].forEach((f, i) => tone(f, i * 0.16, 0.3, 'sawtooth', 0.09)),
  allGuessed: () => [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => tone(f, i * 0.06, 0.3, 'triangle', 0.2)),
  victory: () => {
    const seq: [number, number, number][] = [[N.C5, 0, 0.18], [N.C5, 0.18, 0.12], [N.C5, 0.3, 0.12], [N.E5, 0.42, 0.18], [N.G5, 0.6, 0.18], [N.E5, 0.78, 0.12], [N.G5, 0.9, 0.7]];
    seq.forEach(([f, t, d]) => { tone(f, t, d, 'square', 0.1); tone(f * 2, t, d, 'triangle', 0.08); });
    tone(N.C4, 0.9, 0.7, 'triangle', 0.15);
  },
};

export function play(name: SoundName) {
  if (muted) return;
  try {
    const a = audio();
    if (a?.state === 'suspended') a.resume().catch(() => {});
    SOUNDS[name]();
  } catch {
    /* ses desteklenmiyorsa sessizce geç */
  }
}

export function vibrate(pattern: number | number[]) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* yok say */
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('karala.muted', m ? '1' : '0');
  } catch {
    /* yok say */
  }
  listeners.forEach((fn) => fn(m));
}

export function onMutedChange(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
