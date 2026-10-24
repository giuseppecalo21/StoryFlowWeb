(function () {
  'use strict';

  const COMPOSER = 'https://business.facebook.com/latest/story_composer/';
  const STICKER_TRIES = 2;
  const PAUSA = 2000;

  const hash = location.hash;
  if (!hash.startsWith('#zwauto') && !hash.startsWith('#zwtest')) return;

  // Disattiva avviso "Vuoi abbandonare la pagina?"
  const script = document.createElement('script');
  script.textContent = `
    (() => {
      const origAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, fn, opt) {
        if (type === 'beforeunload') return;
        return origAdd.call(this, type, fn, opt);
      };
      Object.defineProperty(window, 'onbeforeunload', { configurable: true, get: () => null, set: () => {} });
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = e => (e.innerText || '').trim();
  const btn = (label, root = document) => root
    ? [...root.querySelectorAll('[role=button]')].filter(e => txt(e) === label && e.getAttribute('aria-disabled') !== 'true').pop()
    : null;

  async function waitFor(fn, ms = 15000, step = 250) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(step); }
    return null;
  }

  function setInput(i, v) {
    i.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
    i.blur();
  }

  function dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const mime = head.match(/:(.*?);/)[1];
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  let box, curTitle = '', S = null;
  let overlay=null,overlayTitle=null,overlayMeter=null;
  let lastStage='start';
  const STAGE_PCT={start:5,image:22,link:42,sticker:60,verify:81,publish:94,done:100,error:100};
  function ensureOverlay(){
    if(overlay||!document.body)return;
    overlay=document.createElement('div');overlay.id='storyflow-working-overlay';
    // Visual cover only; pointer-events:none preserves coordinate clicks and automation.
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#f7f8fb;pointer-events:none;display:flex;align-items:center;justify-content:center;font:15px system-ui,sans-serif;color:#282b42;';
    const card=document.createElement('div');card.style.cssText='width:min(460px,82vw);background:white;border:1px solid #e3e6ed;border-radius:8px;padding:35px;box-shadow:0 10px 32px #1b24400d;';
    const kicker=document.createElement('div');kicker.textContent='STORYFLOW / PUBBLICAZIONE STORIE';kicker.style.cssText='font-size:11px;letter-spacing:1.4px;color:#7462e9;font-weight:700;margin-bottom:15px;';
    overlayTitle=document.createElement('div');overlayTitle.textContent='Preparazione storia…';overlayTitle.style.cssText='font-size:21px;font-weight:700;margin-bottom:20px;line-height:1.4;';
    const track=document.createElement('div');track.style.cssText='height:6px;background:#ececf4;border-radius:3px;overflow:hidden;';
    overlayMeter=document.createElement('div');overlayMeter.style.cssText='height:100%;width:5%;background:#6552e8;transition:width .25s ease;';track.appendChild(overlayMeter);
    const foot=document.createElement('p');foot.textContent='La storia viene preparata automaticamente. Il risultato comparirà al termine della verifica.';foot.style.cssText='font-size:12px;color:#8b8e9b;line-height:1.6;margin:18px 0 0;';
    card.append(kicker,overlayTitle,track,foot);overlay.appendChild(card);document.body.appendChild(overlay);
  }
  function emitStage(stage,message){
    lastStage=stage;
    ensureOverlay();
    if(overlayTitle)overlayTitle.textContent=message;
    if(overlayMeter)overlayMeter.style.width=(STAGE_PCT[stage]||5)+'%';
    if((stage==='done'||stage==='error')&&overlay){
      overlay.style.background=stage==='done'?'#f4faf7':'#fff7f7';
      if(stage==='done')setTimeout(()=>{if(overlay)overlay.remove();overlay=null;},2500);
    }
    if(S) { try { chrome.runtime.sendMessage({cmd:'SF_PROGRESS',stage,index:S.done||1,total:S.dryRun?1:(S.total||(S.done+S.items.length)),dryRun:S.dryRun,message,failedStage:stage==='error'?(S.lastError?.stage||''):''},()=>{void chrome.runtime.lastError;}); } catch(e) { /* solo telemetria: non blocca Meta */ } }
  }
  setInterval(() => { if (curTitle && document.title !== curTitle) document.title = curTitle; }, 1000);

  function status(msg) {
    if(msg.startsWith('StoryFlow:'))emitStage(lastStage,msg.replace(/^StoryFlow: /,''));
    curTitle = msg;
    document.title = msg;
    if (!box && document.body) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;top:8px;right:8px;z-index:999999;background:#111;color:#fff;font:12px/1.4 monospace;padding:10px 12px;max-width:420px;white-space:pre-wrap;border:2px solid #e61928;border-radius:8px;';
      document.body.appendChild(box);
    }
    if (box && S) box.textContent = msg + '\n' + S.log.slice(-8).join('\n');
  }

  const getState = () => new Promise(res => chrome.storage.local.get(['sf_state'], r => res(r.sf_state)));
  const saveState = () => new Promise(res => chrome.storage.local.set({ sf_state: S }, res));

  function restart() {
    history.replaceState(null, '', COMPOSER + (S.dryRun ? '#zwtest' : '#zwauto-next'));
    location.reload();
  }

  // Il vecchio override di HTMLInputElement.prototype.click() qui non vedeva
  // necessariamente i click generati dagli script Meta: i content script
  // Chrome girano in un isolated world. Il file-picker-hook.js (MAIN) li
  // intercetta e li segnala tramite eventi sul DOM condiviso.
  async function uploadImage(blob, id) {
    const ARM = 'storyflow-file-picker-arm';
    const DISARM = 'storyflow-file-picker-disarm';
    const READY = 'storyflow-file-picker-ready';
    const PICK = 'storyflow-file-picker-input';

    const originalInputs = new Set(document.querySelectorAll('input[type="file"]'));
    const appearedInputs = [];
    const file = new File([blob], `story-${id}.jpg`, {
      type: blob.type || 'image/jpeg',
      lastModified: Date.now()
    });

    let hookReady = false;
    let delivered = false;
    let deliveryMode = '';
    let uploadError = null;

    const remember = (node) => {
      if (!(node instanceof Element)) return;
      if (node.matches('input[type="file"]') && !originalInputs.has(node)) appearedInputs.push(node);
      for (const input of node.querySelectorAll('input[type="file"]')) {
        if (!originalInputs.has(input)) appearedInputs.push(input);
      }
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) remember(node);
    });

    function deliver(input, mode) {
      if (delivered || !(input instanceof HTMLInputElement) || input.type !== 'file') return false;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        if (!input.files || input.files.length !== 1) throw new Error('file non assegnato all’input');
        // Segna subito l'input come gestito: eventuali handler Meta che
        // scattano sincronicamente non devono provocare un secondo invio.
        delivered = true;
        deliveryMode = mode;
        // Gli eventi sono sintetici (isTrusted=false), ma transitano nel DOM
        // condiviso come nel caricamento usato dalla versione precedente.
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch (err) {
        uploadError = err;
        return false;
      }
    }

    const onReady = () => { hookReady = true; };
    const onPicker = (event) => { deliver(event.target, 'intercettazione MAIN'); };
    document.addEventListener(READY, onReady, true);
    document.addEventListener(PICK, onPicker, true);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.dispatchEvent(new Event(ARM));

    try {
      const add = await waitFor(() => btn('Aggiungi foto/video'), 20000);
      if (!add) throw new Error('pulsante Aggiungi foto/video non trovato');
      add.click();

      // Consente a React di creare un input asincronamente e al bridge MAIN
      // di intercettarlo prima di ricorrere alla ricerca nel DOM.
      await waitFor(() => delivered, 6000, 100);
      if (!delivered) {
        const inputs = [...document.querySelectorAll('input[type="file"]')];
        const candidates = [...new Set([...appearedInputs, ...inputs])]
          .filter(input => input instanceof HTMLInputElement && !input.disabled)
          .sort((a, b) => {
            const score = input =>
              (originalInputs.has(input) ? 0 : 4) +
              (/image|jpeg|jpg|png/i.test(input.accept || '') ? 2 : 0) +
              (input.isConnected ? 1 : 0);
            return score(b) - score(a);
          });
        for (const input of candidates) {
          if (deliver(input, 'ricerca input DOM')) break;
        }
      }

      if (!delivered) {
        const inputCount = document.querySelectorAll('input[type="file"]').length;
        const detail = uploadError ? `; dettaglio: ${uploadError.message}` : '';
        throw new Error(`input file non intercettato (hook MAIN: ${hookReady ? 'attivo' : 'non attivo'}, input nel DOM: ${inputCount}${detail}). Aggiorna l’estensione e ricarica Meta; se persiste, Meta potrebbe aver modificato il composer`);
      }

      status(`StoryFlow: immagine passata a Meta (${deliveryMode}), attendo anteprima...`);
      if (!await waitFor(() => btn('Aggiungi link'), 25000)) {
        throw new Error(`immagine inviata (${deliveryMode}) ma Meta non mostra «Aggiungi link»: verificare formato e anteprima`);
      }
    } finally {
      document.dispatchEvent(new Event(DISARM));
      document.removeEventListener(READY, onReady, true);
      document.removeEventListener(PICK, onPicker, true);
      observer.disconnect();
    }
  }

  async function addSwipeLink(url) {
    btn('Aggiungi link').click();
    const inp = await waitFor(() => document.querySelector('[role=dialog] input[type=url]'), 8000);
    if (!inp) throw new Error('finestra link non aperta');
    setInput(inp, url);
    await sleep(2000);
    const ap = await waitFor(() => btn('Applica', inp.closest('[role=dialog]')), 8000);
    if (!ap) throw new Error('Applica link disattivato');
    ap.click();
    if (!await waitFor(() => btn('Modifica link'), 8000)) throw new Error('link non salvato');
  }

  const findStickers = () => [...document.querySelectorAll('div')].filter(d => d.style.height === '39px' && d.style.position === 'absolute');
  const findSticker = () => findStickers()[0];
  const goodSticker = (label) => findStickers().find(s => (s.innerText || '').toUpperCase().includes(label.toUpperCase()));
  const editor = () => [...document.querySelectorAll('[role=dialog]')].find(d => txt(d).startsWith('Modifica foto'));

  function editorImg() {
    const d = editor(); if (!d) return null;
    return [...d.querySelectorAll('img')].map(i => ({ i, h: i.getBoundingClientRect().height })).filter(o => o.h > 300).sort((a, b) => b.h - a.h).map(o => o.i)[0] || null;
  }

  function stickerPos(label) {
    const st = goodSticker(label), img = editorImg();
    if (!st || !img) return null;
    const N = st.getBoundingClientRect(), J = img.getBoundingClientRect();
    const t = (N.top - J.top) / J.height, b = (N.bottom - J.top) / J.height, l = (N.left - J.left) / J.width, r = (N.right - J.left) / J.width;
    return { ok: t > 0.76 && b < 0.99 && l > -0.02 && r < 1.02, t: +t.toFixed(3), b: +b.toFixed(3) };
  }

  async function dragSticker(label) {
    const st = goodSticker(label), img = editorImg();
    if (!st || !img) throw new Error('adesivo o immagine non trovati');
    img.scrollIntoView({ block: 'center' });
    await sleep(300);
    const I = img.getBoundingClientRect(), S0 = st.getBoundingClientRect();
    const sx = S0.left + S0.width / 2, sy = S0.top + S0.height / 2, ex = I.left + I.width / 2, ey = I.top + 0.88 * I.height;
    const o = (x, y, b) => ({ clientX: x, clientY: y, screenX: x, screenY: y, buttons: b, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, composed: true, cancelable: true });
    const t0 = document.elementFromPoint(sx, sy) || st;
    t0.dispatchEvent(new PointerEvent('pointerdown', o(sx, sy, 1)));
    t0.dispatchEvent(new MouseEvent('mousedown', o(sx, sy, 1)));
    for (let i = 1; i <= 25; i++) {
      const x = sx + (ex - sx) * i / 25, y = sy + (ey - sy) * i / 25, e = document.elementFromPoint(x, y) || t0;
      e.dispatchEvent(new PointerEvent('pointermove', o(x, y, 1)));
      e.dispatchEvent(new MouseEvent('mousemove', o(x, y, 1)));
      await sleep(16);
    }
    const te = document.elementFromPoint(ex, ey) || t0;
    te.dispatchEvent(new PointerEvent('pointerup', o(ex, ey, 0)));
    te.dispatchEvent(new MouseEvent('mouseup', o(ex, ey, 0)));
    await sleep(PAUSA);
  }

  function photoEditBtn() {
    const ml = btn('Modifica link');
    if (!ml) return null;
    const mlTop = ml.getBoundingClientRect().top;
    const mod = [...document.querySelectorAll('[role=button]')]
      .filter(e => txt(e) === 'Modifica')
      .sort((a, b) => Math.abs(a.getBoundingClientRect().top - mlTop) - Math.abs(b.getBoundingClientRect().top - mlTop))[0];
    return mod && Math.abs(mod.getBoundingClientRect().top - mlTop) <= 40 ? mod : null;
  }

  async function closeEditor(afterCheck = false) {
    await sleep(PAUSA);
    const apEd = await waitFor(() => btn('Applica', editor()), afterCheck ? 3000 : 6000);
    if (apEd) {
      apEd.click();
    } else if (afterCheck) {
      const an = btn('Annulla', editor());
      if (!an) throw new Error('Annulla di Modifica foto non trovato');
      an.click();
      await sleep(1500);
      if (btn('Elimina modifiche')) throw new Error('Meta chiede di scartare modifiche dopo il controllo');
    } else {
      throw new Error('Applica di Modifica foto non trovato');
    }
    if (!await waitFor(() => !editor() && btn('Condividi'), 20000)) throw new Error('editor non chiuso');
    await sleep(PAUSA);
  }

  async function addLinkSticker(url, stickerText) {
    const mod = photoEditBtn();
    if (!mod) throw new Error('pulsante Modifica non trovato');
    mod.click();
    const more = await waitFor(() => { const e = editor(); return e && btn('Altri adesivi', e); }, 10000);
    if (!more) throw new Error('Altri adesivi non trovato');
    more.click();

    for (let k = 0; k < 5; k++) {
      const old = findSticker(); if (!old) break;
      const rm = old.querySelector('button[aria-label=remove]'); if (!rm) break;
      rm.click(); await sleep(800);
    }

    let create = await waitFor(() => document.querySelector('[aria-label="Create link sticker"]'), 8000);
    if (!create) throw new Error('adesivo Link non trovato');

    // CLIC NATIVO AUTOMATICO TRAMITE CHROME DEBUGGER (Sostituisce Claude Cowork!)
    create.scrollIntoView({ block: 'center' });
    await sleep(400);
    const rect = create.getBoundingClientRect();
    status('StoryFlow: Clic nativo automatico su Link Sticker...');
    await chrome.runtime.sendMessage({
      cmd: 'TRUSTED_CLICK',
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });

    const heading = () => [...document.querySelectorAll('[role=heading]')].find(e => txt(e) === 'Aggiungi adesivo con link');
    const h = await waitFor(heading, 15000, 250);
    if (!h) throw new Error('Popup adesivo Link non aperto dopo il clic automatico');

    status(`StoryFlow: compilo adesivo (${stickerText})`);
    let pop = h; while (pop && pop.querySelectorAll('input').length < 2) pop = pop.parentElement;
    const [iu, it] = pop.querySelectorAll('input');
    setInput(iu, url); await sleep(600);
    setInput(it, stickerText); await sleep(900);
    if (iu.value !== url || it.value !== stickerText) throw new Error('campi adesivo non compilati');

    const ap = await waitFor(() => btn('Applica', pop), 6000);
    if (!ap) throw new Error('Applica adesivo disattivato');
    ap.click();

    if (!await waitFor(() => !heading() && goodSticker(stickerText), 8000)) throw new Error('adesivo non creato');
    await sleep(1000);

    let pos = null;
    for (let k = 0; k < 3 && !(pos && pos.ok); k++) {
      await dragSticker(stickerText);
      pos = stickerPos(stickerText);
    }
    if (!pos || !pos.ok) throw new Error('adesivo fuori dal rosso ' + JSON.stringify(pos));
    await sleep(PAUSA);
    await closeEditor();
    return pos;
  }

  async function verifySticker() {
    const mod = photoEditBtn();
    if (!mod) return { ok: false, why: 'Modifica non trovato per verifica' };
    mod.click();
    if (!await waitFor(() => editorImg(), 10000)) return { ok: false, why: 'editor non riaperto' };
    await sleep(PAUSA);
    const linkBtn = () => document.querySelector('[aria-label="Create link sticker"]');
    let panel = false, found = null;
    for (let k = 0; k < 2 && !found; k++) {
      const more = await waitFor(() => { const e = editor(); return e && btn('Altri adesivi', e); }, 6000);
      if (more) { more.click(); panel = true; }
      found = await waitFor(linkBtn, 5000);
    }
    await closeEditor(true);
    if (!panel) return { ok: false, why: 'pannello Adesivi non aperto' };
    if (found) return { ok: false, why: 'pulsante Link ancora disponibile: adesivo assente' };
    return { ok: true };
  }

  async function stickerVerified(url, stickerText) {
    let last = '', lastPos = null;
    for (let a = 1; a <= STICKER_TRIES; a++) {
      lastPos = await addLinkSticker(url, stickerText);
      emitStage('verify','Verifica presenza e posizione adesivo');
      status('StoryFlow: controllo presenza adesivo...');
      const v = await verifySticker();
      if (v.ok) return { pos: lastPos, tries: a };
      last = v.why;
      S.log.push(` ! tentativo ${a}: ${v.why}`); await saveState();
    }
    throw new Error(`adesivo non confermato (${last})`);
  }

  async function share() {
    if (editor()) throw new Error('editor ancora aperto prima di Condividi');
    await sleep(PAUSA);
    const c = btn('Condividi');
    if (!c) throw new Error('pulsante Condividi non trovato');
    c.click();
    const ok = await waitFor(() =>
      !location.pathname.includes('story_composer') ||
      /storia.{0,40}(condivisa|pubblicata)|(condivisa|pubblicata).{0,40}storia/i.test(document.body.innerText), 90000, 500);
    return !!ok;
  }

  async function main() {
    await waitFor(() => document.body && document.readyState !== 'loading', 60000, 200);
    ensureOverlay();
    await sleep(2500);
    S = await getState();
    if (!S || !S.items || !S.items.length) {
      if(overlay){overlay.remove();overlay=null;}
      status('StoryFlow FINE | Coda completata');
      return;
    }

    const it = S.items[0];
    S.total=S.total||S.done+S.items.length;
    S.done++;
    await saveState();
    emitStage('start',`Avvio storia ${S.done} di ${S.total}`);

    status(`StoryFlow: storia ${S.done} – ${it.title.slice(0, 45)}`);
    try {
      if (it.metaTarget) {
        if (!await waitFor(() => document.body.innerText.includes(it.metaTarget), 20000)) {
          throw new Error(`"Condividi su" non include "${it.metaTarget}"`);
        }
      }
      const blob = dataUrlToBlob(it.dataUrl);
      emitStage('image','Caricamento immagine');
      status(`StoryFlow: carico immagine editata...`);
      await uploadImage(blob, it.id);
      emitStage('link','Inserimento collegamento');
      status(`StoryFlow: aggiungo Swipe Link...`);
      await addSwipeLink(it.url);
      emitStage('sticker','Creazione adesivo cliccabile');
      const v = await stickerVerified(it.url, it.stickerText || 'ZONAWRESTLING.NET');

      if (S.dryRun) {
        S.log.push(`TEST OK (non condivisa): ${it.title} | pos ${v.pos.t}-${v.pos.b}`);
        S.items.shift();
        await saveState();
        emitStage('done','Test completato: storia non condivisa');
        status(`ZW FINE TEST | ok:1`);
        return;
      }

      emitStage('publish','Pubblicazione su Meta');
      status('StoryFlow: pubblico la storia...');
      const shared = await share();
      if(!shared) throw new Error('Meta non ha confermato la pubblicazione entro il limite previsto');
      S.ok++;
      S.log.push(`OK: ${it.title}`);
    } catch (e) {
      // Salva la vera causa e il punto del flusso PRIMA di passare allo stato errore.
      const failedStage=lastStage;
      const message=String(e?.message||e||'Errore sconosciuto');
      S.err++;
      S.lastError={stage:failedStage,message,id:String(it.id||''),at:Date.now()};
      S.log.push(`ERRORE ${it.id}: ${message}`);
      await saveState();
      emitStage('error',`Errore durante ${failedStage}: ${message}`);
    }

    // Rimuove la storia appena processata dalla coda e passa alla successiva
    S.items.shift();
    await saveState();
    if (!S.items.length) {
      // Non sovrascrivere il dettaglio con il generico «Coda conclusa».
      const finishMessage=S.err
        ? `Coda conclusa: ${S.ok} completate, ${S.err} errori. Ultima causa (${S.lastError?.stage||'non rilevata'}): ${S.lastError?.message||'controlla il registro'}`
        : `Coda conclusa: ${S.ok} completate, ${S.err} errori`;
      emitStage(S.err?'error':'done',finishMessage);
      status(`ZW FINE | ok:${S.ok} err:${S.err}`);
      return;
    }
    await sleep(3000);
    restart();
  }

  main();
})();