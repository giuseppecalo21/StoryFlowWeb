// Prova l'app desktop vera (Electron): "Trova il nome in Meta" e "Verifica" su una finta pagina delle storie,
// poi la coda: schermo acceso, Meta nascosta e "Ferma la coda dopo questa storia".
// Le richieste https della vista Meta ricevono la pagina finta, il pannello arriva da un server locale.
//   cd desktop && xvfb-run -a npx electron ../tests/desktop-setup.test.cjs   (da root aggiungere --no-sandbox)
'use strict';
const { app, session, webContents, powerSaveBlocker } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const MOCK = `<!doctype html><html lang="it"><body style="font-family:sans-serif;padding:120px 40px">
  <div>Pubblica su</div><div id="acc"><span id="page">Zona Prova</span> e zona_prova</div>
  <script>window.metaClicks=0;document.addEventListener('click',()=>{window.metaClicks++;});
  // Nella coda il motore vero non parte: i suoi messaggi all'app li mandiamo a mano.
  if(location.search.includes('sf_ts='))window.__SF_COMPOSER_ACTIVE__=true;</script></body></html>`;

let failures = 0;
// Scrittura sincrona: l'uscita di Electron non deve perdere le righe.
const print = line => fs.writeSync(1, line + '\n');
const check = (name, cond, detail = '') => { print(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(200); }
  return null;
}
const byUrl = part => webContents.getAllWebContents().find(w => w.getURL().includes(part));
async function click(wc, expr) {
  const r = await wc.executeJavaScript(`(()=>{const e=${expr};if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
  if (!r) return false;
  const x = Math.round(r.x), y = Math.round(r.y);
  wc.sendInputEvent({ type: 'mouseMove', x, y });
  wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  return true;
}

// L'app usa la copia in desktop/engine (aggiornata da "npm start"/build): qui la allineiamo al repository.
if (fs.existsSync(path.join(root, 'desktop', 'engine'))) {
  for (const f of ['composer.js', 'manifest.json', 'meta-setup.js']) fs.copyFileSync(path.join(root, 'engine', f), path.join(root, 'desktop', 'engine', f));
}
// Registra le richieste di schermo acceso fatte dall'app.
const screenLocks = { started: 0, stopped: 0 };
const startLock = powerSaveBlocker.start.bind(powerSaveBlocker), stopLock = powerSaveBlocker.stop.bind(powerSaveBlocker);
powerSaveBlocker.start = type => { if (type === 'prevent-display-sleep') screenLocks.started++; return startLock(type); };
powerSaveBlocker.stop = id => { screenLocks.stopped++; return stopLock(id); };
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sf-desktop-')));
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch (_) { res.statusCode = 404; res.end(); }
});
server.listen(0, '127.0.0.1', () => {
  process.env.STORYFLOW_STUDIO_URL = `http://127.0.0.1:${server.address().port}/index.html`;
  process.env.STORYFLOW_ENGINE_MANIFEST_URL = `http://127.0.0.1:${server.address().port}/engine/manifest.json`;
  app.whenReady().then(() => {
    session.fromPartition('persist:meta').protocol.handle('https', () => new Response(MOCK, { headers: { 'content-type': 'text/html' } }));
  });
  require(path.join(root, 'desktop', 'src', 'main.js'));
  app.whenReady().then(run);
});

async function run() {
  try {
    const studio = await until(() => byUrl('/index.html'));
    await until(async () => studio.executeJavaScript('document.readyState==="complete" && !!window.StoryFlowNative'));
    check('Il pannello vede le funzioni dell’onboarding', await studio.executeJavaScript(
      `['pickMetaTarget','verifyMetaTarget','openMetaComposer','cancelMetaSetup'].every(n=>typeof StoryFlowNative[n]==='function')`));

    await studio.executeJavaScript('window.__res=null;StoryFlowNative.pickMetaTarget().then(r=>{window.__res=r;});0');
    const meta = await until(() => byUrl('story_composer/?sf_setup='));
    check('“Trova il nome” apre la pagina delle storie', Boolean(meta));
    await until(() => meta.executeJavaScript('!!document.querySelector("[data-storyflow=picker]")'));
    await click(meta, 'document.getElementById("page")');
    await until(() => meta.executeJavaScript('!!document.querySelector("[data-storyflow=picker]").shadowRoot.querySelector("button.choice")'));
    await click(meta, 'document.querySelector("[data-storyflow=picker]").shadowRoot.querySelector("button.choice")');
    await until(() => meta.executeJavaScript('!!document.querySelector("[data-storyflow=picker]").shadowRoot.querySelector("button.main")'));
    await click(meta, 'document.querySelector("[data-storyflow=picker]").shadowRoot.querySelector("button.main")');
    const picked = await until(() => studio.executeJavaScript('window.__res'));
    check('Il nome scelto arriva al pannello identico, congiunzione compresa', picked && picked.ok === true && picked.text === 'Zona Prova e zona_prova', JSON.stringify(picked));
    check('Durante la scelta nessun clic arriva a Meta', await meta.executeJavaScript('window.metaClicks') === 0);

    const verified = await studio.executeJavaScript('StoryFlowNative.verifyMetaTarget("Zona Prova e zona_prova")');
    check('Verifica: nome presente nella pagina delle storie', verified && verified.ok === true, JSON.stringify(verified));
    // Mentre una verifica è in corso non si può avviare altro.
    const [first, second] = await studio.executeJavaScript('Promise.all([StoryFlowNative.verifyMetaTarget("Zona Prova"), StoryFlowNative.verifyMetaTarget("Zona Prova")])');
    check('Una sola operazione alla volta', first.ok === true && second.reason === 'busy', JSON.stringify([first, second]));

    // Coda di tre storie: lo stop arriva durante la prima, la coda si chiude prima della seconda.
    const toolbar = await until(() => byUrl('shell.html'));
    const front = () => toolbar.executeJavaScript('document.querySelector(".tab.active")?.dataset.view');
    const story = id => ({ id, title: 'Storia ' + id, url: 'https://example.com/' + id, dataUrl: 'data:,' });
    await studio.executeJavaScript(`window.__progress=[];window.__onStoryFlowNativeProgress=p=>window.__progress.push(p);
      StoryFlowNative.startQueue(${JSON.stringify(JSON.stringify({ reqId: 't', dryRun: false, items: [story('a'), story('b'), story('c')] }))});0`);
    const composer = await until(() => byUrl('story_composer/?sf_ts='));
    await until(() => composer.executeJavaScript('document.readyState==="complete"'));
    check('Coda: schermo tenuto acceso', screenLocks.started === 1 && screenLocks.stopped === 0, JSON.stringify(screenLocks));
    check('Coda: resta in primo piano il pannello', await front() === 'studio');
    await toolbar.executeJavaScript('document.querySelector(".tab[data-view=meta]").click()');
    await sleep(300);
    check('Coda: la vista Meta non si può aprire', await front() === 'studio');
    const state = (items, done) => JSON.stringify({ items, dryRun: false, done, ok: done, err: 0, total: 3, log: [] });
    await composer.executeJavaScript(`StoryFlowNative.saveState(${JSON.stringify(state([story('a'), story('b'), story('c')], 0))});
      StoryFlowNative.sendProgress(JSON.stringify({stage:'image',index:1,total:3}));0`);
    const progress = await until(() => studio.executeJavaScript('window.__progress[0]'));
    check('Avanzamento: indica la storia in lavorazione', progress && progress.itemId === 'a', JSON.stringify(progress));
    await studio.executeJavaScript('StoryFlowNative.setStopAfterCurrent(true);0');
    // Un nuovo tentativo sulla stessa storia non è "la storia successiva": la coda prosegue.
    const firstUrl = composer.getURL();
    await composer.executeJavaScript(`StoryFlowNative.saveState(${JSON.stringify(state([{ ...story('a'), _retries: 1 }, story('b'), story('c')], 0))});
      StoryFlowNative.nextStory(false);0`);
    await until(() => composer.getURL() !== firstUrl && !composer.isLoading());
    await until(() => composer.executeJavaScript('document.readyState==="complete"'));
    check('Stop: un nuovo tentativo della stessa storia non ferma la coda', await studio.executeJavaScript('StoryFlowNative.isQueueRunning()'));
    await composer.executeJavaScript(`StoryFlowNative.saveState(${JSON.stringify(state([story('b'), story('c')], 1))});
      StoryFlowNative.nextStory(false);0`);
    const stopped = await until(() => studio.executeJavaScript('window.__progress.find(p=>p.stage==="stopped")'));
    check('Stop: la coda si ferma dopo la storia attuale', stopped && stopped.ok === 1 && JSON.stringify(stopped.remainingIds) === '["b","c"]', JSON.stringify(stopped));
    check('Stop: coda chiusa e schermo libero', !(await studio.executeJavaScript('StoryFlowNative.isQueueRunning()')) && screenLocks.stopped === 1, JSON.stringify(screenLocks));
    await toolbar.executeJavaScript('document.querySelector(".tab[data-view=meta]").click()');
    check('Dopo la coda la vista Meta si apre di nuovo', Boolean(await until(async () => (await front()) === 'meta', 3000)));
  } catch (e) {
    check('Prova completata senza eccezioni', false, String(e && e.stack || e));
  }
  server.close();
  app.exit(failures ? 1 : 0);
}
