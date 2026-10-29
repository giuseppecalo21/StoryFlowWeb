// Traduzioni del pannello: dizionari completi e coerenti, nessun testo italiano rimasto nelle altre lingue.
//   node tests/i18n.test.mjs [cartella-screenshot]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] || '';
const LANGS = ['it', 'en', 'es', 'pt', 'fr'];

let failures = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failures++; };

// --- Dizionari ---
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const l of LANGS) vm.runInContext(readFileSync(join(root, `i18n/${l}.js`), 'utf8'), sandbox);
const D = sandbox.window.SF_LANGS;
const base = Object.keys(D.it);
const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const tags = s => [...String(s).matchAll(/<\/?(\w+)/g)].map(m => m[0]).sort().join(',');
const plural = k => /_(zero|one|other)$/.test(k);
for (const l of LANGS.slice(1)) {
  const keys = Object.keys(D[l]);
  const missing = base.filter(k => !(k in D[l]) && !k.endsWith('_zero'));
  const extra = keys.filter(k => !(k in D.it));
  check(`[${l}] tutte le chiavi tradotte`, !missing.length, missing.join(', '));
  check(`[${l}] nessuna chiave in più`, !extra.length, extra.join(', '));
  const badPh = keys.filter(k => k in D.it && !plural(k) && placeholders(D[l][k]) !== placeholders(D.it[k]));
  check(`[${l}] stessi segnaposto {…}`, !badPh.length, badPh.join(', '));
  const badTags = keys.filter(k => k in D.it && tags(D[l][k]) !== tags(D.it[k]));
  check(`[${l}] stessi tag HTML`, !badTags.length, badTags.join(', '));
  const same = keys.filter(k => k in D.it && D[l][k] === D.it[k] && /[a-zà-ù]{4,}/i.test(D.it[k].replace(/<[^>]+>|https?:\S+|\{\w+\}/g, '')));
  console.log(`     [${l}] uguali all'italiano (da controllare a occhio): ${same.join(', ') || 'nessuna'}`);
}
// Chiavi usate nell'HTML e nel codice
const html = readFileSync(join(root, 'index.html'), 'utf8');
const used = new Set([
  ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map(m => m[1]),
  ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m => m[1].split(';').map(p => p.split(':')[1].trim()))
]);
const js = readFileSync(join(root, 'studio.js'), 'utf8');
[...js.matchAll(/\bt\('([\w.-]+[\w])'/g)].forEach(m => used.add(m[1]));
[...js.matchAll(/\btn\('([\w.-]+)'/g)].forEach(m => { used.add(m[1] + '_one'); used.add(m[1] + '_other'); });
const unknown = [...used].filter(k => !(k in D.it));
check('Ogni chiave usata esiste in italiano', !unknown.length, unknown.join(', '));

// --- Pannello nel browser ---
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const file = join(root, path === '/' ? 'index.html' : path.slice(1));
    if (!file.startsWith(root)) throw new Error('fuori');
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch (_) { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const FEED = { source: 'rss', items: [{ id: '1', title: 'Headline', url: 'https://example.com/a', image: '' }] };

// Testi visibili che coincidono con un testo italiano del dizionario: in un'altra lingua sono un residuo.
const italianLeftovers = (page, lang) => page.evaluate(values => {
  const out = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!text || !el || el.closest('[hidden],script,style,select[data-lang-select]')) continue;
    if (values.includes(text)) out.add(text);
  }
  return [...out];
}, Object.keys(D.it).map(k => D.it[k]).filter(v => /[a-zà-ù]{4,}/i.test(v) && !Object.values(D[lang]).includes(v)));

const browser = await chromium.launch();
for (const [locale, expected] of [['it-IT', 'it'], ['en-US', 'en'], ['es-MX', 'es'], ['pt-BR', 'pt'], ['fr-FR', 'fr'], ['de-DE', 'en']]) {
  const context = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('storyflow.onboarding.v1', 'done'));
  await page.route('**/proxy.php?action=feed*', r => r.fulfill({ json: FEED }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(url);
  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  const lang = await page.evaluate(() => window.SF_I18N.lang());
  check(`[${locale}] lingua scelta dal browser: ${expected}`, lang === expected, lang);
  check(`[${locale}] pulsante "Carica notizie" tradotto`, (await page.textContent('#btnFetch')) === D[expected]['top.fetch']);
  check(`[${locale}] conteggio articoli al singolare`, (await page.textContent('#newsCount')) === D[expected]['news.count_one'].replace('{n}', '1'));
  if (expected !== 'it') {
    const left = await italianLeftovers(page, expected);
    check(`[${locale}] nessun testo italiano visibile`, !left.length, left.join(' | '));
  }
  // La barra in alto non deve uscire dallo schermo con i testi più lunghi.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${locale}] barra in alto dentro la pagina`, overflow <= 0, `${overflow}px`);
  if (shots) await page.screenshot({ path: join(shots, `i18n-${expected}-${locale}.png`) });
  check(`[${locale}] nessun errore JavaScript`, !errors.length, errors.join(' | '));
  await context.close();
}

// Cambio di lingua dal selettore: testi dell'HTML e del codice, scelta ricordata.
{
  const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('storyflow.onboarding.v1', 'done'));
  await page.route('**/proxy.php?action=feed*', r => r.fulfill({ json: FEED }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(url);
  await page.click('#btnFetch');
  await page.waitForSelector('.news-card');
  await page.selectOption('#langSelect', 'es');
  check('Cambio lingua: HTML tradotto', (await page.textContent('#btnFetch')) === D.es['top.fetch']);
  check('Cambio lingua: elenco motivi tradotto', (await page.locator('#cfgPattern option').first().textContent()) === D.es['pat.halftone']);
  check('Cambio lingua: testi creati dal codice', (await page.textContent('#newsCount')) === '1 artículo'
    && (await page.textContent('.quick-queue')) === D.es['quick.add']);
  check('Cambio lingua: attributo lang della pagina', (await page.getAttribute('html', 'lang')) === 'es');
  // Esiti: i messaggi tecnici del motore restano in italiano, il pannello spiega nella sua lingua.
  await page.evaluate(() => window.__onStoryFlowNativeProgress({ stage: 'error', failedStage: 'link', index: 1, total: 1,
    message: 'Coda conclusa: 0 pubblicate, 1 non riuscite (Canale "Mi Página" non trovato. Verifica l\'accesso in Account il sistema.)', log: [] }));
  check('Esito in spagnolo: pagina non trovata', (await page.textContent('#publishOutcomeTitle')).includes(D.es['pm.pageNotFound'])
    && (await page.textContent('#publishOutcomeDesc')).includes('«Mi Página»'));
  await page.evaluate(() => window.__onStoryFlowNativeProgress({ stage: 'error', failedStage: 'sticker', index: 1, total: 1,
    message: 'Coda conclusa: 0 pubblicate, 1 non riuscite (Adesivo non creato)', log: [] }));
  check('Esito in spagnolo: errore tecnico spiegato', (await page.textContent('#publishOutcomeDesc')) === D.es['pm.failedAt'].replace('{stage}', D.es['step.sticker'])
    && (await page.textContent('#publishFailureMessage')).includes('Adesivo non creato'));
  await page.evaluate(() => window.__onStoryFlowNativeProgress({ stage: 'done', index: 1, total: 1, dryRun: true, msgLang: 'es', message: '¡Prueba completada con éxito!' }));
  check('Esito in spagnolo: messaggio del motore nella stessa lingua', (await page.textContent('#publishOutcomeDesc')) === '¡Prueba completada con éxito!');
  await page.click('#btnOutcomeDone');
  await page.reload();
  check('Cambio lingua: scelta ricordata', await page.evaluate(() => window.SF_I18N.lang()) === 'es');
  await page.goto(url + '?lang=fr');
  check('Lingua da indirizzo (?lang=fr)', (await page.textContent('#btnFetch')) === D.fr['top.fetch']);
  check('Cambio lingua: nessun errore JavaScript', !errors.length, errors.join(' | '));
  await context.close();
}

// Guida iniziale in inglese su telefono: nessun testo italiano.
{
  const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.goto(url);
  await page.waitForSelector('#onboardingModal:not([hidden])');
  for (let i = 0; i < 3; i++) {
    if (i === 0) { await page.fill('#obSite', 'https://example.com'); }
    await page.click('#btnObNext');
  }
  const left = await italianLeftovers(page, 'en');
  check('Guida in inglese: nessun testo italiano', !left.length, left.join(' | '));
  check('Guida in inglese: pulsante finale', (await page.textContent('#btnObNext')) === D.en['ob.finish']);
  check('Guida in inglese: illustrazione in inglese', (await page.getAttribute('#obGuideImage', 'src')) === 'onboarding/dove-pubblichiamo-en.svg');
  if (shots) await page.screenshot({ path: join(shots, 'i18n-onboarding-en-mobile.png') });
  await context.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} controlli non superati` : '\nTutti i controlli superati');
process.exit(failures ? 1 : 0);
