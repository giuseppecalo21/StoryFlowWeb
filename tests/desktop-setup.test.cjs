// Prova l'app desktop vera (Electron): "Trova il nome in Meta" e "Verifica" su una finta pagina delle storie.
// Le richieste https della vista Meta ricevono la pagina finta, il pannello arriva da un server locale.
//   cd desktop && xvfb-run -a npx electron ../tests/desktop-setup.test.cjs   (da root aggiungere --no-sandbox)
'use strict';
const { app, session, webContents } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const MOCK = `<!doctype html><html lang="it"><body style="font-family:sans-serif;padding:120px 40px">
  <div>Pubblica su</div><div id="acc"><span id="page">Zona Prova</span> e zona_prova</div>
  <script>window.metaClicks=0;document.addEventListener('click',()=>{window.metaClicks++;});</script></body></html>`;

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
    await until(() => meta.executeJavaScript('!!document.querySelector("[data-storyflow=picker]").shadowRoot.querySelector("button.main")'));
    await click(meta, 'document.querySelector("[data-storyflow=picker]").shadowRoot.querySelector("button.main")');
    const picked = await until(() => studio.executeJavaScript('window.__res'));
    check('Il nome cliccato arriva al pannello identico', picked && picked.ok === true && picked.text === 'Zona Prova', JSON.stringify(picked));
    check('Durante la scelta nessun clic arriva a Meta', await meta.executeJavaScript('window.metaClicks') === 0);

    const verified = await studio.executeJavaScript('StoryFlowNative.verifyMetaTarget("Zona Prova e zona_prova")');
    check('Verifica: nome presente nella pagina delle storie', verified && verified.ok === true, JSON.stringify(verified));
    // Mentre una verifica è in corso non si può avviare altro.
    const [first, second] = await studio.executeJavaScript('Promise.all([StoryFlowNative.verifyMetaTarget("Zona Prova"), StoryFlowNative.verifyMetaTarget("Zona Prova")])');
    check('Una sola operazione alla volta', first.ok === true && second.reason === 'busy', JSON.stringify([first, second]));
  } catch (e) {
    check('Prova completata senza eccezioni', false, String(e && e.stack || e));
  }
  server.close();
  app.exit(failures ? 1 : 0);
}
