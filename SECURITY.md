# Güvenlik

## Açık bildirme

Bir güvenlik açığı bulduysan lütfen herkese açık issue açma.
Depodaki **Security → Report a vulnerability** bağlantısından gizli olarak bildir.

## Otomatik korumalar

Her push ve PR'da `.github/workflows/pipeline.yml` şunları çalıştırır; biri bile başarısız olursa yayına çıkılmaz:

| Kontrol              | Araç                         | Neyi yakalar                                 |
| -------------------- | ---------------------------- | -------------------------------------------- |
| Workflow güvenliği   | zizmor                       | CI dosyalarında yetki ve enjeksiyon hataları |
| Sızıntı taraması     | gitleaks                     | Git geçmişine girmiş şifre, anahtar, token   |
| Kod güvenlik analizi | CodeQL (security-extended)   | XSS, enjeksiyon, güvensiz kod kalıpları      |
| Bağımlılık açıkları  | npm audit (orta ve üzeri)    | Bilinen açığı olan paketler                  |
| Paket imzaları       | npm audit signatures         | Sahte ya da değiştirilmiş paketler           |
| Yeni bağımlılıklar   | dependency-review (PR'larda) | PR ile eklenen açıklı paketler               |
| Güncellemeler        | Dependabot (7 gün bekleme)   | Eskiyen paketler ve action'lar               |

Ek kurallar: action'lar commit SHA'sına sabit, token yetkileri en düşük seviyede,
paket kurulum betikleri çalıştırılmaz. Yayın sadece `production` ortamı üzerinden yapılır.

Uygulama tarafındaki güvenlik modeli için: `docs/ARCHITECTURE.md`.
