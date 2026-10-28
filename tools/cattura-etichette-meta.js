/* StoryFlow — cattura delle etichette di Meta Business Suite in una nuova lingua.
 * Uso (Chrome, non l'app desktop):
 *   1. Imposta la lingua dell'account Facebook su quella da aggiungere.
 *   2. Apri https://business.facebook.com/latest/story_composer/
 *   3. F12 → Console → incolla tutto questo file → Invio
 *      (Chrome può chiedere di scrivere prima «allow pasting» o «consenti incolla»).
 *   4. Fai a mano il percorso di una storia con adesivo link, senza fretta.
 *   5. Clicca il pulsante viola «StoryFlow: copia etichette» in basso a sinistra e incolla il risultato.
 * Lo script legge soltanto i testi della pagina: non clicca nulla e non invia dati.
 */
(() => {
  if (window.__sfCapture) { window.__sfCapture.show(); return; }

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
  counter.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:8px 12px;'
    + 'border:0;border-radius:8px;background:#6d28d9;color:#fff;font:600 13px system-ui;cursor:pointer;';
  counter.addEventListener('click', async () => {
    scan();
    const text = report();
    try { await navigator.clipboard.writeText(text); counter.textContent = `Copiato ✓ (${found.size}) — incollalo a Claude`; }
    catch (_) { console.log(text); counter.textContent = 'Copia non riuscita: il testo è nella Console'; }
  });
  document.body.appendChild(counter);

  let timer = null;
  const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 300); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  scan();

  window.__sfCapture = { show: () => console.log(report()), report };
  console.log('StoryFlow: cattura attiva. Fai il percorso della storia, poi clicca il pulsante viola in basso a sinistra.');
})();
