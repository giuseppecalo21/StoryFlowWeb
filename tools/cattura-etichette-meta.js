/* StoryFlow — cattura delle etichette di Meta Business Suite in una nuova lingua.
 * Uso (Chrome, non l'app desktop):
 *   1. Imposta la lingua dell'account Facebook su quella da aggiungere.
 *   2. Apri https://business.facebook.com/latest/story_composer/
 *   3. F12 → Console → incolla tutto questo file → Invio.
 *      Al primo incolla Chrome blocca e chiede di scrivere «allow pasting» (o «consenti incolla»):
 *      scrivilo, premi Invio e poi incolla di nuovo lo script.
 *   4. In alto al centro della pagina di Meta compare il pulsante viola «StoryFlow: copia etichette».
 *      Fai a mano il percorso di una storia con adesivo link, senza fretta.
 *   5. Clicca il pulsante viola e incolla il risultato.
 * Lo script legge soltanto i testi della pagina: non clicca nulla e non invia dati.
 */
(() => {
  if (window.__sfCapture) { window.__sfCapture.show(); return; }
  const host = () => document.body || document.documentElement;

  const MAX_LEN = 80;
  const found = new Map(); // testo -> tipi in cui è comparso
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const mine = e => Boolean(e.closest && e.closest('[data-sf-capture]'));
  const add = (kind, s) => {
    s = clean(s);
    if (!s || s.length > MAX_LEN) return;
    if (!found.has(s)) found.set(s, new Set());
    found.get(s).add(kind);
  };
  const each = (sel, fn) => document.querySelectorAll(sel).forEach(e => { if (!mine(e)) fn(e); });

  function scan() {
    each('[role=button],button,[role=menuitem],[role=tab],[role=option]', e => add('pulsante', e.innerText));
    each('[aria-label]', e => add('aria', e.getAttribute('aria-label')));
    each('h1,h2,h3,h4,[role=heading],[role=dialog] [dir=auto]', e => add('titolo', e.innerText));
    each('input[placeholder],textarea[placeholder]', e => add('campo', e.placeholder));
    each('[role=alert],[role=status],[aria-live]', e => add('avviso', e.innerText));
    counter.textContent = `StoryFlow: copia etichette (${found.size})`;
  }

  function report() {
    const rows = [...found].map(([s, k]) => `${[...k].sort().join(',')}\t${s}`).sort();
    return [
      `Lingua pagina: ${document.documentElement.lang || '?'} · Browser: ${navigator.language}`,
      `Pagina: ${location.pathname} · ${new Date().toISOString()}`,
      `Etichette raccolte: ${rows.length}`,
      '',
      ...rows
    ].join('\n');
  }

  const counter = document.createElement('button');
  counter.type = 'button';
  counter.setAttribute('data-sf-capture', '');
  // In alto al centro, sopra tutto: in basso a sinistra finiva sotto i menu di Meta.
  counter.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;'
    + 'padding:12px 20px;border:3px solid #fff;border-radius:10px;background:#6d28d9;color:#fff;'
    + 'font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45);';
  // Se la copia automatica non riesce, il testo compare in un riquadro già selezionato: basta Ctrl+C.
  function showText(text) {
    const box = document.createElement('div');
    box.setAttribute('data-sf-capture', '');
    box.style.cssText = 'position:fixed;inset:70px 10% auto;z-index:2147483647;background:#fff;border:3px solid #6d28d9;'
      + 'border-radius:10px;padding:12px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:14px system-ui,sans-serif;color:#222;';
    const hint = document.createElement('div');
    hint.textContent = 'Premi Ctrl+C (Cmd+C su Mac) per copiare, poi incolla il testo a Claude. Clicca fuori dal riquadro per chiuderlo.';
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'width:100%;height:50vh;margin-top:8px;font:12px monospace;box-sizing:border-box;';
    box.append(hint, area);
    host().appendChild(box);
    area.focus(); area.select();
    setTimeout(() => document.addEventListener('mousedown', function close(e) {
      if (!box.contains(e.target)) { box.remove(); document.removeEventListener('mousedown', close, true); }
    }, true), 0);
  }
  counter.addEventListener('click', async () => {
    scan();
    const text = report();
    try { await navigator.clipboard.writeText(text); counter.textContent = `Copiato ✓ (${found.size}) — incollalo a Claude`; }
    catch (_) { showText(text); }
  });
  host().appendChild(counter);
  // Se la pagina di Meta toglie il pulsante ridisegnandosi, lo rimettiamo.
  const keepButton = setInterval(() => { if (!counter.isConnected) host().appendChild(counter); }, 1000);

  let timer = null;
  const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 300); });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  scan();

  window.__sfCapture = {
    show: () => { if (!counter.isConnected) host().appendChild(counter); console.log(report()); },
    report,
    stop: () => { observer.disconnect(); clearInterval(keepButton); counter.remove(); delete window.__sfCapture; }
  };
  console.log('%cStoryFlow: cattura attiva.', 'color:#6d28d9;font-weight:bold;font-size:14px',
    'Il pulsante viola è in alto al centro della pagina. Fai il percorso della storia, poi cliccalo.');
})();
