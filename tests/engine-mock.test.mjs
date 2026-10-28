// Prova il motore (engine/composer.js) sul finto composer Meta in italiano, inglese e tedesco.
//   node tests/engine-mock.test.mjs
// Richiede Playwright con Chromium. Il tedesco non è supportato: serve a verificare che
// l'errore elenchi i pulsanti visibili, così da poter aggiornare UI_LABELS in fretta.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineCode = readFileSync(join(root, 'engine', 'composer.js'), 'utf8');
const mockHtml = readFileSync(join(root, 'tests', 'mock-composer.html'));
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(mockHtml); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/mock`;

async function run(lang, dryRun, uiLang) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const state = {
    items: [{ id: 'a1', title: 'Titolo di prova', url: 'https://example.com/articolo', dataUrl: JPEG, stickerText: 'EXAMPLE.COM', metaTarget: 'My Page', ...(uiLang ? { uiLang } : {}) }],
    dryRun, done: 0, ok: 0, err: 0, total: 1, log: []
  };
  await page.exposeFunction('__host', (kind, payload) => host(kind, payload));
  const events = { finished: false, next: 0, progress: [], state: null };
  function host(kind, payload) {
    if (kind === 'save') events.state = JSON.parse(payload);
    if (kind === 'progress') events.progress.push(JSON.parse(payload));
    if (kind === 'next') events.next++;
    if (kind === 'finish') events.finished = true;
  }
  await page.addInitScript(([initial]) => {
    let st = initial;
    window.StoryFlowNative = {
      isQueueRunning: () => true,
      getState: () => st,
      saveState: json => { st = json; window.__host('save', json); },
      sendProgress: json => window.__host('progress', json),
      // Il motore chiama questi metodi senza attendere: come nell'app vera, il "clic vero" arriva dall'esterno.
      trustedClick: (x, y) => { document.elementFromPoint(x, y)?.click(); },
      trustedDrag: () => {},
      nextStory: () => window.__host('next', ''),
      finishQueue: () => window.__host('finish', '')
    };
  }, [JSON.stringify(state)]);
  await page.goto(`${base}?lang=${lang}#${dryRun ? 'sftest' : 'sfauto'}`);
  await page.addScriptTag({ content: engineCode });
  const deadline = Date.now() + 150000;
  while (!events.finished && !events.next && Date.now() < deadline) await page.waitForTimeout(500);
  const mock = await page.evaluate(() => ({ shared: window.__mock.shared, saved: window.__mock.saved }));
  await browser.close();
  return { events, mock };
}

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}

for (const lang of ['it', 'en']) {
  const test = await run(lang, true);
  const st = test.events.state;
  check(`[${lang}] test: coda conclusa`, test.events.finished, st?.log?.slice(-2).join(' / '));
  check(`[${lang}] test: adesivo posizionato e non condiviso`, Boolean(st?.log?.some(l => l.startsWith('TEST OK'))) && !test.mock.shared,
    JSON.stringify(test.mock.saved));
  const real = await run(lang, false);
  check(`[${lang}] pubblicazione: storia condivisa`, real.mock.shared && real.events.state?.ok === 1, real.events.state?.log?.slice(-2).join(' / '));
}

// Messaggi per l'utente nella lingua del pannello (uiLang), anche con Meta in un'altra lingua.
{
  const es = await run('en', true, 'es');
  const msgs = es.events.progress.map(p => `${p.msgLang}:${p.message}`);
  check('[uiLang es] avanzamento in spagnolo', msgs.includes('es:Subiendo la imagen') && msgs.includes('es:¡Prueba completada con éxito!'), msgs.join(' / '));
  const old = await run('it', true);
  check('[senza uiLang] avanzamento in italiano', old.events.progress.some(p => p.msgLang === 'it' && p.message === 'Caricamento immagine'));
}

const de = await run('de', false);
const lastLog = de.events.state?.log?.slice(-1)[0] || '';
check('[de] lingua non supportata: riprova automatica con diagnostica', de.events.next === 1 && /Pulsanti visibili: .*Foto\/Video hinzufügen/.test(lastLog), lastLog);

server.close();
process.exit(failures ? 1 : 0);
