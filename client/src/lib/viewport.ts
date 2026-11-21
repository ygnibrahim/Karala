/**
 * Klavye açılınca oyun ekranı görünen alana sığsın ve kaymasın.
 *
 * Mobilde klavye açıldığında tarayıcılar (özellikle iOS Safari) sayfanın yüksekliğini küçültmez;
 * sayfa yukarı kayar ve tuval/sohbet ekran dışına taşar. Burada:
 * - görünen alanın gerçek yüksekliği `--app-h`, üstten kayması `--app-top` değişkenine yazılır;
 *   tam ekran düzenler (oyun, kırık telefon) mobilde `position: fixed` ile tam bu alana oturur,
 * - klavye açıkken `<html>`e `kb` sınıfı eklenir; CSS ikincil alanları gizleyip tuvale yer açar.
 * Android Chrome'da index.html'deki `interactive-widget=resizes-content` yüksekliği yerleşik küçültür.
 */
export function trackViewportHeight(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  // Klavyesiz en büyük yükseklik; ekran döndürülünce (genişlik değişince) sıfırlanır.
  let fullH = 0;
  let lastW = 0;

  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  };

  const update = () => {
    if (vv.width !== lastW) {
      lastW = vv.width;
      fullH = 0;
    }
    if (!typing()) fullH = Math.max(fullH, vv.height);
    const h = Math.round(vv.height);
    root.style.setProperty('--app-h', `${h}px`);
    root.style.setProperty('--app-top', `${Math.max(0, Math.round(vv.offsetTop))}px`);
    root.classList.toggle('kb', typing() && fullH > 0 && h < fullH * 0.8);
    // iOS klavye açılınca belgeyi kaydırır; tam ekran düzende bu kaymayı geri al.
    if (document.querySelector('.game, .tp') && window.scrollY !== 0) window.scrollTo(0, 0);
  };

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  // Odak değişince de bak: klavye kapanmadan önce/sonra sınıf doğru kalsın.
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => setTimeout(update, 50));
  update();
}
