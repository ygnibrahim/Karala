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

| Komut                             | Ne yapar                                                            |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | Geliştirme: sunucu (3001) + arayüz (5173)                           |
| `npm test`                        | Tüm testler (birim + güvenlik)                                      |
| `npm run lint`                    | Kod stili ve hata denetimi (Biome)                                  |
| `npm run format`                  | Kodu otomatik biçimlendirir                                         |
| `npm run typecheck`               | Sunucu + istemci tip kontrolü                                       |
| `npm run check`                   | lint + typecheck + test: **push etmeden önce çalıştır**             |
| `npm run build`                   | İstemciyi `client/dist`'e derler                                    |
| `npm start`                       | Sunucuyu başlatır; `client/dist` varsa oyunu da aynı adresten sunar |
| `node scripts/dev-bots.mjs KOD 4` | Odaya kendi kendine oynayan botlar ekler (arayüz denemesi)          |
| `node scripts/live-check.mjs`     | Canlı sitede 3 modu ve kopma senaryolarını uçtan uca dener          |

## Yayına alma

`main` dalına push → CI/CD hattı ([pipeline.yml](.github/workflows/pipeline.yml)): kalite + 5 güvenlik kontrolü
([SECURITY.md](SECURITY.md)) → hepsi geçerse **production onayı** → Render'a tam o commit yayınlanır → canlı sitede uçtan uca test.
Kontrollerden biri kırmızıysa ya da onay verilmezse canlı site eski sürümde kalır. Render'ın kendi otomatik yayını kapalıdır. Yayındaki sürüm: https://karala.onrender.com/health

## Oyun modları

- **🎨 Klasik** (en az 2 kişi): Sırayla biri çizer, diğerleri sohbetten tahmin eder.
- **📞 Kırık Telefon** (en az 3 kişi): Herkes aynı anda bir şey yazar → bir sonrakinin yazdığını çizer → bir sonrakinin çizimini tahmin eder… Sonunda zincirler adım adım gösterilir; en çok 😂 alan "Günün Komedyeni" olur.
- **🕵️ Sahtekâr** (en az 3 kişi): Biri kelimeyi bilmez, sadece kategoriyi bilir. Herkes ortak tuvale sırayla tek çizgi çizer (2 dönüş), sonra sahtekâr oylanır. Yakalanan sahtekâr kelimeyi bilirse kurtulur. Puan: kaçarsa sahtekâra +3, yakalanıp bilirse +2; yakalanıp bilemezse diğerlerine +1, doğru oy verenlere +1 daha.
- **🏁 Çizim Yarışı** (en az 4 kişi, takımda en az 2): Lobide 🔴/🔵 takım seçilir (oda sahibi karıştırabilir). Her turda iki takımın çizeni aynı kelimeyi aynı anda kendi takımına çizer; herkes sadece kendi takımının tuvalini ve sohbetini görür. İlk bilen takım turu alır, tur sonunda iki çizim yan yana gösterilir. Kişisel puan: bilen +2, kazanan takımın çizeni +1.

## Arkadaşlarla oynarken

- **📷 QR ile katılma:** Lobide "QR"ye bas; yanındakiler telefon kamerasıyla okutup doğrudan odaya girer.
- **Özel kelimeler:** Oda sahibi ayarlardan kendi kelimelerini yazar (isimler, iç espriler). "Sadece özel kelimeler" kategorisiyle yalnız bunlar çıkar. Liste oda sahibinin cihazında hatırlanır, sonraki odaya otomatik gelir.
- **🖼️ Oyun sonu galerisi:** Klasik, Sahtekâr ve Çizim Yarışı'nda oyun bitince o oyunun bütün çizimleri gösterilir. Bir çizime dokunup "Kaydet / Paylaş" ile altında kelime ve çizenin adı yazan resim olarak WhatsApp vb.'ye gönderilir. Galeri sadece bellekte durur (en fazla 30 çizim), yeni oyunda silinir.

## Klasik mod kuralları (özet)

- Her turda sırayla herkes bir kez çizer; çizen 3 kelimeden birini seçer (15 sn).
- Tahmin eden: bilme sırasına göre puan: ilk bilen 15, ikinci 13, üçüncü 11… (en az 5).
- Çizen: kelimeyi bilen her oyuncu için +3.
- Süre ilerledikçe harf ipuçları açılır; bir harf farkla yazılan tahminlerde "çok yakın!" uyarısı çıkar.
- Türkçe karakter şart değil: "ordek" = "ördek".
- Herkes bilirse tur erken biter. Sayfayı yenileyen ya da bağlantısı kopan oyuncu 2 dk içinde kaldığı yerden devam eder.

## Moderasyon

- Sohbetteki küfürler (Türkçe + İngilizce) `***` ile maskelenir; harf aralama, rakamla yazma, harf tekrarı gibi kaçamaklar da yakalanır. Küfürlü isim "Oyuncu"/"Player" olur, küfürlü özel kelimeler listeye alınmaz. Liste: `server/src/moderation/profanity.ts`.
- Oyuncu listesindeki **⋯** menüsü:
  - **🔇 Sessize al:** O kişinin mesajları sadece senin ekranında gizlenir; kişi bunu bilmez.
  - **🚩 Bildir:** Sebep seçilir (küfür, uygunsuz çizim, spam, diğer). Bildirim, kişinin son mesajlarıyla birlikte sunucu kaydına yazılır (Render → Logs, `player-report`). Gizli oturum anahtarı ve IP yazılmaz. Odadaki diğer oyuncuların **yarısı** aynı kişiyi bildirirse kişi otomatik çıkarılır ve geri giremez.
  - **🚪 Odadan çıkar** (sadece oda sahibi): Çıkarılan aynı odaya geri giremez.
- İsteğe bağlı: Render'da `REPORT_WEBHOOK_URL` ortam değişkenine bir Discord/Slack webhook adresi yazılırsa bildirimler oraya da gelir (telefona anlık bildirim).

## Gizlilik ve KVKK

- Gizlilik politikası ve KVKK aydınlatma metni: `/gizlilik` (TR) ve `/privacy` (EN), yani https://karala.onrender.com/gizlilik. Kaynak: `client/public/gizlilik.html`, `privacy.html`. Mağaza sayfalarına bu adresler yazılır.
- Metinlerdeki **[sarı yer tutucular]** (veri sorumlusu adı, iletişim e-postası) mağazaya çıkmadan önce doldurulmalı.
- Hesap, çerez, reklam ya da analiz aracı yok. Sohbet ve çizimler sadece bellekte, oda kapanınca silinir. Yazı tipi kendi sunucumuzdan gelir; üçüncü taraf kaynak kullanılmaz (CSP testi bunu denetler).
- Ana ekrandaki "Bu cihazdaki bilgilerimi sil" bağlantısı, cihazda tutulan profili ve tercihleri siler.
- Veri işleme değişirse (yeni veri, analiz aracı, reklam vb.) bu iki sayfa da güncellenmeli.

## Dil

- Arayüz **Türkçe / İngilizce**; her oyuncu ana ekrandan kendi dilini seçer (varsayılan: cihazın dili). Metinler: `client/src/i18n/tr.ts`, `en.ts`.
- Sunucu cümle göndermez, mesaj kimliği gönderir (`shared/messages.ts`); böylece aynı odada farklı dillerde oynanabilir.
- Odanın **kelime dili** ayrı bir ayardır (oda sahibi seçer, odayı kuranın diliyle başlar). İngilizce kelimeler: `server/src/game/wordListEn.ts`.

## Yol haritası

- [x] Başlangıç sürümü: oda, lobi, çizim, tahmin, puan, kürsü
- [x] Android projesi (Capacitor)
- [x] Sesler ve animasyonlar
- [x] İnternette yayın (Render) + PWA (ana ekrana yüklenebilir)
- [x] Klasör yapısı, kod kuralları, güvenlik sertleştirmesi ve testler, CI
- [x] QR ile katılma, oyun sonu galerisi
- [x] Kırık Telefon modu
- [x] Sahtekâr modu
- [x] Küfür filtresi ve oyuncu çıkarma
- [x] Takım modu (Çizim Yarışı)
- [ ] Herkese açık odalar
