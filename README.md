# 🎨 Karala

Arkadaşlarla oynanan çiz-tahmin et oyunu. Bir kişi çizer, diğerleri sohbetten tahmin eder.
Tarayıcıda ve Android/iOS'ta aynı kodla çalışır.

**▶ Hemen oyna: https://karala.onrender.com**

> Ücretsiz sunucu 15 dk kullanılmazsa uyur; ilk açılış ~50 sn sürebilir.

## Klasör yapısı

```
Karala/
├─ shared/protocol.ts   → Sunucu ve istemcinin ortak tipleri (oda durumu, çizim, socket olayları)
├─ server/              → Node.js + Socket.IO oyun sunucusu
│  └─ src/
│     ├─ index.ts       → Bağlantılar, oda kurma/katılma
│     ├─ Room.ts        → Oyun mantığı: turlar, süre, ipuçları, puanlama
│     ├─ words.ts       → Türkçe kelime havuzu
│     └─ util.ts        → Tahmin karşılaştırma, "çok yakın" kontrolü
└─ client/              → React + Vite arayüzü (+ Capacitor ile mobil)
   ├─ src/screens/      → Home, Lobby, Game, GameEnd ekranları
   ├─ src/components/   → Board (tuval + araçlar), Chat, PlayerList
   └─ android/          → Android Studio projesi (Capacitor üretir)
```

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

## Diğer komutlar

| Komut | Ne yapar |
|---|---|
| `npm run typecheck` | Sunucu + istemci tip kontrolü |
| `npm run build` | İstemciyi `client/dist`'e derler |
| `npm start` | Sunucuyu başlatır; `client/dist` varsa oyunu da aynı adresten sunar (yayın için) |

## Oyun kuralları (özet)

- Her turda sırayla herkes bir kez çizer; çizen 3 kelimeden birini seçer (15 sn).
- Tahmin eden: kalan süreye göre 50–300 puan, ilk bilen +50.
- Çizen: kelimeyi bilen her oyuncu için +60.
- Süre ilerledikçe harf ipuçları açılır; bir harf farkla yazılan tahminlerde "çok yakın!" uyarısı çıkar.
- Türkçe karakter şart değil: "ordek" = "ördek".
- Herkes bilirse tur erken biter. Sayfayı yenileyen oyuncu 30 sn içinde kaldığı yerden devam eder.

## Yol haritası

- [x] Başlangıç sürümü: oda, lobi, çizim, tahmin, puan, kürsü
- [x] Android projesi (Capacitor)
- [x] Sesler ve animasyonlar
- [x] İnternette yayın (Render, `main`'e her push otomatik yayınlanır)
- [ ] QR ile katılma, APK dağıtımı
- [ ] Takım modu, "Kırık Telefon" modu, herkese açık odalar
