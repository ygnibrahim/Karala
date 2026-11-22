# Play Store'a çıkış rehberi (adım adım)

Kim ne yapar: 👤 = sen (hesap, ödeme, kimlik, onay düğmeleri), 🤖 = Claude (kod, paket, metinler).

---

## 0. Ön koşullar

- [ ] 👤 Oyuna özel iletişim e-postası aç (ör. ayrı bir Gmail). Herkese açık görünecek.
- [ ] 🤖 E-postayı `client/public/gizlilik.html` ve `privacy.html` içindeki `[İLETİŞİM E-POSTASI]` /
      `[CONTACT EMAIL]` yerlerine yaz, canlıya al (gizlilik sayfası Play'de link olarak verilecek).

## 1. Play Console hesabı 👤

1. <https://play.google.com/console> → kendi Google hesabınla gir.
2. Hesap türü: **Kişisel** (şirket gerekmez). Geliştirici adı: `İbrahim Yeğen` ya da `Karala`.
3. Kimlik doğrulama + 25 $ tek seferlik ücret.
4. Android telefon doğrulaması isteyebilir (Play Console uygulaması). Telefonun iPhone ise bir
   arkadaşın/ailenin Android telefonunda kendi hesabınla giriş yapıp doğrulayabilirsin.

## 2. Yükleme anahtarı (bir kere) 👤

Uygulamayı imzalayan anahtar **senin bilgisayarında** durur, depoya girmez. Şifreyi kendin belirlersin;
Claude'a söyleme, bir yere not et (şifre yöneticisi ideal).

PowerShell'de:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\karala-anahtar"
```

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "$env:USERPROFILE\karala-anahtar\karala-upload.jks" -alias karala -keyalg RSA -keysize 2048 -validity 10000
```

Sorulan ad/kuruluş sorularına istediğini yazabilirsin (ör. ad: İbrahim Yeğen, ülke kodu: TR).

Sonra `client/android/keystore.properties.example` dosyasını aynı klasöre `keystore.properties` adıyla
kopyala ve şifreleri doldur. Bu dosya `.gitignore`'da; asla GitHub'a gitmez.

> **Yedek:** `karala-upload.jks` dosyasını ve şifresini bir USB'ye / güvenli buluta da koy.
> Kaybolursa dünya yıkılmaz (Play App Signing açık olduğu için Google'dan yeni yükleme anahtarı
> istenebilir) ama birkaç gün güncelleme yapamazsın.

## 3. Paketi üret 🤖 (ya da sen)

```powershell
npm run android:bundle
```

Çıktı: `client/android/app/build/outputs/bundle/release/app-release.aab`

Her yeni yüklemeden önce `client/android/app/build.gradle` içindeki `versionCode` bir artırılır
(1 → 2 → 3 …), `versionName` de (1.0.0 → 1.0.1). Play aynı versionCode'u ikinci kez kabul etmez.

## 4. Uygulamayı oluştur 👤

Play Console → **Uygulama oluştur**:

- Ad: `Karala: Çiz ve Tahmin Et` · Varsayılan dil: Türkçe · **Oyun** · **Ücretsiz**
- Beyanları işaretle. **Ücretsiz seçimi sonradan ücretliye çevrilemez** (ücretsiz kalıp içinde satış
  eklemek ise mümkün).

## 5. "Uygulamanızı kurun" formları 👤 (cevaplar hazır)

| Form                               | Cevap                                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gizlilik politikası**            | `https://karala.onrender.com/gizlilik.html`                                                                                                                                                                                      |
| **Uygulama erişimi**               | Tüm işlevler kısıtlama olmadan kullanılabilir. Not ekle: _"No login. To test multiplayer: tap 'Oda Kur' (Create room), then open the invite link https://karala.onrender.com/?oda=CODE on a second device or browser and join."_ |
| **Reklamlar**                      | Hayır, reklam içermiyor                                                                                                                                                                                                          |
| **İçerik derecelendirmesi**        | Kategori: Oyun. Şiddet / cinsellik / küfür / uyuşturucu / kumar: **Hayır**. _Kullanıcılar etkileşime girebilir mi / içerik paylaşabilir mi?_ **Evet** (sohbet ve çizim). Konum paylaşımı: Hayır. Dijital satın alma: Hayır.      |
| **Hedef kitle**                    | **13–15, 16–17, 18+** (13 yaş altını işaretleme: çocuk kategorisi kuralları çok ağır). "Çocuklara hitap ediyor mu?" → Hayır, mağaza sayfası çocuklara yönelik değil.                                                             |
| **Haber uygulaması**               | Hayır                                                                                                                                                                                                                            |
| **COVID / sağlık / finans / kamu** | Hayır                                                                                                                                                                                                                            |
| **Veri güvenliği**                 | Aşağıda                                                                                                                                                                                                                          |

### Veri güvenliği formu

- Veri topluyor mu? **Evet** · Aktarım sırasında şifreleniyor mu? **Evet** (HTTPS)
- Kullanıcı verilerin silinmesini isteyebilir mi? **Evet** (e-postayla; ayrıca veriler oda kapanınca silinir)
- Hesap oluşturma: **Yok**

| Veri türü (Play'deki adı)                                                      | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaç                                                                  |
| ------------------------------------------------------------------------------ | ---------- | ------------ | ---------- | --------------------------------------------------------------------- |
| Kişisel bilgiler → **Ad** (takma ad)                                           | Evet       | Hayır        | Zorunlu    | Uygulama işlevselliği                                                 |
| Mesajlar → **Diğer uygulama içi mesajlar** (sohbet)                            | Evet       | Hayır        | Zorunlu    | Uygulama işlevselliği; dolandırıcılığı önleme, güvenlik (bildirimler) |
| Uygulama etkinliği → **Diğer kullanıcı içerikleri** (çizimler, özel kelimeler) | Evet       | Hayır        | Zorunlu    | Uygulama işlevselliği                                                 |

Diğer her şey (konum, e-posta, telefon, kişiler, fotoğraf, cihaz kimliği, finans, sağlık, tarama
geçmişi, analiz, reklam kimliği): **Toplanmıyor**.
"Paylaşılıyor: Hayır" doğru: barındırma sağlayıcısı (Render) Google'ın tanımında "hizmet sağlayıcı"
sayılır, paylaşım değildir. Odadaki oyuncuların birbirini görmesi de kullanıcının kendi isteğiyle
yaptığı aktarım sayılır.

## 6. Mağaza sayfası 👤🤖

Metinler ve görseller: [`listing.md`](listing.md), dosyalar `store/assets/` içinde.

## 7. Kapalı test (14 gün, en az 12 kişi) 👤

1. **Test → Kapalı test → Kanal oluştur** (ör. "Arkadaşlar").
2. **Test kullanıcıları:** e-posta listesi oluştur, Android telefonu olan **15–20** arkadaşın Gmail
   adresini ekle (12'nin altına düşmesin diye fazladan).
3. **Sürüm oluştur** → `app-release.aab` yükle → sürüm notu: "İlk test sürümü".
4. İncelemeye gönder (ilk inceleme birkaç gün sürebilir).
5. Onaylanınca **katılım linkini** WhatsApp'tan gönder: her kişi linke tıklayıp "Test kullanıcısı ol"
   der, sonra Play Store'dan indirir.
6. 14 gün boyunca uygulama telefonlarında yüklü kalsın; arada birlikte oynayın, Play'den "özel geri
   bildirim" bırakmalarını rica et.
7. Bu sürede gelen hataları düzeltip yeni sürüm (versionCode +1) yükleyebiliriz; süre sıfırlanmaz.

## 8. Üretime erişim başvurusu 👤 (cevap taslakları 🤖)

14 gün dolunca **Pano → Üretime erişim başvurusu**. Sorulara örnek cevaplar (kendi deneyiminle düzenle):

- **Test kullanıcılarını nasıl buldun?** Arkadaşlarım ve ailem; oyun zaten aramızda web sürümüyle
  oynanıyordu, Android kullananları kapalı teste davet ettim.
- **Test sırasında ne öğrendin, ne değişti?** (Gerçek geri bildirimleri yaz: ör. "klavye açılınca
  tuval küçülüyordu, düzelttik", "puanlar yüksekti, sıralı puana geçtik".)
- **Uygulama kime yönelik, neden ilgi görecek?** Arkadaş grupları için hesap gerektirmeyen, reklamsız,
  Türkçe kelimeli bir çiz-tahmin et oyunu; 4 farklı mod.
- **Üretime hazır mı?** Evet; test boyunca kritik hata kalmadı.

## 9. Yayın 🎉

Onay gelince **Üretim → Sürüm oluştur** → aynı (ya da daha yeni) `.aab` → ülkeler: önce Türkiye
(istersen tüm ülkeler) → incelemeye gönder.

---

### Sık karşılaşılanlar

- **"Hedef API düzeyi"** uyarısı: `targetSdkVersion = 36`, güncel; sorun yok.
- **Uygulama sunucuya bağlanamıyor:** paket `client/.env.android` ile `https://karala.onrender.com`'a
  bağlanır. Render ücretsiz planda ilk açılış 30–60 sn sürebilir (sunucu uyanıyor).
- **İnceleme reddi "işlevsellik eksik":** inceleyen tek cihazda çok oyunculu test edemediyse
  "Uygulama erişimi" notundaki talimatı kontrol et.
