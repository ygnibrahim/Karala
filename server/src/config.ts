// Sunucunun ayarlanabilir tüm değerleri tek yerde.

export const PORT = Number(process.env.PORT) || 3001;

/** Render üzerinde mi çalışıyoruz? (Render bu değişkeni otomatik tanımlar.) */
export const IS_HOSTED = process.env.RENDER === 'true';

/** Yayındaki sürüm (Render otomatik verir); /health çıktısında görünür. */
export const VERSION = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev';

/**
 * Socket bağlantısına izin verilen kaynaklar (virgülle ayrılmış).
 * Boşsa her kaynağa izin verilir: oyun çerez/oturum kullanmadığı için bu güvenli bir varsayılandır.
 */
export const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const TIMING = {
  chooseMs: 15_000,
  turnEndMs: 6_000,
  reconnectGraceMs: 30_000,
  tickMs: 250,
} as const;

export const SERVER_LIMITS = {
  /** Aynı anda açık olabilecek en fazla oda. */
  maxRooms: 500,
  /** Bir turdaki çizim geçmişinin üst sınırları (bellek ve istemci yükü için). */
  maxHistoryPoints: 200_000,
  maxHistoryItems: 3_000,
  /** Tek bir 'move' paketindeki en fazla koordinat sayısı (x,y çiftleri). */
  maxPointsPerMove: 400,
  maxBrushSize: 80,
  /** Tek bir socket mesajının en büyük boyutu. */
  maxMessageBytes: 64 * 1024,
} as const;

/** IP adresi başına sınırlar: çok sayıda bağlantı açarak bağlantı başına sınırları aşmayı engeller. */
export const IP_RATE_LIMITS = {
  room: { capacity: 10, perSecond: 0.2 }, // oda kurma: 10'luk anlık hak, sonra ~12/dk
} as const;

/** Olay başına istek sınırları: kapasite (anlık patlama) ve saniyede dolum hızı. */
export const RATE_LIMITS = {
  room: { capacity: 5, perSecond: 0.2 }, // oda kurma/katılma: ~12/dk
  chat: { capacity: 6, perSecond: 1.5 },
  draw: { capacity: 120, perSecond: 60 },
  fill: { capacity: 3, perSecond: 1 }, // boya kovası istemcide pahalı
  action: { capacity: 10, perSecond: 2 }, // ayar, başlat, kelime seçimi, tepki
} as const;

export const SCORING = {
  /** Tahmin eden: kalan süreye göre min..max arası puan. */
  guessMin: 5,
  guessMax: 50,
  firstGuessBonus: 10,
  /** Çizen: kelimeyi bilen her oyuncu için. */
  drawerPerGuess: 10,
} as const;

/** İpucu harflerinin açıldığı süre oranları. */
export const HINT_THRESHOLDS = [0.5, 0.7, 0.85] as const;
