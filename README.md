# 🎨 Karala

Arkadaşlarla oynanan çiz-tahmin et oyunu. Bir kişi çizer, diğerleri sohbetten tahmin eder.
Tarayıcıda ve Android/iOS'ta aynı kodla çalışır.

**▶ Hemen oyna: https://karala.onrender.com**

> Ücretsiz sunucu 15 dk kullanılmazsa uyur; ilk açılış ~50 sn sürebilir.

## Klasör yapısı

```
Karala/
├─ shared/        Sunucu + istemci ortak kodu: tipler, sabitler, çizim kuralı, socket sözleşmesi
├─ server/
│  ├─ src/        app · config · socket/ (istek sınırı, olaylar) · validation/ · game/ (Room, kurallar) · utils/
│  └─ test/       Birim testleri + uçtan uca güvenlik testleri
├─ client/
│  ├─ src/        screens/ · components/{common,board,game,lobby} · canvas/ · effects/ · lib/ · hooks/ · styles/
│  ├─ public/     PWA: manifest, ikonlar, service worker
│  └─ android/    Android Studio projesi (Capacitor)
└─ docs/          ARCHITECTURE.md → mimari, kod kuralları, güvenlik modeli
```

Ayrıntılar için: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## Çalıştırma (tarayıcı)

```bash
npm install
npm run dev
```

- Bilgisayarda: http://localhost:5173
- Aynı Wi-Fi'daki telefondan: terminalde yazan `Network` adresi (ör. `http://192.168.1.5:5173`)
- Kendi kendine denemek için iki farklı sekme aç: her sekme ayrı oyuncu sayılır.

## Android Studio'da çalıştırma

**Canlı mod (geliştirme için önerilen):** Kodu değiştirdikçe emülatördeki uygulama da yenilenir.

1. `npm run dev` çalışır durumda olsun.
2. Başka bir terminalde:

   ```bash
   npm run android:live
   ```
3. Android Studio açılınca bir emülatör seç (ör. Pixel_8) ve ▶ Run'a bas.

> Emülatör, bilgisayardaki `localhost`'a `10.0.2.2` adresiyle ulaşır; bu ayar hazır.
> Gerçek telefonda canlı mod için: `npx cross-env CAP_LIVE_URL=http://BILGISAYAR_IP:5173 cap sync android`

**Paketli mod (sunucu internette yayındayken):**

```bash
# client/.env dosyasına: VITE_SERVER_URL=https://sunucu-adresin
npm run android:build
```

## Komutlar

| Komut               | Ne yapar                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Geliştirme: sunucu (3001) + arayüz (5173)                           |
| `npm test`          | Tüm testler (birim + güvenlik)                                      |
| `npm run lint`      | Kod stili ve hata denetimi (Biome)                                  |
| `npm run format`    | Kodu otomatik biçimlendirir                                         |
| `npm run typecheck` | Sunucu + istemci tip kontrolü                                       |
| `npm run check`     | lint + typecheck + test: **push etmeden önce çalıştır**             |
| `npm run build`     | İstemciyi `client/dist`'e derler                                    |
| `npm start`         | Sunucuyu başlatır; `client/dist` varsa oyunu da aynı adresten sunar |

## Yayına alma

`main` dalına push → GitHub Actions (lint, tip, test, derleme, güvenlik taraması) → **geçerse** Render otomatik yayınlar.
Kontrollerden biri kırmızıysa canlı site eski sürümde kalır. Yayındaki sürüm: https://karala.onrender.com/health

## Oyun kuralları (özet)

- Her turda sırayla herkes bir kez çizer; çizen 3 kelimeden birini seçer (15 sn).
- Tahmin eden: kalan süreye göre 5–50 puan, ilk bilen +10.
- Çizen: kelimeyi bilen her oyuncu için +10.
- Süre ilerledikçe harf ipuçları açılır; bir harf farkla yazılan tahminlerde "çok yakın!" uyarısı çıkar.
- Türkçe karakter şart değil: "ordek" = "ördek".
- Herkes bilirse tur erken biter. Sayfayı yenileyen oyuncu 30 sn içinde kaldığı yerden devam eder.

## Yol haritası

- [x] Başlangıç sürümü: oda, lobi, çizim, tahmin, puan, kürsü
- [x] Android projesi (Capacitor)
- [x] Sesler ve animasyonlar
- [x] İnternette yayın (Render) + PWA (ana ekrana yüklenebilir)
- [x] Klasör yapısı, kod kuralları, güvenlik sertleştirmesi ve testler, CI
- [ ] QR ile katılma
- [ ] Takım modu, "Kırık Telefon" modu, herkese açık odalar
