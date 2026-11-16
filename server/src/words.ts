// Kategori bazlı Türkçe kelime havuzu. 'karisik' tüm kategorilerin birleşimidir.

export const WORDS: Record<string, string[]> = {
  hayvanlar: [
    'kedi', 'köpek', 'fil', 'zürafa', 'aslan', 'kaplan', 'zebra', 'penguen', 'kartal', 'baykuş',
    'yılan', 'kaplumbağa', 'tavşan', 'sincap', 'ayı', 'kurbağa', 'balina', 'köpekbalığı', 'ahtapot', 'yengeç',
    'kelebek', 'arı', 'karınca', 'örümcek', 'salyangoz', 'deve', 'at', 'inek', 'koyun', 'tavuk',
    'horoz', 'ördek', 'papağan', 'flamingo', 'kanguru', 'maymun', 'timsah', 'yunus', 'kirpi', 'tilki',
    'kurt', 'geyik', 'su aygırı', 'gergedan', 'denizatı', 'uğur böceği', 'yarasa', 'fare', 'domuz', 'keçi',
  ],
  yiyecekler: [
    'elma', 'muz', 'çilek', 'karpuz', 'üzüm', 'armut', 'kiraz', 'ananas', 'limon', 'portakal',
    'havuç', 'domates', 'patlıcan', 'mısır', 'mantar', 'soğan', 'pizza', 'hamburger', 'dondurma', 'pasta',
    'kurabiye', 'simit', 'lahmacun', 'döner', 'baklava', 'çay', 'kahve', 'ayran', 'yumurta', 'peynir',
    'ekmek', 'çorba', 'makarna', 'patates kızartması', 'sandviç', 'pamuk şeker', 'lolipop', 'çikolata', 'balık', 'sucuk',
    'pide', 'kebap', 'mantı', 'sütlaç', 'börek', 'zeytin', 'bal', 'patlamış mısır', 'krep', 'salata',
  ],
  esyalar: [
    'sandalye', 'masa', 'lamba', 'şemsiye', 'gözlük', 'saat', 'telefon', 'bilgisayar', 'televizyon', 'kumanda',
    'makas', 'kalem', 'silgi', 'cetvel', 'kitap', 'çanta', 'anahtar', 'kilit', 'ayna', 'diş fırçası',
    'tarak', 'yastık', 'battaniye', 'buzdolabı', 'çamaşır makinesi', 'ütü', 'süpürge', 'kova', 'çekiç', 'tornavida',
    'merdiven', 'mum', 'balon', 'hediye', 'kamera', 'kulaklık', 'gitar', 'davul', 'piyano', 'top',
    'bisiklet', 'kaykay', 'uçurtma', 'çaydanlık', 'tava', 'çatal', 'kaşık', 'bıçak', 'bardak', 'ampul',
  ],
  meslekler: [
    'doktor', 'öğretmen', 'polis', 'itfaiyeci', 'aşçı', 'pilot', 'astronot', 'berber', 'ressam', 'şarkıcı',
    'futbolcu', 'çiftçi', 'balıkçı', 'garson', 'hemşire', 'dişçi', 'mühendis', 'marangoz', 'postacı', 'kaptan',
    'palyaço', 'sihirbaz', 'dedektif', 'asker', 'hakem', 'fotoğrafçı', 'terzi', 'kasap', 'fırıncı', 'bahçıvan',
    'şoför', 'avukat', 'veteriner', 'dalgıç', 'korsan', 'kral', 'kraliçe', 'şövalye', 'ninja', 'robot',
  ],
  yerler: [
    'deniz', 'dağ', 'orman', 'çöl', 'şelale', 'volkan', 'ada', 'gökkuşağı', 'bulut', 'güneş',
    'ay', 'yıldız', 'kar tanesi', 'şimşek', 'kale', 'köprü', 'deniz feneri', 'piramit', 'çadır', 'ev',
    'okul', 'hastane', 'market', 'park', 'plaj', 'havuz', 'stadyum', 'sinema', 'müze', 'cami',
    'hayvanat bahçesi', 'lunapark', 'dönme dolap', 'tren', 'uçak', 'gemi', 'roket', 'helikopter', 'otobüs', 'denizaltı',
    'kardan adam', 'ağaç', 'çiçek', 'kaktüs', 'mağara', 'nehir', 'göl', 'uzay', 'gezegen', 'yel değirmeni',
  ],
  eylemler: [
    'koşmak', 'uyumak', 'yüzmek', 'dans etmek', 'şarkı söylemek', 'ağlamak', 'gülmek', 'zıplamak', 'uçmak', 'yemek yemek',
    'kitap okumak', 'resim yapmak', 'balık tutmak', 'futbol oynamak', 'bisiklete binmek', 'kayak yapmak', 'yemek pişirmek', 'diş fırçalamak', 'esnemek', 'hapşırmak',
    'alkışlamak', 'el sallamak', 'tırmanmak', 'düşmek', 'sarılmak', 'fotoğraf çekmek', 'araba sürmek', 'ip atlamak', 'kamp yapmak', 'sörf yapmak',
  ],
};

WORDS.karisik = Object.entries(WORDS).flatMap(([, list]) => list);
