// Prova il motore (engine/composer.js) sul finto composer Meta in italiano, inglese, spagnolo, francese, portoghese e tedesco.
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
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/mock`;

// opts.target: nome della pagina cercato dal motore; opts.query: parametri in più per il finto composer;
// opts.composerPath: la pagina ha l'indirizzo vero delle storie, quindi dopo Condividi serve una conferma nel testo.
async function run(lang, dryRun, uiLang, opts = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const state = {
    items: [{ id: 'a1', title: 'Titolo di prova', url: 'https://example.com/articolo', dataUrl: JPEG, stickerText: 'EXAMPLE.COM', metaTarget: opts.target || 'My Page', ...(uiLang ? { uiLang } : {}) }],
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
  const started = Date.now();
  await page.goto(`${opts.composerPath ? origin + '/latest/story_composer/' : base}?lang=${lang}${opts.query || ''}#${dryRun ? 'sftest' : 'sfauto'}`);
  await page.addScriptTag({ content: engineCode });
  const deadline = Date.now() + 150000;
  while (!events.finished && !events.next && Date.now() < deadline) await page.waitForTimeout(500);
  const mock = await page.evaluate(() => ({ shared: window.__mock.shared, saved: window.__mock.saved }));
  await browser.close();
  return { events, mock, seconds: (Date.now() - started) / 1000 };
}

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}

for (const lang of ['it', 'en', 'es', 'fr', 'pt']) {
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

// Nome della pagina scelto con Meta in italiano ("Pagina e profilo"), Meta ora in inglese ("Pagina and profilo").
{
  const r = await run('en', true, 'it', { target: 'My Page e my_page', query: '&page=' + encodeURIComponent('My Page and my_page') });
  const st = r.events.state;
  check('[en] nome scelto in italiano: pagina trovata anche con "and"', Boolean(st?.log?.some(l => l.startsWith('TEST OK'))), st?.log?.slice(-2).join(' / '));
  check('[en] nome scelto in italiano: annotato nel registro', Boolean(st?.log?.some(l => l.includes('Pagina trovata come "My Page and my_page"'))));
}

// Pagina assente: errore subito, niente nuovo tentativo, la coda si ferma.
{
  const r = await run('it', false, 'it', { target: 'Altra Pagina' });
  const st = r.events.state;
  const last = r.events.progress.slice(-1)[0] || {};
  check('Pagina assente: errore senza nuovo tentativo', r.events.finished && r.events.next === 0 && st?.err === 1 && !r.mock.shared, st?.log?.slice(-2).join(' / '));
  check('Pagina assente: errore in pochi secondi', r.seconds < 20, `${r.seconds.toFixed(1)} s`);
  check('Pagina assente: messaggio riconosciuto dal pannello', last.stage === 'error' && /Canale "Altra Pagina" non trovato/.test(last.message), last.message);
  check('Pagina assente: avanzamento mentre si controlla la pagina', r.events.progress.some(p => p.message === 'Controllo del nome della pagina'));
}

// Scritta "dove verrà pubblicata la storia" già nella pagina: non è una conferma di pubblicazione.
{
  const ok = await run('it', false, 'it', { composerPath: true, query: '&static=1' });
  check('Scritta simile a una conferma: la conferma vera viene riconosciuta', ok.mock.shared && ok.events.state?.ok === 1, ok.events.state?.log?.slice(-2).join(' / '));
  const no = await run('it', false, 'it', { composerPath: true, query: '&static=1&noshare=1' });
  check('Scritta simile a una conferma: senza pubblicazione nessuna storia risulta pubblicata', no.events.state?.ok === 0 && no.events.next === 1,
    no.events.state?.log?.slice(-1).join(' / '));
}

const de = await run('de', false);
const lastLog = de.events.state?.log?.slice(-1)[0] || '';
check('[de] lingua non supportata: riprova automatica con diagnostica', de.events.next === 1 && /Pulsanti visibili: .*Foto\/Video hinzufügen/.test(lastLog), lastLog);

server.close();
process.exit(failures ? 1 : 0);
