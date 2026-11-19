// Sunucunun gönderdiği hazır mesajların ve hata kodlarının kimlikleri.
// Sunucu cümle göndermez, sadece kimlik + değişkenleri gönderir; her oyuncu kendi dilinde okur
// (çeviriler: client/src/i18n). Böylece aynı odada farklı dillerde oynayan oyuncular olabilir.

export type MessageKey =
  // Oda
  | 'joined'
  | 'returned'
  | 'left'
  | 'kicked'
  | 'newHost'
  | 'drawerLost'
  | 'notEnoughPlayers'
  | 'modeNeedsPlayers'
  | 'needWords'
  // Bildirim
  | 'alreadyReported'
  | 'reportThanks'
  | 'autoKicked'
  // Klasik
  | 'gameStarted'
  | 'drawing'
  | 'wordWas'
  | 'winner'
  | 'close'
  | 'guessed'
  // Kırık Telefon
  | 'telephoneStarted'
  | 'comedian'
  | 'telephoneOver'
  // Sahtekâr
  | 'impostorStarted'
  | 'impostorNoWord'
  | 'impostorCaughtGuessing'
  | 'impostorEscaped'
  | 'impostorCaughtButKnew'
  | 'impostorCaught'
  // Çizim Yarışı
  | 'teamsShuffled'
  | 'teamsNeedPlayers'
  | 'teamsStarted'
  | 'teamWon'
  | 'teamDraw'
  | 'drawerNoWord'
  | 'timeUpWord'
  | 'teamGuessed'
  | 'teamTooSmall';

/**
 * Mesaj değişkenleri. Şu adlar istemcide ayrıca çevrilir: `mode` (oyun modu kimliği),
 * `team` (takım kimliği). Diğerleri (isim, kelime, sayı) olduğu gibi gösterilir.
 */
export type MessageVars = Record<string, string | number>;

/** Oda kurma/katılma hataları. */
export type ErrorCode = 'banned' | 'full' | 'notFound' | 'invalid' | 'tooFast' | 'busy';
