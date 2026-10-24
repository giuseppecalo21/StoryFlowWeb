// Prova l'estensione Chrome completa: pannello → service worker → scheda Meta (finta) → motore → esito nel pannello.
//   node tests/extension.test.mjs
// La pagina business.facebook.com viene sostituita dal finto composer (tests/mock-composer.html).
// Scenario 1: motore integrato (content script). Scenario 2: "Consenti script utente" attivo e
// motore 4.0.1 firmato scaricato dal server simulato, con una chiave generata per il test.
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const file = join(root, path === '/' ? 'index.html' : path.slice(1));
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch (_) { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const studioUrl = `http://localhost:${server.address().port}/index.html`;

let failures = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failures++; };

async function scenario({ userScripts }) {
  const label = userScripts ? '[script utente + motore remoto]' : '[motore integrato]';
  // Copia temporanea dell'estensione: nello scenario 2 riceve la chiave pubblica di test.
  const extPath = mkdtempSync(join(tmpdir(), 'sf-ext-src-'));
  cpSync(join(root, 'storyflow-extension'), extPath, { recursive: true });
  let remote = null;
  if (userScripts) {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    writeFileSync(join(extPath, 'engine-config.js'),
      `const ENGINE_MANIFEST_URL = 'https://giuseppe.rocks/storyflow/engine/manifest.json';\nconst ENGINE_PUBLIC_KEY = '${spki}';\n`);
    const code = readFileSync(join(root, 'engine', 'composer.js'), 'utf8').replace("ENGINE_VERSION = '4.0.0'", "ENGINE_VERSION = '4.0.1'");
    const sha256 = createHash('sha256').update(code).digest('hex');
    const signature = sign('sha256', Buffer.from(`storyflow-engine\n4.0.1\n${sha256}\n1`), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
    remote = { code, manifest: { version: '4.0.1', file: 'composer.js', sha256, minClientApi: 1, signature } };
  }

  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'sf-ext-profile-')), {
    headless: false,
    args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`]
  });
  const mock = readFileSync(join(root, 'tests', 'mock-composer.html'));
  await context.route('https://business.facebook.com/**', r => r.fulfill({ body: mock, contentType: 'text/html' }));
  await context.route('https://giuseppe.rocks/**', r => {
    const url = r.request().url();
    if (remote && url.includes('/engine/manifest.json')) return r.fulfill({ json: remote.manifest });
    if (remote && url.includes('/engine/composer.js')) return r.fulfill({ body: remote.code, contentType: 'application/javascript' });
    return r.fulfill({ status: 404, body: '' });
  });
  await context.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));

  let worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await new Promise(r => setTimeout(r, 1500));
  if (userScripts) {
    const extId = new URL(worker.url()).host;
    const ext = await context.newPage();
    await ext.goto(`chrome://extensions/?id=${extId}`);
    await ext.locator('#allow-user-scripts').click();
    await ext.close();
    await worker.evaluate(() => registerEngine().then(checkEngineUpdate));
  }
  const engineInfo = await worker.evaluate(() => new Promise(res => chrome.storage.local.get(['sf_engine_active', 'sf_engine_error'], res)));
  check(`${label} motore registrato`, userScripts
    ? engineInfo.sf_engine_active?.mode === 'user script' && engineInfo.sf_engine_active?.version === '4.0.1'
    : engineInfo.sf_engine_active?.mode === 'content script', JSON.stringify(engineInfo));

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const png = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 600;
    c.getContext('2d').fillRect(0, 0, 800, 600);
    return [...new Uint8Array(await (await fetch(c.toDataURL('image/png'))).arrayBuffer())];
  }));
  await page.route('**/proxy.php?action=feed*', r => r.fulfill({ json: { source: 'wp', items: [{ id: '7', title: 'Notizia di prova', url: 'https://example.com/n', image: 'https://example.com/n.jpg' }] } }));
  await page.route('**/proxy.php?action=img*', r => r.fulfill({ body: png, contentType: 'image/png' }));
  await page.goto(studioUrl);
  await page.waitForFunction(() => document.getElementById('extStatus').textContent === 'Motore collegato', null, { timeout: 15000 });
  check(`${label} pannello vede l’estensione`, true);

  await page.click('#btnFetch');
  await page.waitForSelector('.quick-queue');
  await page.click('.quick-queue');
  await page.waitForFunction(() => document.getElementById('queueCount').textContent === '1');
  await page.click('#btnSettings');
  await page.fill('#cfgMetaTarget', 'My Page');
  await page.click('#btnTestQueue');

  await page.waitForFunction(() => !document.getElementById('publishOutcome').hidden, null, { timeout: 180000 }).catch(() => {});
  const outcome = await page.locator('#publishOutcome').textContent().catch(() => '');
  check(`${label} test completato e riportato nel pannello`, /Test riuscito/.test(outcome || ''), (outcome || '').trim().replace(/\s+/g, ' '));
  const state = await worker.evaluate(() => new Promise(res => chrome.storage.local.get(['sf_state'], r => res(r.sf_state))));
  check(`${label} registro: adesivo verificato con il motore giusto`, (state?.log || []).some(l => l.startsWith('TEST OK'))
    && (state?.log || []).some(l => l.startsWith(`Motore ${userScripts ? '4.0.1' : '4.0.0'}`)), (state?.log || []).slice(-3).join(' / '));
  check(`${label} nessun errore JavaScript nel pannello`, errors.length === 0, errors.join(' | '));

  await context.close();
}

await scenario({ userScripts: false });
await scenario({ userScripts: true });
server.close();
process.exit(failures ? 1 : 0);
