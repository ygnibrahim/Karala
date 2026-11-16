// Anahtar (ör. IP adresi) başına istek sınırlayıcı. Uzun süre kullanılmayan anahtarlar silinir.
import { type BucketConfig, RateLimiter } from './RateLimiter';

const IDLE_MS = 10 * 60_000;
const SWEEP_EVERY = 500;

export class KeyedRateLimiter<K extends string> {
  private limiters = new Map<string, { limiter: RateLimiter<K>; lastUsed: number }>();
  private calls = 0;

  constructor(
    private readonly config: Record<K, BucketConfig>,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string, bucket: K): boolean {
    const now = this.now();
    if (++this.calls % SWEEP_EVERY === 0) this.sweep(now);
    let entry = this.limiters.get(key);
    if (!entry) {
      entry = { limiter: new RateLimiter(this.config, this.now), lastUsed: now };
      this.limiters.set(key, entry);
    }
    entry.lastUsed = now;
    return entry.limiter.take(bucket);
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.limiters) {
      if (now - entry.lastUsed > IDLE_MS) this.limiters.delete(key);
    }
  }
}
