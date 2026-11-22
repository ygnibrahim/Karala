# store/ — Play Store hazırlığı

| Dosya                                | Ne                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| [`play-console.md`](play-console.md) | Adım adım yayın rehberi, form cevapları (veri güvenliği, içerik derecelendirmesi…) |
| [`listing.md`](listing.md)           | Mağaza sayfası metinleri (Türkçe + İngilizce)                                      |
| `assets/icon-512.png`                | Mağaza ikonu                                                                       |
| `assets/feature-graphic.png`         | Öne çıkan görsel (1024×500), kaynağı `feature-graphic.html`                        |
| `assets/screenshots/`                | Telefon ekran görüntüleri (1080×1920), gerçek oyundan                              |
| `tools/`                             | Görselleri yeniden üreten betikler (headless Chrome; oyun bunları kullanmaz)       |

## Görselleri yeniden üretmek

Arayüz değişince ekran görüntülerini tazelemek için:

```powershell
npm run dev
```

Başka bir terminalde:

```powershell
node store/tools/screens.mjs
```

```powershell
node store/tools/feature.mjs
```

`screens.mjs` gerçek bir oyun kurar (sen + 3 bot), çizim/tahmin/oyun sonu/galeri ekranlarını yakalar.
İlk turda "ev" kelimesi gelmezse 3 koduyla çıkar; tekrar çalıştırman yeterli.

## Android ikonları

Logo `client/scripts/icon.svg`. Değişirse:

```powershell
npm run android:assets -w client
```
