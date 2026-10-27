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
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

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

// Contrasto WCAG tra due colori #rrggbb.
const luminance = hex => {
  const n = parseInt(hex.slice(1), 16), lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  return .2126 * lin(n >> 16) + .7152 * lin(n >> 8 & 255) + .0722 * lin(n & 255);
};
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

// Le palette di “Mi sento fortunato” devono rispettare tutte le soglie di leggibilità.
{
  const source = readFileSync(join(root, 'studio.js'), 'utf8');
  const block = source.slice(source.indexOf('const LUCKY_PALETTES'), source.indexOf('const LUCKY_CONTRAST'));
  const palettes = [...block.matchAll(/\['([^']+)','(#[0-9A-Fa-f]{6})','(#[0-9A-Fa-f]{6})'\]/g)].map(m => m.slice(1));
  const weak = palettes.filter(([, dark, brand]) => contrast(dark, '#FFFFFF') < 4.5 || contrast(dark, brand) < 3);
  check('Palette a sorpresa: almeno cento abbinamenti', palettes.length >= 100, `${palettes.length}`);
  check('Palette a sorpresa: tutte leggibili', weak.length === 0, weak.map(p => p[0]).join(', '));
  check('Palette a sorpresa: nessun doppione', new Set(palettes.map(p => p[1] + p[2])).size === palettes.length);
}

/**
 * gemini: 'fallback' (primo modello al limite d'uso, secondo sovraccarico, terzo risponde),
 *         'hang' (nessuna risposta), 'quota' (tutti al limite d'uso).
 */
async function openStudio(browser, { desktop = false, viewport = { width: 1440, height: 900 }, gemini = 'fallback', presetKey = '', onboarding = false } = {}) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  const calls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([key, fast, showOnboarding]) => {
    // La guida iniziale si apre solo al primo avvio: le altre prove partono come utenti già configurati.
    if (!showOnboarding && !sessionStorage.getItem('sf-test-init')) localStorage.setItem('storyflow.onboarding.v1', 'done');
    sessionStorage.setItem('sf-test-init', '1');
    if (key) localStorage.setItem('storyflow.studio.ai.v1', JSON.stringify({ key, model: '' }));
    if (fast) { window.__SF_AI_TIMEOUT_MS = 700; window.__SF_AI_TOTAL_MS = 6000; }
  }, [presetKey, gemini === 'hang', onboarding]);
  if (desktop) {
    await page.addInitScript(() => {
      window.__started = null;
      window.StoryFlowNative = {
        getPlatform: () => 'desktop', startQueue: json => { window.__started = JSON.parse(json); },
        isQueueRunning: () => false, openMetaLogin: () => {}, getLastReport: () => '{"available":false}',
        getEngineInfo: () => '{"version":"4.0.0","source":"integrato"}',
        // Onboarding: nella pagina di Meta l'utente clicca su "La Mia Pagina"; Meta la scrive con la P maiuscola.
        pickMetaTarget: () => new Promise(r => setTimeout(() => r({ ok: true, reason: '', text: 'La Mia Pagina', suggestion: '' }), 300)),
        verifyMetaTarget: text => Promise.resolve(text === 'La Mia Pagina'
          ? { ok: true, reason: '', text, suggestion: '' }
          : { ok: false, reason: 'notfound', text, suggestion: text.toLowerCase() === 'la mia pagina' ? 'La Mia Pagina' : '' }),
        openMetaComposer: () => { window.__composerOpened = true; },
        cancelMetaSetup: () => {}
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
    if (gemini === 'quota' || model === 'gemini-3.5-flash') return r.fulfill({ status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } } });
    if (model === 'gemini-flash-lite-latest') return r.fulfill({ status: 503, json: { error: { status: 'UNAVAILABLE', message: 'high demand' } } });
    const original = body.contents[0].parts[0].text.split('Titolo originale: ').pop();
    calls[calls.length - 1].schema = body.generationConfig.responseSchema;
    calls[calls.length - 1].thinking = body.generationConfig.thinkingConfig;
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
    JSON.stringify(calls.map(c => c.model)) === JSON.stringify(['gemini-3.5-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite']), calls.map(c => c.model).join(' → '));
  check('Gemini: chiave nell’header e non nell’URL', calls.every(c => c.key === 'test-key' && !c.keyInUrl));
  check('Gemini: prompt vieta fatti inventati', /Vietato aggiungere fatti/.test(calls[0].prompt));
  check('Gemini: prompt chiede curiosity gap in scala leggero → medio → forte, strutture diverse, una sola domanda',
    /curiosity gap/.test(calls[0].prompt) && /leggero:.*\n- medio:.*\n- forte:/s.test(calls[0].prompt)
    && /struttura e un attacco diversi/.test(calls[0].prompt) && /Al massimo uno dei tre può essere una domanda/.test(calls[0].prompt));
  check('Gemini: la curiosità nasce togliendo, non aggiungendo', /non aggiungere niente, togli/.test(calls[0].prompt));
  check('Gemini: ragionamento ridotto per risposte rapide', calls[calls.length - 1].thinking?.thinkingLevel === 'low');
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

  const look = () => page.evaluate(() => Object.fromEntries(
    ['cfgColor', 'cfgDarkColor', 'cfgPattern', 'cfgTitleFont', 'cfgCtaFont', 'cfgCtaText', 'inpTitle'].map(id => [id, document.getElementById(id).value])));
  check('“Indietro” disattivato prima del primo lancio', await page.locator('#btnLuckyBack').isDisabled());
  const initial = await look();
  const seen = [];
  for (let i = 0; i < 25; i++) { await page.click('#btnLucky'); seen.push(await look()); }
  const pairs = new Set(seen.map(s => s.cfgDarkColor + s.cfgColor));
  check('Mi sento fortunato: ogni lancio cambia combinazione', pairs.size === 25, `${pairs.size} diverse su 25`);
  check('Mi sento fortunato: contrasto sempre buono',
    seen.every(s => contrast(s.cfgDarkColor, '#ffffff') >= 4.5 && contrast(s.cfgDarkColor, s.cfgColor) >= 3));
  check('Mi sento fortunato: cambia anche font e pattern',
    new Set(seen.map(s => s.cfgTitleFont)).size > 3 && new Set(seen.map(s => s.cfgPattern)).size > 3);
  check('Mi sento fortunato: titolo e testi restano quelli scelti',
    seen.every(s => s.inpTitle === initial.inpTitle && s.cfgCtaText === initial.cfgCtaText));
  await page.click('#btnLuckyBack');
  const back = await look();
  check('“Indietro” torna alla combinazione precedente', back.cfgColor === seen[23].cfgColor && back.cfgTitleFont === seen[23].cfgTitleFont);
  for (let i = 0; i < 24; i++) await page.click('#btnLuckyBack');
  const start = await look();
  check('“Indietro” arriva fino allo stile di partenza', start.cfgColor === initial.cfgColor && start.cfgPattern === initial.cfgPattern
    && await page.locator('#btnLuckyBack').isDisabled());
  if (shots) { await page.click('#btnLucky'); await page.screenshot({ path: join(shots, 'fortunato.png') }); }
  await page.uncheck('#cfgTitleUppercase');
  const titleBefore = await page.inputValue('#inpTitle');
  const canvasBefore = await page.locator('#storyCanvas').evaluate(c => c.toDataURL());
  await page.check('#cfgTitleUppercase');
  check('Maiuscolo: cambia la grafica ma non il testo del titolo',
    (await page.locator('#storyCanvas').evaluate(c => c.toDataURL())) !== canvasBefore && (await page.inputValue('#inpTitle')) === titleBefore);
  check('Maiuscolo: ricordato nello stile della storia', await page.evaluate(() =>
    Object.values(JSON.parse(localStorage.getItem('storyflow.studio.settings.v2.2')).sites).some(s => Object.values(s.stories || {}).some(st => st.style.titleUppercase === true))));
  await page.locator('.news-card').nth(1).click();
  check('Cambiando notizia lo storico di “Indietro” riparte', await page.locator('#btnLuckyBack').isDisabled());
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
  await page.click('#btnTestQueue');
  check('Senza nome canale la pubblicazione non parte', await page.evaluate(() => window.__started === null));
  check('Senza nome canale si apre la guida su “Dove pubblichiamo”', await page.locator('#onboardingModal').isVisible()
    && (await page.locator('#obCount').textContent()) === '4 di 4' && await page.locator('#obPickBox').isVisible());
  // Verifica con una maiuscola sbagliata: si propone il testo esatto che mostra Meta.
  await page.fill('#obMetaTarget', 'La mia pagina');
  await page.click('#btnObVerify');
  await page.waitForSelector('#obTargetResult.err button');
  check('Verifica: maiuscola sbagliata → proposta del nome esatto', (await page.locator('#obTargetResult button').textContent()) === 'Usa «La Mia Pagina»');
  await page.click('#obTargetResult button');
  check('Proposta accettata: nome corretto salvato', (await page.inputValue('#obMetaTarget')) === 'La Mia Pagina'
    && (await page.inputValue('#cfgMetaTarget')) === 'La Mia Pagina');
  await page.fill('#obMetaTarget', '');
  await page.click('#btnObPick');
  await page.waitForSelector('#obTargetResult.ok');
  check('“Trova il nome in Meta” compila il nome scelto nella pagina', (await page.inputValue('#obMetaTarget')) === 'La Mia Pagina'
    && (await page.locator('#obTargetResult').textContent()).includes('Pubblicheremo su «La Mia Pagina»'));
  await page.click('#btnObVerify');
  await page.waitForSelector('#obTargetResult.ok >> text=Trovato');
  check('Verifica riuscita', true);
  await page.click('#obManual summary');
  await page.click('#obManual a');
  check('Nell’app il link alla pagina delle storie si apre nella vista Meta', await page.evaluate(() => window.__composerOpened === true));
  if (shots) await page.screenshot({ path: join(shots, 'onboarding-desktop-pagina.png') });
  await page.click('#btnObNext');
  check('“Fatto” chiude la guida', await page.locator('#onboardingModal').isHidden());
  await page.click('#btnTestQueue');
  const started = await page.evaluate(() => window.__started);
  check('Avvio coda verso l’app desktop con nome canale compilato', started?.dryRun === true && started.items[0].metaTarget === 'La Mia Pagina'
    && started.items[0].dataUrl.startsWith('data:image/jpeg'));
  // Il motore non trova il nome della pagina in Meta: messaggio chiaro e pulsante per correggerlo.
  await page.evaluate(() => window.__onStoryFlowNativeProgress({ stage: 'error', index: 1, total: 1,
    message: 'Coda conclusa: 0 pubblicate, 1 non riuscite (Canale "La Mia Pagina" non trovato. Verifica l\'accesso in Account Meta.)', log: [] }));
  check('Canale non trovato: spiegazione chiara', (await page.locator('#publishOutcomeDesc').textContent()).includes('Non troviamo «La Mia Pagina» nella pagina delle storie'));
  check('Canale non trovato: pulsante per sistemare il nome', await page.locator('#btnFixChannel').isVisible());
  if (shots) await page.screenshot({ path: join(shots, 'errore-canale.png') });
  await page.click('#btnFixChannel');
  check('Il pulsante riapre la guida su “Dove pubblichiamo”', await page.locator('#onboardingModal').isVisible() && (await page.locator('#obCount').textContent()) === '4 di 4');
  await page.click('#btnObClose');
  check('Nessun errore JavaScript (desktop)', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  // Schermata di pubblicazione su telefono: storia in lavorazione, niente chiusura, stop dopo la storia attuale.
  const { page, errors } = await openStudio(browser, { desktop: true, viewport: { width: 390, height: 844 } });
  await page.evaluate(() => {
    window.__running = false; window.__stop = [];
    Object.assign(window.StoryFlowNative, {
      getPlatform: () => 'android', isQueueRunning: () => window.__running,
      startQueue: json => { window.__started = JSON.parse(json); window.__running = true; },
      setStopAfterCurrent: on => { window.__stop.push(on); }
    });
  });
  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  for (let i = 0; i < 3; i++) await page.locator('.news-card').nth(i).locator('.quick-queue').click();
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '3');
  // Il nome della pagina segue il sito caricato: lo si imposta dopo aver preparato le storie.
  await page.evaluate(() => { const f = document.getElementById('cfgMetaTarget'); f.value = 'La Mia Pagina'; f.dispatchEvent(new Event('input')); });
  await page.evaluate(() => document.getElementById('btnPublishQueue').click());
  const started = await page.evaluate(() => window.__started);
  check('Pubblicazione: coda inviata all’app', started?.dryRun === false && started.items.length === 3);
  check('Pubblicazione: schermata a tutto schermo al posto della finestra', await page.locator('#publishStage').isVisible()
    && await page.locator('#publishModal').isHidden());
  check('Pubblicazione: nessun pulsante per chiudere la schermata', await page.locator('#btnStageClose').isHidden()
    && await page.locator('#publishStage button:visible').count() === 1);
  const ids = started.items.map(it => String(it.id));
  await page.evaluate(id => window.__onStoryFlowNativeProgress({ stage: 'image', index: 1, total: 3, itemId: id, message: 'Caricamento immagine', log: [] }), ids[1]);
  check('Pubblicazione: anteprima della storia in lavorazione', await page.evaluate(src => document.getElementById('psImage').src === src, started.items[1].dataUrl));
  check('Pubblicazione: posizione presa dalla storia, non dal contatore del motore', (await page.locator('#psCount').textContent()) === 'Storia 2 di 3');
  check('Pubblicazione: titolo della storia', (await page.locator('#psTitle').textContent()) === started.items[1].title);
  check('Pubblicazione: miniature con la prima già fatta', await page.evaluate(() =>
    [...document.querySelectorAll('#psStrip span')].map(s => s.className).join(',') === 'done,current,'));
  check('Pubblicazione: la schermata scansiona la storia', await page.evaluate(() => getComputedStyle(document.querySelector('.ps-scan')).animationName === 'ps-scan'));
  check('Pubblicazione: avanzamento senza dettagli tecnici', (await page.locator('#psStatus').textContent()) === 'Caricamento della grafica…');
  if (shots) { await page.waitForTimeout(700); await page.screenshot({ path: join(shots, 'pubblicazione-in-corso.png') }); }
  await page.click('#btnStopAfter');
  check('Stop: richiesta passata all’app', await page.evaluate(() => window.__stop.join() === 'true'));
  check('Stop: spiegazione e pulsante per annullare', (await page.locator('#psNote').textContent()).includes('l’ultima resta in coda')
    && (await page.locator('#btnStopAfter').textContent()) === 'Continua con tutta la coda');
  if (shots) await page.screenshot({ path: join(shots, 'pubblicazione-stop.png') });
  await page.click('#btnStopAfter');
  await page.click('#btnStopAfter');
  check('Stop: si può annullare e richiedere di nuovo', await page.evaluate(() => window.__stop.join() === 'true,false,true'));
  await page.evaluate(id => { window.__running = false; window.__onStoryFlowNativeProgress({ stage: 'stopped', index: 2, total: 3, ok: 2, err: 0, remainingIds: [id], message: 'Coda fermata su richiesta' }); }, ids[2]);
  check('Stop: schermata chiusa, esito mostrato', await page.locator('#publishStage').isHidden() && await page.locator('#publishModal').isVisible());
  check('Stop: in coda resta solo la storia non pubblicata', (await page.locator('#queueCount').textContent()) === '1'
    && (await page.locator('#queueList .q-title').textContent()) === started.items[2].title);
  check('Stop: riepilogo chiaro', (await page.locator('#publishOutcomeDesc').textContent()) === 'Pubblicate 2 storie. L’altra storia resta in coda, pronta a ripartire.');
  check('Stop: si può ripartire', await page.locator('#btnPublishQueue').isEnabled());
  check('Stop: avanzamento fermo alle storie lavorate', await page.evaluate(() => document.getElementById('progressFill').style.width === '67%'));
  if (shots) await page.screenshot({ path: join(shots, 'pubblicazione-in-pausa.png') });
  await page.click('#btnOutcomeDone');
  // L'app chiude la coda senza avvisare il pannello: la schermata non resta bloccata.
  await page.evaluate(() => document.getElementById('btnPublishQueue').click());
  check('Ripartenza: schermata di nuovo aperta', await page.locator('#publishStage').isVisible());
  check('Ripartenza: ultima storia, niente pulsante di stop', await page.locator('#btnStopAfter').isHidden());
  await page.evaluate(() => { window.__running = false; });
  await page.waitForSelector('#publishStage', { state: 'hidden', timeout: 10000 });
  check('App ferma senza avviso: schermata chiusa da sola', await page.locator('#publishModal').isVisible());
  check('Nessun errore JavaScript (schermata di pubblicazione)', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  // Primo avvio nel browser: la guida parte da sola e accompagna nei quattro passaggi.
  const { page, errors } = await openStudio(browser, { onboarding: true });
  check('Primo avvio: si apre la guida', await page.locator('#onboardingModal').isVisible() && (await page.locator('#obCount').textContent()) === '1 di 4');
  if (shots) await page.screenshot({ path: join(shots, 'onboarding-1-sito.png') });
  await page.fill('#obSite', 'sito senza https');
  await page.click('#btnObNext');
  check('Passo 1: indirizzo non valido segnalato', (await page.locator('#obCount').textContent()) === '1 di 4'
    && (await page.locator('#obSiteFeedback').textContent()).includes('indirizzo completo'));
  await page.fill('#obSite', 'https://example.com');
  await page.click('#btnObFetch');
  await page.waitForSelector('#obSiteFeedback.ok');
  check('Passo 1: “Prova” trova gli articoli', (await page.locator('#obSiteFeedback').textContent()).includes('Trovati 3 articoli')
    && (await page.inputValue('#siteUrl')) === 'https://example.com');
  await page.click('#btnObNext');
  check('Passo 2: colori con anteprima', await page.locator('#obPreview').isVisible());
  await page.locator('#obColor').evaluate(el => { el.value = '#e63946'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  check('Passo 2: il colore scelto diventa lo stile predefinito del sito', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('storyflow.studio.settings.v2.2')).sites['https://example.com'].defaults.brandColor === '#e63946'));
  const savedDefaults = () => page.evaluate(() => JSON.parse(localStorage.getItem('storyflow.studio.settings.v2.2')).sites['https://example.com'].defaults);
  const preview = () => page.locator('#obPreview').evaluate(c => c.toDataURL());
  check('Passo 2: “Indietro” disattivato prima del primo lancio', await page.locator('#btnObLuckyBack').isDisabled());
  const previewBefore = await preview();
  await page.click('#btnObLucky');
  const lucky = await savedDefaults();
  check('Passo 2: “Mi sento fortunato” cambia colori e anteprima',
    (await page.inputValue('#obColor')) === lucky.brandColor.toLowerCase() && lucky.brandColor.toLowerCase() !== '#e63946'
    && (await page.inputValue('#obPattern')) === lucky.pattern && (await preview()) !== previewBefore);
  check('Passo 2: la combinazione a sorpresa diventa lo stile predefinito, leggibile',
    contrast(lucky.darkColor, '#ffffff') >= 4.5 && contrast(lucky.darkColor, lucky.brandColor) >= 3);
  await page.click('#btnObLuckyBack');
  check('Passo 2: “Indietro” torna ai colori scelti a mano',
    (await savedDefaults()).brandColor === '#e63946' && (await page.inputValue('#obColor')) === '#e63946');
  await page.click('#btnObLucky');
  if (shots) await page.screenshot({ path: join(shots, 'onboarding-2-colori.png') });
  await page.click('#btnObNext');
  check('Passo 3: rassicurazione su nome utente e password', (await page.locator('.ob-safe').textContent()).includes('non vede e non salva né il nome utente né la password'));
  await page.click('.ob-step[data-step="2"] summary');
  if (shots) await page.screenshot({ path: join(shots, 'onboarding-3-meta.png') });
  await page.click('#btnObNext');
  check('Passo 4 senza app: niente selettore automatico, guida manuale aperta', await page.locator('#obPickBox').isHidden()
    && await page.locator('#btnObVerify').isHidden() && await page.locator('#obManual').evaluate(d => d.open));
  check('Passo 4: illustrazione della pagina di Meta', await page.locator('#obGuideImage').evaluate(img => img.complete && img.naturalWidth > 0));
  if (shots) await page.screenshot({ path: join(shots, 'onboarding-4-pagina.png'), fullPage: true });
  await page.click('#btnObNext');
  check('Senza nome: avviso prima di chiudere', await page.locator('#onboardingModal').isVisible()
    && (await page.locator('#obTargetResult').textContent()).includes('Senza il nome della pagina'));
  await page.locator('#obMetaTarget').pressSequentially('Pagina di Prova');
  check('Il nome si scrive normalmente, spazi compresi', (await page.inputValue('#obMetaTarget')) === 'Pagina di Prova');
  check('Il nome scritto a mano finisce nelle impostazioni del sito', (await page.inputValue('#cfgMetaTarget')) === 'Pagina di Prova');
  await page.click('#btnObNext');
  check('Guida chiusa', await page.locator('#onboardingModal').isHidden());
  await page.reload();
  await page.waitForTimeout(300);
  check('Dopo il primo avvio la guida non si riapre da sola', await page.locator('#onboardingModal').isHidden());
  await page.click('#btnGuide');
  check('“Guida” la riapre dall’inizio', await page.locator('#onboardingModal').isVisible() && (await page.locator('#obCount').textContent()) === '1 di 4');
  await page.click('#btnObClose');
  check('Nessun errore JavaScript (onboarding)', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  const { page, errors } = await openStudio(browser, { viewport: { width: 390, height: 844 }, onboarding: true });
  check('Mobile: guida a schermo intero', await page.locator('#onboardingModal').isVisible());
  if (shots) await page.screenshot({ path: join(shots, 'onboarding-mobile.png') });
  await page.click('#btnObClose');
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
