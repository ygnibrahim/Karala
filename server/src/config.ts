// Sunucunun ayarlanabilir tüm değerleri tek yerde.

export const PORT = Number(process.env.PORT) || 3001;

/** Ortam değişkeninden sayı oku (testler süreleri kısaltabilsin). */
const envMs = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

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
  chooseMs: envMs('CHOOSE_MS', 15_000),
  turnEndMs: envMs('TURN_END_MS', 6_000),
  /** Bağlantısı kopan oyuncu bu süre içinde dönerse kaldığı yerden devam eder (telefon ekranı kapanması, arama vb.). */
  reconnectGraceMs: envMs('RECONNECT_GRACE_MS', 120_000),
  /** Klasik modda bağlantısı kopan çizen için tur bu kadar bekler. */
  drawerGraceMs: envMs('DRAWER_GRACE_MS', 10_000),
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
  /** Tahmin eden: bilme sırasına göre. İlk bilen 15, sonraki 13, 11… en az 5. */
  firstGuess: 15,
  guessStep: 2,
  guessMin: 5,
  /** Çizen: kelimeyi bilen her oyuncu için. */
  drawerPerGuess: 3,
} as const;

export const TELEPHONE = {
  minPlayers: 3,
  /** Zincir başına en fazla adım (kalabalık odada oyun çok uzamasın). */
  maxSteps: 8,
  writeMs: 40_000,
  guessMs: 35_000,
  // Çizim adımının süresi odanın "çizim süresi" ayarından gelir.
  /** Süre bitince istemcilerin son hallerini göndermesi için kısa ek süre. */
  graceMs: 1_500,
  /** Herkes gönderince sonraki adıma geçmeden önceki kısa bekleme. */
  nextStepDelayMs: 800,
  /** Gösterimde oda sahibi ilerletmezse otomatik geçiş. */
  revealAutoMs: 15_000,
} as const;

export const IMPOSTOR = {
  minPlayers: 3,
  /** Herkes kaç kez çizgi çizer. */
  laps: 2,
  introMs: 5_000,
  turnMs: 20_000,
  voteMs: 40_000,
  guessMs: 30_000,
  resultMs: 9_000,
  /** Şekil/boya kovası tek hamlede biter: sıra bu kadar sonra geçer. */
  afterShapeMs: 400,
} as const;

export const IMPOSTOR_SCORING = {
  /** Sahtekâr yakalanmadı. */
  escaped: 3,
  /** Sahtekâr yakalandı ama kelimeyi bildi. */
  guessedWord: 2,
  /** Sahtekâr yakalandı ve bilemedi: diğer herkese. */
  caught: 1,
  /** Doğru kişiye oy verenlere ek. */
  correctVote: 1,
} as const;

export const TEAMS = {
  /** Her takımda en az bu kadar oyuncu (biri çizer, en az biri tahmin eder). */
  minPerTeam: 2,
  /** Çizenlerin kelimeyi görüp hazırlandığı süre. */
  introMs: envMs('TEAM_INTRO_MS', 4_000),
  /** Tur sonunda iki çizimin gösterildiği süre. */
  resultMs: envMs('TEAM_RESULT_MS', 8_000),
} as const;

export const TEAM_SCORING = {
  /** Turu kazanan takıma. */
  win: 1,
  /** Kişisel puan (oyun sonu "en iyi oyuncu" için): kelimeyi bilen. */
  guesser: 2,
  /** Kişisel puan: turu kazanan takımın çizeni. */
  drawer: 1,
} as const;

/** Oyun sonu galerisi: bellekte ve ağda şişmesin diye sınırlı. */
export const GALLERY = {
  maxItems: 30,
  /** Galerideki tüm çizimlerin toplam nokta sayısı sınırı (aşan çizim eklenmez). */
  maxPoints: 150_000,
} as const;

/** 👍/👎 tepkileri: tur başına sınır yok; seri basışta odaya mesaj yağmasın diye kısa bekleme. */
export const REACTIONS = {
  cooldownMs: 600,
} as const;

export const MODERATION = {
  /** Odadaki diğer oyuncuların en az bu oranı aynı kişiyi bildirirse kişi odadan çıkarılır. */
  autoKickRatio: 0.5,
  /** Otomatik çıkarma için gereken en az bildirim (2 kişilik odada tek kişi birini atamasın). */
  minReportsForAutoKick: 2,
  /** Bildirime bağlam olarak eklenen son mesaj sayısı. */
  recentMessages: 8,
  /**
   * İsteğe bağlı: bildirimlerin gönderileceği adres (ör. Discord/Slack webhook). Boşsa sadece sunucu
   * kaydına yazılır. Render'da ortam değişkeni olarak tanımlanır; asla koda yazılmaz.
   */
  reportWebhookUrl: process.env.REPORT_WEBHOOK_URL?.trim() || null,
} as const;

/** İpucu harflerinin açıldığı süre oranları. */
export const HINT_THRESHOLDS = [0.5, 0.7, 0.85] as const;
