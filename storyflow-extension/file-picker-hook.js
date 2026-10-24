/* StoryFlow 3.0 — gira nel contesto JS di Meta (world: MAIN) sul composer delle storie.
 * - Intercetta il selettore file e avvisa il motore con un evento DOM (il motore riempie l'input).
 * - Durante una pubblicazione automatica disattiva l'avviso "Vuoi abbandonare la pagina?".
 * Non riceve immagini né dati sensibili.
 */
(() => {
  'use strict';

  const AUTO_HASHES = ['#sfauto', '#sftest'];
  if (AUTO_HASHES.some(h => location.hash.startsWith(h))) {
    try {
      const origAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, fn, opt) {
        if (String(type).toLowerCase() === 'beforeunload') return;
        return origAdd.call(this, type, fn, opt);
      };
      Object.defineProperty(window, 'onbeforeunload', { configurable: true, get: () => null, set: () => {} });
    } catch (_) {}
  }

  const ARM = 'storyflow-file-picker-arm';
  const DISARM = 'storyflow-file-picker-disarm';
  const READY = 'storyflow-file-picker-ready';
  const PICK = 'storyflow-file-picker-input';
  let armed = false;

  document.addEventListener(ARM, () => {
    armed = true;
    document.dispatchEvent(new Event(READY));
  }, true);
  document.addEventListener(DISARM, () => { armed = false; }, true);

  function notify(input) {
    // Alcune UI creano l'input soltanto per il tempo del click: il
    // motore (in un contesto isolato) deve poter ricevere l'evento anche allora.
    if (!input.isConnected) {
      input.style.display = 'none';
      (document.body || document.documentElement).appendChild(input);
    }
    input.dispatchEvent(new Event(PICK, { bubbles: true, composed: true }));
  }

  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function (...args) {
    if (!armed || this.type !== 'file') return nativeClick.apply(this, args);
    notify(this);
    // Non richiamare nativeClick: aprirebbe il dialog di scelta file.
  };

  // Fallback se Meta attiva l'input tramite <label> / click nativo anziché
  // HTMLInputElement.click(). Resta inattivo fuori dall'upload StoryFlow.
  document.addEventListener('click', (event) => {
    if (!armed || !(event.target instanceof HTMLInputElement) || event.target.type !== 'file') return;
    event.preventDefault();
    notify(event.target);
  }, true);
})();
