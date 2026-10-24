/* StoryFlow 2.1 — intercetta il selettore file nel contesto JS di Meta.
 * Questo file deve essere dichiarato nel manifest con world: MAIN.
 * Non riceve immagini né dati sensibili: invia soltanto un evento DOM
 * con il riferimento all'input, che composer.js riempie dal mondo ISOLATED.
 */
(() => {
  'use strict';

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
    // content script isolato deve poter ricevere l'evento anche allora.
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
