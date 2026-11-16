// Hafif konfeti efekti: tam ekran, tıklamaları engellemeyen tek bir canvas.

const COLORS = ['#ff5c8a', '#ffc93c', '#6c4cf5', '#3b82f6', '#2fbf71', '#ff8a3d', '#ffffff'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ensureCanvas() {
  if (canvas) return;
  const el = document.createElement('canvas');
  el.className = 'confetti-canvas';
  document.body.appendChild(el);
  canvas = el;
  ctx = el.getContext('2d');
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = window.innerWidth * dpr;
    el.height = window.innerHeight * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
}

function frame() {
  if (!ctx) return;
  const W = window.innerWidth,
    H = window.innerHeight;
  ctx.clearRect(0, 0, W, H);
  particles = particles.filter((p) => p.y < H + 30 && p.life > 0);
  for (const p of particles) {
    p.vy += 0.25;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 40);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.rot * 2)); // dönen kağıt etkisi
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  raf = particles.length ? requestAnimationFrame(frame) : 0;
}

/** x, y: ekranın oranı olarak çıkış noktası (0-1). angle: derece, 90 = yukarı. */
export function confetti({ x = 0.5, y = 0.5, count = 70, angle = 90, spread = 70, power = 14 } = {}) {
  if (reducedMotion()) return;
  ensureCanvas();
  const W = window.innerWidth,
    H = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
    const v = power * (0.5 + Math.random() * 0.7);
    particles.push({
      x: x * W,
      y: y * H,
      vx: Math.cos(a) * v,
      vy: -Math.sin(a) * v,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 160 + Math.random() * 60,
    });
  }
  if (!raf) raf = requestAnimationFrame(frame);
}

/** Kutlama: iki yandan art arda patlamalar. */
export function celebrate() {
  confetti({ x: 0, y: 0.75, angle: 60, spread: 40, count: 60, power: 18 });
  confetti({ x: 1, y: 0.75, angle: 120, spread: 40, count: 60, power: 18 });
  setTimeout(() => confetti({ x: 0.5, y: 0.4, angle: 90, spread: 140, count: 90, power: 12 }), 450);
  setTimeout(() => {
    confetti({ x: 0.15, y: 0.6, angle: 75, spread: 50, count: 40 });
    confetti({ x: 0.85, y: 0.6, angle: 105, spread: 50, count: 40 });
  }, 1000);
}
