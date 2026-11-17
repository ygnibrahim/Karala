# Karala — Mimari ve Kod Kuralları

## Genel bakış

```
Tarayıcı / PWA / Android (React)  ⇄  Socket.IO  ⇄  Node.js sunucusu (oyun mantığı)
                    └──────────── shared/ (ortak tipler ve kurallar) ────────────┘
```

- **Sunucu otoriterdir.** Oyunun gerçek durumu (gizli kelime, puanlar, sıra, süre) yalnızca sunucuda tutulur.
  İstemci sadece gösterir ve isteklerini iletir; hiçbir istemci verisine güvenilmez.
- **Tek adres.** Yayında sunucu hem oyunu (Socket.IO) hem de derlenmiş arayüzü (`client/dist`) sunar.
- **Durum bellekte.** Odalar geçicidir; sunucu yeniden başlarsa açık oyunlar sıfırlanır.

## Klasör yapısı

```
shared/                     Sunucu + istemci ortak kodu  (import: '@shared')
  constants.ts              Avatarlar, ayar seçenekleri, kategoriler, uzunluk sınırları
  types.ts                  Oda, oyuncu, sohbet tipleri
  drawing.ts                Çizim verisi + applyOp (iki tarafta aynı kural)
  events.ts                 Socket olaylarının imzaları (sözleşme)

server/src/
  index.ts                  Giriş noktası: sunucuyu başlatır
  app.ts                    Express + güvenlik başlıkları + Socket.IO kurulumu
  config.ts                 Tüm ayarlanabilir değerler (süreler, sınırlar, puanlar)
  socket/
    registerHandlers.ts     Olayları dinler → sınırlar → doğrular → Room'a iletir
    RateLimiter.ts          Olay başına istek sınırlayıcı (token bucket)
  validation/               İstemciden gelen her verinin temizlenmesi
    drawOp.ts · player.ts · settings.ts
  game/
    Room.ts                 Tek odanın kuralları ve akışı (durum makinesi)
    TelephoneGame.ts        Kırık Telefon modu (zincirler, adımlar, gösterim)
    ImpostorGame.ts         Sahtekâr modu (roller, sırayla çizgi, oylama, tahmin)
    DrawingBuffer.ts        Bir tuvalin çizim geçmişi ve sınırları (iki mod da kullanır)
    RoomManager.ts          Açık odalar
    scoring.ts · hints.ts · wordPicker.ts · wordList.ts   (saf fonksiyonlar)
  utils/                    text.ts (temizleme, tahmin karşılaştırma) · random.ts
server/test/                Birim + uçtan uca güvenlik testleri

client/src/
  main.tsx · App.tsx        Giriş, bağlantı ve ekran seçimi
  types.ts                  Ekranların ortak verisi (GameData)
  screens/                  Home · Lobby · Game · GameEnd  (sayfa düzeyi)
  components/
    common/                 Her yerde kullanılan küçük parçalar
    board/                  Çizim tahtası, araç çubuğu, araç tanımları
    game/                   Oyun ekranı parçaları (sohbet, oyuncular, katmanlar)
    lobby/                  Lobi parçaları
  canvas/                   Tuvale çizim + boya kovası algoritması
  effects/                  Ses, konfeti, olay → efekt eşlemesi
  hooks/                    Tekrar kullanılan React kancaları
  lib/                      socket, oturum/depolama, PWA
  styles/                   Konuya göre bölünmüş CSS (index.css sırayı belirler)
client/public/              Manifest, ikonlar, service worker, çevrimdışı sayfası
```

## Oyun akışı (sunucu durum makinesi)

```
lobby ──start──▶ choosing ──kelime seçildi / 15 sn──▶ drawing ──süre / herkes bildi / çizen ayrıldı──▶ turnEnd
  ▲                 ▲                                                                                    │ 6 sn
  │                 └─────────────────────────── sıradaki çizen ─────────────────────────────────────────┤
  └──── restart ── gameEnd ◀──────────────────── son tur bitti ──────────────────────────────────────────┘
```

## Temiz kod kuralları

1. **Tek sorumluluk.** Her dosyanın tek işi var. Socket katmanı kural bilmez; `Room` doğrulama yapmaz;
   puan/ipucu/kelime seçimi gibi hesaplar yan etkisiz saf fonksiyonlardır ve ayrı test edilir.
2. **Sihirli sayı yok.** Süreler, sınırlar, puanlar `server/src/config.ts` ya da `shared/constants.ts` içinde, adıyla.
3. **Sözleşme tek yerde.** Olay isimleri ve tipleri `shared/events.ts`'te; iki taraf da aynı tipleri kullanır.
4. **Önce doğrula, sonra kullan.** İstemciden gelen her şey `unknown` kabul edilir ve `validation/` içinde temizlenir.
5. **İsimlendirme.** Bileşenler `PascalCase.tsx`, diğer modüller `camelCase.ts`. Yorumlar Türkçe ve "neden"i anlatır.
6. **Biçim ve lint otomatik.** Biome (`npm run lint`, `npm run format`); tip kontrolü `strict`.
7. **Her değişiklik test edilir.** `npm run check` yerelde; GitHub Actions her push'ta; Render sadece CI geçince yayınlar.

## Güvenlik modeli

| Tehdit                           | Önlem                                                                                                            | Test                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Başka oyuncunun yerine geçme     | Gizli oturum anahtarı (≥16 karakter, kriptografik) ile herkese açık oyuncu kimliği ayrı; anahtar hiç yayınlanmaz | `security.e2e` › kimlik ve oturum |
| Eski bağlantının yayın dinlemesi | Aynı oturum yeni bağlantıyla dönünce eskisi odadan çıkarılır                                                     | `security.e2e`                    |
| Kelimeyi önceden görme (hile)    | Kelime sadece çizene ve bilenlere gider; diğerlerine maskeli ipucu; özel kelime listesi sadece oda sahibine      | `security.e2e` › kelime gizliliği |
| Sahtekâr'a kelimenin sızması     | Kelime sahtekâra ve herkese açık duruma gönderilmez; sohbette kelimeyi içeren mesaj engellenir                   | `impostor.test`                   |
| Bilenlerin cevabı sızdırması     | Çizen + bilenlerin sohbeti sadece kendi aralarında                                                               | `security.e2e`                    |
| Yetkisiz işlem                   | Ayar/başlatma sadece oda sahibi; çizim sadece sıradaki çizen                                                     | `security.e2e` › yetki            |
| Bozuk/kötü niyetli veri          | Tüm girdiler doğrulanır: tip, aralık, renk biçimi, uzunluk, bilinmeyen alanlar atılır                            | `validation.test`                 |
| İsim taklidi, görünmez karakter  | Kontrol/biçim/yön karakterleri silinir                                                                           | `text.test`                       |
| Spam / kaynak tüketme            | Olay başına istek sınırı, mesaj boyutu 64 KB, oda/çizim geçmişi üst sınırları                                    | `security.e2e` › istek sınırlama  |
| XSS                              | React metni her zaman kaçışlar; `dangerouslySetInnerHTML` yok; sıkı CSP                                          | `security.e2e` › HTTP başlıkları  |
| Tıklama hırsızlığı, MIME         | `frame-ancestors 'none'`, `nosniff`, `X-Powered-By` kapalı (helmet)                                              | `security.e2e`                    |
| Bilinen açıklı bağımlılık        | CI'da `npm audit --omit=dev --audit-level=high`                                                                  | CI                                |

**Bilinçli olarak yapılmayanlar:** Hesap/şifre sistemi yok (gerek yok); CORS varsayılan olarak açık çünkü çerez
kullanılmıyor (`CORS_ORIGINS` ortam değişkeniyle kısıtlanabilir); oda kodları 21⁵ ≈ 4 milyon olasılık — kaba
kuvvetle oda bulmak oda kurma/katılma sınırı yüzünden pratik değil.
