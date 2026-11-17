// Kategori bazlı Türkçe kelime havuzu. 'karisik' tüm kategorilerin birleşimidir.
// Kurallar (testlerle denetlenir): küçük harf, çizilebilir, aile dostu, bir kelime yalnızca tek kategoride.
// Kategori kimlikleri shared/constants.ts → CATEGORIES ile aynı olmalı.

const list = (text: string): string[] =>
  text
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

export const WORDS: Record<string, string[]> = {
  hayvanlar: list(`
    kedi, köpek, fil, zürafa, aslan, kaplan, zebra, penguen, kartal, baykuş, yılan, kaplumbağa, tavşan, sincap,
    ayı, kurbağa, balina, köpekbalığı, ahtapot, yengeç, kelebek, arı, karınca, örümcek, salyangoz, deve, at, inek,
    koyun, tavuk, horoz, ördek, papağan, flamingo, kanguru, maymun, timsah, yunus, kirpi, tilki, kurt, geyik,
    su aygırı, gergedan, denizatı, uğur böceği, yarasa, fare, domuz, keçi, panda, koala, kutup ayısı, leopar, çita,
    goril, şempanze, lama, bizon, manda, eşek, kuzu, civciv, hindi, kaz, kuğu, güvercin, serçe, karga, martı,
    pelikan, tavus kuşu, devekuşu, leylek, ağaçkakan, kolibri, şahin, akbaba, muhabbet kuşu, kanarya, istiridye,
    deniz yıldızı, denizanası, ıstakoz, karides, mürekkep balığı, fok, mors, su samuru, kunduz, rakun, kokarca,
    köstebek, hamster, kertenkele, bukalemun, iguana, sivrisinek, sinek, yusufçuk, çekirge, ağustos böceği,
    ateş böceği, solucan, tırtıl, akrep, japon balığı, palyaço balığı, kılıç balığı, vatoz, piranha, somon,
    kirpi balığı, ayı yavrusu, yavru kedi, köpek yavrusu, at nalı, örümcek ağı, karınca yuvası, kuş yuvası,
    arı kovanı, kutup tilkisi, beyaz tavşan, kara kedi, sokak köpeği, tembel hayvan, karıncayiyen, armadillo,
    ornitorenk, ren geyiği, kunduz barajı, çakal, sırtlan, antilop, kartal yuvası, pire, böcek, kene, salyangoz kabuğu
  `),

  yiyecekler: list(`
    elma, muz, çilek, karpuz, üzüm, armut, kiraz, ananas, limon, portakal, havuç, domates, patlıcan, mısır, mantar,
    soğan, pizza, hamburger, dondurma, pasta, kurabiye, makarna, patates kızartması, sandviç, pamuk şeker, lolipop,
    çikolata, balık, yumurta, peynir, ekmek, çorba, bal, patlamış mısır, krep, salata, zeytin, sucuk, kahve, çay,
    şeftali, kayısı, erik, nar, incir, mandalina, greyfurt, kivi, avokado, hindistan cevizi, böğürtlen, ahududu,
    yaban mersini, kavun, ayva, dut, hurma, salatalık, biber, brokoli, karnabahar, lahana, marul, ıspanak, pırasa,
    kabak, balkabağı, sarımsak, turp, pancar, bezelye, fasulye, nohut, mercimek, pirinç, bulgur, makarna tabağı,
    spagetti, sosis, köfte, tavuk but, biftek, omlet, sahanda yumurta, haşlanmış yumurta, tost, kruvasan, simit,
    poğaça, açma, kek, cupcake, donut, waffle, pankek, puding, jöle, şeker, sakız, bisküvi, gofret, cips, kraker,
    fındık, ceviz, badem, fıstık, kestane, ayçekirdeği, kuru üzüm, reçel, tereyağı, yoğurt, süt, ayran,
    meyve suyu, limonata, milkshake, kola, soda, sıcak çikolata, su şişesi, buz küpü, dondurma külahı,
    karpuz dilimi, elma şekeri, peynirli pizza, sosisli sandviç, tavuk döner, suşi, taco,
    nugget, ketçap, mayonez, hardal, tuz, karabiber, şeker küpü, un, yumurta sarısı, doğum günü pastası,
    meyve tabağı, kahvaltı tabağı, salata kasesi, çorba kasesi, et şiş, mısır koçanı, közlenmiş biber
  `),

  esyalar: list(`
    sandalye, masa, lamba, şemsiye, gözlük, saat, makas, kalem, silgi, cetvel, kitap, çanta, anahtar, kilit,
    ayna, diş fırçası, tarak, yastık, battaniye, buzdolabı, çamaşır makinesi, ütü, süpürge, kova, çekiç,
    tornavida, merdiven, mum, balon, hediye, çaydanlık, tava, çatal, kaşık, bıçak, bardak, ampul, kanepe,
    koltuk, yatak, dolap, çekmece, halı, perde, pencere, kapı, kapı kolu, kapı zili, priz, fırın, ocak, mikrodalga,
    bulaşık makinesi, tost makinesi, mikser, blender, tencere, kepçe, rende, oklava, tabak, kase, fincan,
    sürahi, termos, matara, piknik sepeti, çöp kutusu, faraş, paspas, sünger, havlu, sabun, şampuan,
    diş macunu, saç kurutma makinesi, tıraş makinesi, banyo küveti, duş, lavabo, musluk, klozet, tuvalet kâğıdı,
    çalar saat, duvar saati, kum saati, takvim, defter, ataş, zımba, bant, yapıştırıcı, boya kalemi,
    pastel boya, fırça, tebeşir, kara tahta, sırt çantası, kalemlik, cüzdan, para, bozuk para, kredi kartı,
    bilet, zarf, mektup, posta kutusu, kartpostal, harita, pusula, el feneri, pil, mıknatıs, büyüteç, dürbün,
    çadır, uyku tulumu, kibrit, çakmak, şişe, kavanoz, kutu, karton kutu, sepet, ip, zincir, halat, çivi,
    vida, testere, matkap, pense, el arabası, kürek, tırmık, sulama kabı, saksı, vazo, çerçeve, tablo, heykel,
    kumbara, oyuncak ayı, bebek, yapboz, zar, iskambil, satranç tahtası, düdük, şemsiye askısı, elbise askısı,
    terlik, bavul, valiz, anahtarlık, mandal, çamaşır ipi, iğne, iplik, yüksük, dikiş makinesi, örgü şişi,
    yün yumağı, mektup açacağı, ekmek bıçağı, kesme tahtası, buz kalıbı, ocak eldiveni, önlük, fön makinesi
  `),

  meslekler: list(`
    doktor, öğretmen, polis, itfaiyeci, aşçı, pilot, astronot, berber, ressam, şarkıcı, futbolcu, çiftçi,
    balıkçı, garson, hemşire, dişçi, mühendis, marangoz, postacı, kaptan, palyaço, dedektif, asker, hakem,
    fotoğrafçı, terzi, kasap, fırıncı, bahçıvan, şoför, avukat, veteriner, dalgıç, cankurtaran, kuaför, manav,
    bakkal, kasiyer, pastacı, çoban, arıcı, inşaat işçisi, elektrikçi, tesisatçı, boyacı, tamirci, kaynakçı,
    madenci, oduncu, bekçi, güvenlik görevlisi, hostes, makinist, kurye, kargocu, gazeteci, muhabir, sunucu,
    spiker, oyuncu, yönetmen, kameraman, dansçı, balerin, sihirbaz yardımcısı, akrobat, hokkabaz, cambaz,
    heykeltıraş, yazar, şair, kütüphaneci, bilim insanı, kimyager, arkeolog, jeolog, astronom, mimar,
    pilot yardımcısı, hakim, savcı, eczacı, ebe, psikolog, fizyoterapist, antrenör,
    çöpçü, sokak satıcısı, simitçi, dondurmacı, çilingir, ayakkabıcı, kunduracı, kuyumcu, saatçi, gözlükçü,
    model, modacı, aşçı yamağı, uçuş görevlisi, matador, kovboy, itfaiye şefi
  `),

  yerler: list(`
    deniz, dağ, orman, çöl, şelale, volkan, ada, gökkuşağı, bulut, güneş, ay, yıldız, kar tanesi, şimşek, kale,
    köprü, deniz feneri, piramit, ev, okul, hastane, market, park, plaj, havuz, stadyum, sinema, müze,
    hayvanat bahçesi, lunapark, dönme dolap, kardan adam, ağaç, çiçek, kaktüs, mağara, nehir, göl, uzay,
    gezegen, yel değirmeni, tepe, vadi, kanyon, buzul, buzdağı, kutup, vaha, kumul, bataklık, şelale havuzu,
    yayla, tarla, bahçe, sera, çiftlik, ahır, kümes, ağaç ev, kulübe, çadır kampı, köy, şehir, gökdelen, apartman,
    sokak, kavşak, trafik lambası, yaya geçidi, köprü altı, liman, iskele, havalimanı, tren istasyonu, otogar,
    benzin istasyonu, otopark, kütüphane, postane, banka, eczane, fırın dükkanı, pastane, restoran, kafe,
    otel, kamp ateşi, piknik alanı, oyun parkı, kaydırak, salıncak, tahterevalli, kum havuzu, çeşme, fıskiye,
    heykel parkı, mezarlık, kilise, cami, saray, kale kulesi, şato, mağara girişi, yanardağ ağzı, gökyüzü,
    güneş tutulması, ay tutulması, yağmur, kar, dolu, sis, fırtına, kasırga, hortum, rüzgar, gün batımı,
    gün doğumu, kuyruklu yıldız, ay dede, samanyolu, kara delik, palmiye, çam ağacı, meşe ağacı, söğüt,
    lale, gül, papatya, ayçiçeği, karahindiba, yonca, mantar ormanı, yaprak, dal, kök, tohum, çimen, saman balyası
  `),

  eylemler: list(`
    koşmak, uyumak, yüzmek, dans etmek, şarkı söylemek, ağlamak, gülmek, zıplamak, uçmak, yemek yemek,
    kitap okumak, resim yapmak, balık tutmak, bisiklete binmek, kayak yapmak, yemek pişirmek, diş fırçalamak,
    esnemek, hapşırmak, alkışlamak, el sallamak, tırmanmak, düşmek, sarılmak, fotoğraf çekmek, araba sürmek,
    ip atlamak, kamp yapmak, sörf yapmak, yürümek, oturmak, uzanmak, koşu yapmak, sıçramak, takla atmak,
    amuda kalkmak, şınav çekmek, mekik çekmek, yoga yapmak, meditasyon yapmak, ıslık çalmak, öksürmek,
    horlamak, rüya görmek, uyanmak, giyinmek, ayakkabı bağlamak, saç taramak, makyaj yapmak, tıraş olmak,
    duş almak, banyo yapmak, el yıkamak, çamaşır asmak, ütü yapmak, bulaşık yıkamak, toz almak, süpürmek,
    çiçek sulamak, ağaç dikmek, kazmak, odun kesmek, ateş yakmak, mangal yapmak, kek yapmak, çay demlemek,
    telefonla konuşmak, mesaj yazmak, selfie çekmek, video çekmek, oyun oynamak, saklambaç oynamak,
    kartopu oynamak, kardan adam yapmak, kum kalesi yapmak, uçurtma uçurmak, balon şişirmek, hediye açmak,
    mum üflemek, öpücük göndermek, göz kırpmak, kaş çatmak, dil çıkarmak, şaşırmak, korkmak, kızmak,
    utanmak, düşünmek, unutmak, saklanmak, aramak, bulmak, itmek, çekmek, taşımak, fırlatmak, yakalamak,
    tekmelemek, sallanmak, kaymak, düşüp kalkmak, sıraya girmek, otostop çekmek, dalmak, kürek çekmek, paten kaymak
  `),

  tasitlar: list(`
    araba, otobüs, minibüs, kamyon, kamyonet, traktör, ekskavatör, vinç, beton mikseri, itfaiye aracı, ambulans,
    polis arabası, taksi, dolmuş, tren, metro, tramvay, teleferik, uçak, helikopter, jet, sıcak hava balonu,
    zeplin, paraşüt, planör, roket, uzay mekiği, uydu, gemi, tekne, sandal, kano, yelkenli, yat, denizaltı,
    feribot, vapur, kruvaziyer, sal, jet ski, bisiklet, tandem bisiklet, tek tekerlekli bisiklet, motosiklet,
    motor scooter, elektrikli scooter, kaykay, paten, kızak, at arabası, fayton, bebek arabası, alışveriş arabası,
    çöp kamyonu, kar küreme aracı, tank, yarış arabası, karavan, otobüs durağı, garaj, direksiyon, lastik,
    tekerlek, kask, emniyet kemeri, plaka, uçak kanadı, çapa, dümen, sandal küreği, can yeleği
  `),

  spor: list(`
    futbol, basketbol, voleybol, tenis, masa tenisi, badminton, golf, beyzbol, ragbi, hentbol, boks, güreş,
    karate, judo, okçuluk, eskrim, halter, jimnastik, atletizm, maraton, yüzme yarışı, sutopu, kürek yarışı,
    kayak, snowboard, buz pateni, buz hokeyi, curling, bisiklet yarışı, motor yarışı, binicilik, dağcılık,
    kaya tırmanışı, dalış, yelken, sörf, bowling, bilardo, dart, satranç, dama, tavla, okey, saklambaç,
    körebe, yakalamaç, seksek, misket, topaç, yoyo, uçurtma, top, futbol topu, basketbol potası, kale direği,
    file, raket, golf sopası, beyzbol sopası, boks eldiveni, kayak gözlüğü, madalya, kupa, podyum, düdüklü hakem,
    penaltı, gol, smaç, ofsayt, korner, taraftar, tribün, skor tabelası, kronometre, start çizgisi, bitiş çizgisi,
    halat çekme, çuval yarışı, yumurta taşıma yarışı, sandalye kapmaca, top sektirmek, dripling, şut
  `),

  vucut: list(`
    göz, kulak, burun, ağız, diş, dil, dudak, kaş, kirpik, saç, sakal, bıyık, el, parmak, tırnak, kol, dirsek,
    omuz, boyun, bacak, diz, ayak, topuk, ayak parmağı, karın, göbek, kalp, beyin, iskelet, kafatası, kas,
    yanak, çene, alın, gamze, çil, ben, dövme, tişört, gömlek, kazak, ceket, mont, palto, yağmurluk, elbise,
    etek, pantolon, şort, kot pantolon, eşofman, pijama, mayo, bikini, iç çamaşırı, çorap, ayakkabı, bot,
    çizme, sandalet, spor ayakkabı, topuklu ayakkabı, şapka, bere, kasket, eldiven, atkı, kravat, papyon,
    kemer, düğme, fermuar, cep, kapüşon, yaka, kol saati, yüzük, kolye, küpe, bilezik, taç, peruk, maske,
    güneş gözlüğü, toka, saç bandı, örgü saç, at kuyruğu, kel kafa, kıvırcık saç, dişsiz gülüş
  `),

  fantastik: list(`
    ejderha, tek boynuzlu at, peri, cin, dev, cüce, büyücü, cadı, sihirbaz, sihirli değnek, uçan halı,
    hazine sandığı, korsan, korsan gemisi, deniz kızı, vampir, hayalet, mumya, zombi, kurt adam, yaratık,
    uzaylı, uçan daire, robot, süper kahraman, pelerin, kral, kraliçe, prens, prenses, şövalye, kale burcu,
    kılıç, kalkan, zırh, ok ve yay, sihirli ayna, büyülü kitap, iksir, kazan, süpürge sopası,
    sihirli lamba, altın yumurta, fasulye sırığı, cam ayakkabı, balkabağı arabası, kırmızı başlıklı kız,
    üç küçük domuz, kurbağa prens, uyuyan güzel, pamuk prenses, kibritçi kız, keloğlan, dev anası,
    zümrüdüanka, pegasus, minotor, tepegöz, deniz canavarı, kraken, dinozor, mağara adamı, ninja, samuray,
    kovboy şapkası, gizli geçit, hazine haritası, kayıp şehir, büyülü orman, perili ev, şeker evi
  `),

  teknoloji: list(`
    bilgisayar, dizüstü bilgisayar, tablet, cep telefonu, televizyon, kumanda, kulaklık, hoparlör, mikrofon,
    kamera, fotoğraf makinesi, yazıcı, klavye, fare imleci, ekran, şarj aleti, kablo, priz adaptörü, usb bellek,
    oyun konsolu, oyun kolu, sanal gerçeklik gözlüğü, akıllı saat, drone, robot süpürge, radyo, telsiz,
    uydu anteni, wifi, bluetooth, pil göstergesi, şifre, e-posta, emoji, video oyunu, internet, arama motoru,
    teleskop, mikroskop, deney tüpü, mıknatıs deneyi, ampul icadı, elektrik, şimşek çakması, güneş paneli,
    rüzgar türbini, pil şarjı, atom, molekül, dna, dişli çark, makine, motor, kaldıraç, makara, lazer,
    hesap makinesi, barkod, karekod, robot kol, yapay zekâ, uzay istasyonu, ay aracı, mars, satürn, ekvator, termometre
  `),

  muzik: list(`
    gitar, davul, piyano, keman, çello, flüt, trompet, saksafon, akordeon, arp, ksilofon, zil, tef, marakas,
    mızıka, bağlama, ud, kanun, ney, darbuka, zurna, nota, sol anahtarı, metronom, orkestra, şef, koro,
    konser, sahne, mikrofon sehpası, kulaklık takmak, plak, kaset, müzik kutusu, karaoke, rock yıldızı,
    rapçi, dj, opera, bale, tiyatro, perde arkası, kukla, maske takmak, sirk, palyaço burnu, resim sehpası,
    tuval, boya paleti, sulu boya, heykel yapmak, çömlek, origami, kolaj, karikatür, çizgi film, film şeridi,
    patlamış mısır kovası, sinema bileti, kırmızı halı, ödül heykelciği, fotoğraf albümü, sergi, grafiti
  `),

  turkiye: list(`
    döner, lahmacun, baklava, mantı, sütlaç, börek, pide, kebap, kokoreç, midye dolma, çiğ köfte, gözleme,
    menemen, kumpir, künefe, lokum, aşure, helva, tantuni, iskender, mercimek çorbası, karnıyarık, dolma,
    sarma, pilav, cacık, turşu, şalgam, boza, salep, türk kahvesi, çay bardağı, semaver, cezve, ince belli bardak,
    nazar boncuğu, kilim, halı dokuma, fes, tavla zarı, okey taşı, mangal, hamam, kese, kubbe,
    minare, kız kulesi, galata kulesi, boğaz köprüsü, kapadokya, peri bacaları, pamukkale, efes, truva atı,
    nemrut dağı, ağrı dağı, sümela manastırı, anıtkabir, topkapı sarayı, ayasofya, vapur yolculuğu,
    martıya simit atmak, sahil yürüyüşü, pazar yeri, seyyar satıcı, karpuz sergisi, ramazan davulcusu,
    bayram şekeri, el öpmek, kına gecesi, düğün halayı, gelin arabası, sünnet düğünü, karagöz, hacivat,
    nasreddin hoca, meddah, zeybek, horon, halay, çifte telli, ayva tatlısı, kestane kebap, mısır arabası,
    simit arabası, çay ocağı, kahvehane, tavla oynamak, dolmuş durağı, sarı taksi, apartman görevlisi,
    pazar filesi, tüp gaz, soba, kuzine, divan, sedir, yorgan, yün çorap, bakır tencere, sini, tepsi, ibrik, leğen
  `),
};

WORDS.karisik = Object.values(WORDS).flat();
