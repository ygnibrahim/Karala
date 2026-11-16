// Basit "token bucket" istek sınırlayıcı: her olay türü için ayrı kova.
// Kova `capacity` kadar dolu başlar, saniyede `perSecond` jeton dolar; her istek bir jeton harcar.

export interface BucketConfig {
  capacity: number;
  perSecond: number;
}

export class RateLimiter<K extends string> {
  private buckets = new Map<K, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly config: Record<K, BucketConfig>,
    private readonly now: () => number = Date.now,
  ) {}

  /** İsteğe izin verilirse true döner ve bir jeton harcar. */
  take(key: K, cost = 1): boolean {
    const { capacity, perSecond } = this.config[key];
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: capacity, updatedAt: now };
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * perSecond);
    bucket.updatedAt = now;
    const allowed = bucket.tokens >= cost;
    if (allowed) bucket.tokens -= cost;
    this.buckets.set(key, bucket);
    return allowed;
  }
}
