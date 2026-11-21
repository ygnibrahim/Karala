/**
 * Klavye açılınca oyun ekranı görünen alana sığsın.
 *
 * Mobilde klavye açıldığında tarayıcılar sayfanın yüksekliğini küçültmez; sayfa yukarı kayar ve
 * tuval/sohbet ekran dışına taşar. Tuvalde `touch-action: none` olduğu için geri kaydırmak da zordur.
 * Burada görünen alanın gerçek yüksekliği `--app-h` değişkenine yazılır; tam ekran düzenler
 * (oyun, kırık telefon) bu değişkeni kullanır ve klavye açıkken de ekrana sığar.
 * Android Chrome'da index.html'deki `interactive-widget=resizes-content` aynı işi yerleşik yapar.
 */
export function trackViewportHeight(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const update = () => {
    root.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
    // iOS klavye açılınca belgeyi kaydırır; tam ekran düzende bu kaymayı geri al.
    if (document.querySelector('.game, .tp') && window.scrollY !== 0) window.scrollTo(0, 0);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}
