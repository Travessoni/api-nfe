/**
 * Bloqueia o scroll do body quando qualquer modal ou sheet estiver aberto.
 * Restaura o scroll ao fechar. Evita "jump" compensando a largura da scrollbar.
 * Compatível com múltiplos modais abertos.
 */
(function () {
  var LOCK_CLASS = 'body-scroll-lock';
  var OVERLAY_SELECTOR = '.modal-overlay, .sheet-overlay';

  function getScrollbarWidth() {
    if (typeof document === 'undefined' || !document.documentElement) return 0;
    return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  }

  function isAnyOverlayOpen() {
    var overlays = document.querySelectorAll(OVERLAY_SELECTOR);
    for (var i = 0; i < overlays.length; i++) {
      if (overlays[i].classList.contains('open')) return true;
    }
    return false;
  }

  function lockBody() {
    if (document.body.classList.contains(LOCK_CLASS)) return;
    var scrollY = window.scrollY || window.pageYOffset;
    var scrollbarWidth = getScrollbarWidth();
    document.body.classList.add(LOCK_CLASS);
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = scrollbarWidth + 'px';
    }
    document.body.dataset.scrollY = String(scrollY);
  }

  function unlockBody() {
    if (!document.body.classList.contains(LOCK_CLASS)) return;
    var scrollY = document.body.dataset.scrollY;
    document.body.classList.remove(LOCK_CLASS);
    document.body.style.paddingRight = '';
    if (document.body.dataset.scrollY !== undefined) delete document.body.dataset.scrollY;
    if (scrollY !== undefined && scrollY !== '') {
      window.scrollTo(0, parseInt(scrollY, 10));
    }
  }

  function syncBodyLock() {
    if (isAnyOverlayOpen()) {
      lockBody();
    } else {
      unlockBody();
    }
  }

  function observeOverlays() {
    var overlays = document.querySelectorAll(OVERLAY_SELECTOR);
    if (overlays.length === 0) return;
    var observer = new MutationObserver(function () {
      syncBodyLock();
    });
    overlays.forEach(function (el) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    syncBodyLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeOverlays);
  } else {
    observeOverlays();
  }
})();
