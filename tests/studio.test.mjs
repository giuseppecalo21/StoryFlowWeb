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

async function openStudio(browser, { desktop = false, viewport = { width: 1440, height: 900 } } = {}) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
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
    if (url.includes('gemini-flash-latest')) return r.fulfill({ status: 404, json: { error: { status: 'NOT_FOUND', message: 'not found' } } });
    const body = JSON.parse(r.request().postData());
    check('Gemini: chiave nell’header e non nell’URL', r.request().headers()['x-goog-api-key'] === 'test-key' && !url.includes('key='));
    check('Gemini: prompt vieta fatti inventati', /non aggiungere fatti/.test(body.contents[0].parts[0].text));
    return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ titles: AI_TITLES }) }] } }] } });
  });
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(base);
  return { page, errors };
}

const browser = await chromium.launch();
{
  const { page, errors } = await openStudio(browser);
  check('Pannello grafica chiuso all’avvio', await page.locator('#advancedEditor').isHidden());
  check('Pulsante “Personalizza grafica” ben visibile', await page.locator('#btnToggleEditor').isVisible()
    && (await page.locator('#editorToggleLabel').textContent()) === 'Apri');
  check('Nessun riferimento al vecchio marchio', !/zona\s*wrestling|zonawrestling/i.test(await page.content()));

  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  check('Tre articoli con pulsante coda rapida', await page.locator('.news-card .quick-queue').count() === 3);
  if (shots) await page.screenshot({ path: join(shots, 'studio-lista.png') });

  await page.locator('.news-card').nth(1).locator('.quick-queue').click();
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '1');
  check('Aggiunta rapida: storia in coda', true);
  check('Aggiunta rapida: pulsante segna “In coda”',
    (await page.locator('.news-card').nth(1).locator('.quick-queue').textContent()) === '✓ In coda'
    && await page.locator('.news-card').nth(1).locator('.quick-queue').isDisabled());
  await page.locator('.news-card').nth(2).locator('.quick-queue').click();
  await page.locator('.news-card').nth(0).locator('.quick-queue').click();
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '3');
  const titles = await page.locator('#queueList .q-title').allTextContents();
  check('Aggiunte rapide in fila: titoli giusti e nell’ordine dei clic',
    JSON.stringify(titles) === JSON.stringify([FEED.items[1].title, FEED.items[2].title, FEED.items[0].title]), JSON.stringify(titles));

  await page.locator('.news-card').nth(0).click();
  await page.click('#btnAddQueue');
  await page.waitForTimeout(500);
  check('“Aggiungi in coda” su storia già presente la aggiorna senza duplicarla',
    (await page.locator('#queueCount').textContent()) === '3');

  page.once('dialog', d => d.accept());
  await page.click('#btnAiTitles');
  check('Senza chiave Gemini si aprono le impostazioni', await page.locator('#boxSettings').isVisible());
  await page.fill('#cfgGeminiKey', 'test-key');
  await page.locator('#cfgGeminiKey').dispatchEvent('change');
  await page.click('#btnAiTitles');
  await page.waitForSelector('.title-choice');
  const choices = await page.locator('.title-choice').allTextContents();
  check('Quattro scelte: titolo del sito + 3 AI', choices.length === 4 && choices[0].includes(FEED.items[0].title), JSON.stringify(choices));
  check('Titolo originale selezionato', await page.locator('.title-choice').nth(0).evaluate(e => e.classList.contains('active')));
  await page.locator('.title-choice').nth(2).click();
  check('Clic su un titolo AI lo mette nella storia', (await page.inputValue('#inpTitle')) === AI_TITLES[1]);
  check('Il titolo scelto risulta attivo', await page.locator('.title-choice').nth(2).evaluate(e => e.classList.contains('active')));
  check('Chiave Gemini ricordata sul dispositivo', (await page.evaluate(() => localStorage.getItem('storyflow.studio.ai.v1'))).includes('test-key'));
  if (shots) await page.screenshot({ path: join(shots, 'studio-titoli-ai.png') });

  await page.click('#btnToggleEditor');
  check('Il pannello grafica si apre e il pulsante dice “Chiudi”', await page.locator('#advancedEditor').isVisible()
    && (await page.locator('#editorToggleLabel').textContent()) === 'Chiudi');
  check('Nessun errore JavaScript', errors.length === 0, errors.join(' | '));
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
  if (shots) await page.screenshot({ path: join(shots, 'studio-mobile.png') });
  check('Nessun errore JavaScript (mobile)', errors.length === 0, errors.join(' | '));
}
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
