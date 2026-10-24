// Prova il pannello (index.html + studio.js) con feed, immagini e Gemini simulati.
//   node tests/studio.test.mjs [cartella-screenshot]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const file = join(root, path === '/' ? 'index.html' : path.slice(1));
    if (!file.startsWith(root)) throw new Error('fuori dalla cartella');
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch (_) { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const FEED = {
  source: 'wp',
  items: [
    { id: '101', title: 'Il campione annuncia il ritiro dopo vent’anni di carriera', url: 'https://example.com/a', image: 'https://example.com/a.jpg' },
    { id: '102', title: 'Nuovo evento in arrivo a Milano a dicembre', url: 'https://example.com/b', image: 'https://example.com/b.jpg' },
    { id: '103', title: 'Svelata la card completa dello show di sabato', url: 'https://example.com/c', image: 'https://example.com/c.jpg' }
  ]
};
const AI_TITLES = ['Vent’anni di carriera, poi l’annuncio che nessuno si aspettava', 'Il campione dice basta: ecco cosa ha deciso', 'È davvero finita? L’annuncio del campione'];

let failures = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failures++; };

/**
 * gemini: 'fallback' (primo modello al limite d'uso, secondo sovraccarico, terzo risponde),
 *         'hang' (nessuna risposta), 'quota' (tutti al limite d'uso).
 */
async function openStudio(browser, { desktop = false, viewport = { width: 1440, height: 900 }, gemini = 'fallback', presetKey = '' } = {}) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  const calls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([key, fast]) => {
    if (key) localStorage.setItem('storyflow.studio.ai.v1', JSON.stringify({ key, model: '' }));
    if (fast) { window.__SF_AI_TIMEOUT_MS = 700; window.__SF_AI_TOTAL_MS = 6000; }
  }, [presetKey, gemini === 'hang']);
  if (desktop) {
    await page.addInitScript(() => {
      window.__started = null;
      window.StoryFlowNative = {
        getPlatform: () => 'desktop', startQueue: json => { window.__started = JSON.parse(json); },
        isQueueRunning: () => false, openMetaLogin: () => {}, getLastReport: () => '{"available":false}',
        getEngineInfo: () => '{"version":"4.0.0","source":"integrato"}'
      };
    });
  }
  // Immagine 1200x800 generata al volo per le anteprime.
  const png = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const g = c.getContext('2d'); g.fillStyle = '#3a6'; g.fillRect(0, 0, 1200, 800); g.fillStyle = '#fff'; g.fillRect(400, 200, 400, 400);
    return [...new Uint8Array(await (await fetch(c.toDataURL('image/png'))).arrayBuffer())];
  }));
  await page.route('**/proxy.php?action=feed*', r => r.fulfill({ json: FEED }));
  await page.route('**/proxy.php?action=img*', r => r.fulfill({ body: png, contentType: 'image/png' }));
  await page.route('https://generativelanguage.googleapis.com/**', async r => {
    const url = r.request().url();
    if (!url.includes(':generateContent')) {
      return r.fulfill({ json: { models: [{ name: 'models/gemini-9-flash-lite', supportedGenerationMethods: ['generateContent'] }] } });
    }
    const model = decodeURIComponent(url.split('/models/')[1].split(':')[0]);
    const body = JSON.parse(r.request().postData());
    calls.push({ model, key: r.request().headers()['x-goog-api-key'], keyInUrl: url.includes('key='), prompt: body.contents[0].parts[0].text });
    if (gemini === 'hang') return; // la richiesta resta appesa: deve scattare il tempo massimo
    if (gemini === 'quota' || model === 'gemini-flash-latest') return r.fulfill({ status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } } });
    if (model === 'gemini-flash-lite-latest') return r.fulfill({ status: 503, json: { error: { status: 'UNAVAILABLE', message: 'high demand' } } });
    const original = body.contents[0].parts[0].text.split('Titolo originale: ')[1];
    calls[calls.length - 1].schema = body.generationConfig.responseSchema;
    const [leggero, medio, forte] = original.startsWith('Il campione') ? AI_TITLES : ['Alt A per ' + original, 'Alt B', 'Alt C'];
    return r.fulfill({ json: { candidates: [{ content: { parts: [{ thought: true, text: 'ragionamento interno' }, { text: JSON.stringify({ leggero, medio, forte }) }] } }] } });
  });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(base);
  return { page, errors, calls };
}

const aiChoices = page => page.locator('#titleChoices .title-choice:not(.title-fake):not(.title-skeleton)');

const browser = await chromium.launch();
{
  const { page, errors, calls } = await openStudio(browser);
  check('Pannello grafica chiuso all’avvio', await page.locator('#advancedEditor').isHidden());
  check('Pulsante “Personalizza grafica” ben visibile', await page.locator('#btnToggleEditor').isVisible()
    && (await page.locator('#editorToggleLabel').textContent()) === 'Apri');
  check('Nessun riferimento al vecchio marchio', !/zona\s*wrestling|zonawrestling/i.test(await page.content()));

  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  check('Tre articoli con pulsante coda rapida', await page.locator('.news-card .quick-queue').count() === 3);

  // Senza chiave: sezione sfocata con invito a sbloccarla, nessuna richiesta a Google.
  await page.waitForSelector('.title-lock-overlay');
  check('Senza chiave: titoli alternativi sfocati', await page.locator('.title-fake').count() === 3);
  check('Senza chiave: messaggio per sbloccare la sezione',
    (await page.locator('.title-lock-overlay strong').textContent()).includes('Aggiungi le API Google gratis in 30 secondi per sbloccare questa sezione'));
  check('Senza chiave: link per creare la chiave', (await page.locator('.title-lock-link').getAttribute('href')) === 'https://aistudio.google.com/apikey');
  check('Senza chiave: titolo del sito già selezionabile', (await aiChoices(page).count()) === 1);
  if (shots) await page.screenshot({ path: join(shots, 'titoli-bloccati.png'), clip: await page.locator('.col-editor').boundingBox() });
  check('Senza chiave: nessuna richiesta a Gemini', calls.length === 0);

  // Sblocco direttamente dalla sezione: i titoli arrivano da soli, passando ai modelli di riserva.
  await page.fill('.title-lock-steps input', 'test-key');
  await page.click('.title-lock-steps button');
  await page.waitForFunction(() => document.querySelectorAll('#titleChoices .title-choice:not(.title-skeleton)').length === 4, null, { timeout: 15000 });
  const texts = await aiChoices(page).allTextContents();
  check('Quattro scelte: titolo del sito + 3 AI', texts.length === 4 && texts[0].includes(FEED.items[0].title) && texts[1].includes(AI_TITLES[0]), JSON.stringify(texts));
  check('Limite d’uso e sovraccarico: passa al modello successivo',
    JSON.stringify(calls.map(c => c.model)) === JSON.stringify(['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash']), calls.map(c => c.model).join(' → '));
  check('Gemini: chiave nell’header e non nell’URL', calls.every(c => c.key === 'test-key' && !c.keyInUrl));
  check('Gemini: prompt vieta fatti inventati', /non aggiungere fatti/.test(calls[0].prompt));
  check('Gemini: prompt chiede curiosity gap in scala leggero → medio → forte con tecniche diverse',
    /curiosity gap/.test(calls[0].prompt) && /leggero:.*\n- medio:.*\n- forte:/s.test(calls[0].prompt) && /tecnica diversa/.test(calls[0].prompt));
  const schema = calls[calls.length - 1].schema;
  check('Gemini: risposta strutturata con un campo per livello', JSON.stringify(schema.required) === '["leggero","medio","forte"]'
    && JSON.stringify(schema.propertyOrdering) === '["leggero","medio","forte"]');
  const tags = await page.locator('#titleChoices .title-choice-tag').allTextContents();
  check('Etichette dei titoli per intensità', JSON.stringify(tags) === JSON.stringify(['Dal sito', '● Leggero', '●● Medio', '●●● Forte']), JSON.stringify(tags));
  check('Ragionamento interno del modello escluso dai titoli', !texts.join(' ').includes('ragionamento'));
  check('Chiave ricordata sul dispositivo', (await page.evaluate(() => localStorage.getItem('storyflow.studio.ai.v1'))).includes('test-key'));
  if (shots) await page.screenshot({ path: join(shots, 'titoli-ai.png'), clip: await page.locator('.col-editor').boundingBox() });

  await aiChoices(page).nth(2).click();
  check('Clic su un titolo AI lo mette nella storia', (await page.inputValue('#inpTitle')) === AI_TITLES[1]);
  check('Il titolo scelto risulta attivo', await aiChoices(page).nth(2).evaluate(e => e.classList.contains('active')));

  const before = calls.length;
  await page.locator('.news-card').nth(1).click();
  await page.waitForFunction(() => document.querySelector('#titleChoices')?.textContent.includes('Alt A per Nuovo evento'), null, { timeout: 15000 });
  check('Selezionando un’altra notizia i titoli arrivano da soli', calls.length > before);
  const afterSecond = calls.length;
  await page.locator('.news-card').nth(0).click();
  await page.waitForTimeout(800);
  check('Tornando a una notizia già vista non si spendono richieste', calls.length === afterSecond && (await aiChoices(page).count()) === 4);

  await page.locator('.news-card').nth(2).locator('.quick-queue').click();
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '1');
  await page.waitForTimeout(800);
  check('L’aggiunta rapida non chiede titoli a Gemini', !calls.slice(afterSecond).some(c => c.prompt.includes('Svelata la card')));
  check('Aggiunta rapida: pulsante segna “In coda”',
    (await page.locator('.news-card').nth(2).locator('.quick-queue').textContent()) === '✓ In coda');
  await page.locator('.news-card').nth(1).locator('.quick-queue').click();
  await page.locator('.news-card').nth(0).locator('.quick-queue').click();
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '3');
  const queued = await page.locator('#queueList .q-title').allTextContents();
  check('Aggiunte rapide in fila: titoli giusti e nell’ordine dei clic',
    queued[0] === FEED.items[2].title && queued[1] === FEED.items[1].title, JSON.stringify(queued));
  await page.locator('.news-card').nth(0).click();
  await page.click('#btnAddQueue');
  await page.waitForTimeout(500);
  check('“Aggiungi in coda” su storia già presente la aggiorna senza duplicarla', (await page.locator('#queueCount').textContent()) === '3');

  await page.click('#btnToggleEditor');
  check('Il pannello grafica si apre e il pulsante dice “Chiudi”', await page.locator('#advancedEditor').isVisible()
    && (await page.locator('#editorToggleLabel').textContent()) === 'Chiudi');
  check('Nessun errore JavaScript', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  // Gemini non risponde: niente caricamento infinito, compare l'errore con "Riprova".
  const { page, errors } = await openStudio(browser, { gemini: 'hang', presetKey: 'test-key' });
  await page.click('#btnFetch');
  await page.waitForSelector('.title-skeleton');
  check('Gemini lento: si vede che sta generando', true);
  await page.waitForSelector('.title-error', { timeout: 15000 }).catch(() => {});
  const err = await page.locator('.title-error').textContent().catch(() => '');
  check('Gemini senza risposta: il caricamento si ferma con un messaggio', /non ha risposto/.test(err || ''), err);
  check('Gemini senza risposta: pulsante “Riprova”', (await page.locator('.title-regen').textContent().catch(() => '')) === '↻ Riprova');
  check('Nessun errore JavaScript (Gemini lento)', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  const { page, calls } = await openStudio(browser, { gemini: 'quota', presetKey: 'test-key' });
  await page.click('#btnFetch');
  await page.waitForSelector('.title-error', { timeout: 15000 });
  const err = await page.locator('.title-error').textContent();
  check('Limite d’uso su tutti i modelli: messaggio chiaro', /limite d’uso gratuito/.test(err), err);
  check('Limite d’uso: provati anche i modelli abilitati per la chiave', calls.some(c => c.model === 'gemini-9-flash-lite'), calls.map(c => c.model).join(' → '));
  await page.close();
}
{
  const { page, errors } = await openStudio(browser, { desktop: true });
  await page.waitForTimeout(300);
  check('App desktop riconosciuta', (await page.locator('#extStatus').textContent()) === 'App desktop · Pronta');
  check('Versione motore mostrata', (await page.locator('#versionTag').textContent()).includes('MOTORE 4.0.0'));
  check('Pulsante “Scarica app” nascosto dentro l’app', await page.locator('#btnExtension').isHidden());
  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  await page.locator('.news-card').nth(0).locator('.quick-queue').click();
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '1');
  page.once('dialog', d => d.accept());
  await page.click('#btnTestQueue');
  check('Senza nome canale la pubblicazione non parte', await page.evaluate(() => window.__started === null));
  await page.fill('#cfgMetaTarget', 'La Mia Pagina');
  await page.click('#btnTestQueue');
  const started = await page.evaluate(() => window.__started);
  check('Avvio coda verso l’app desktop con nome canale compilato', started?.dryRun === true && started.items[0].metaTarget === 'La Mia Pagina'
    && started.items[0].dataUrl.startsWith('data:image/jpeg'));
  check('Nessun errore JavaScript (desktop)', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  const { page, errors } = await openStudio(browser, { viewport: { width: 390, height: 844 } });
  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  check('Mobile: pulsante coda rapida visibile', await page.locator('.news-card .quick-queue').first().isVisible());
  await page.click('.mobile-tab-btn[data-tab="editor"]');
  check('Mobile: sezione titoli bloccata visibile nell’editor', await page.locator('.title-lock-overlay').isVisible());
  if (shots) await page.screenshot({ path: join(shots, 'titoli-mobile.png') });
  check('Nessun errore JavaScript (mobile)', errors.length === 0, errors.join(' | '));
}
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
