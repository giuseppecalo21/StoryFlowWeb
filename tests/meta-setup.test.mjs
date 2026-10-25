// Prova engine/meta-setup.js (scelta e verifica del nome della pagina) su una finta pagina delle storie.
//   node tests/meta-setup.test.mjs [cartella-screenshot]
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] || '';
const SETUP = readFileSync(join(root, 'engine', 'meta-setup.js'), 'utf8');

let failures = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failures++; };

const PAGE = `<!doctype html><html lang="it"><body style="font-family:sans-serif;margin:0;padding:120px 40px">
  <section id="dest" style="border:1px solid #ccc;padding:12px;width:420px">
    <div>Pubblica su</div>
    <div id="acc" role="button" style="padding:8px;cursor:pointer"><span id="page">Zona Prova</span> e <span id="ig">zona_prova</span></div>
  </section>
  <div id="two" style="margin-top:20px;width:300px">Riga uno<br>Riga due</div>
  <div style="margin-top:20px"><div id="solo">Pagina Singola</div><div>Altra riga</div></div>
  <button id="share" style="margin-top:20px">Condividi</button>
  <script>window.metaClicks=0;document.addEventListener('click',()=>{window.metaClicks++;});</script>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.setContent(PAGE);
await page.evaluate(SETUP);

// Clic sul nome della Pagina dentro "Pagina e profilo": si propone tutta la scritta, poi il solo nome.
let picked = page.evaluate(() => window.__sfMetaSetup.pick());
await page.waitForSelector('[data-storyflow=picker] >> text=Clicca sul nome');
await page.hover('#page');
if (shots) await page.screenshot({ path: join(shots, 'meta-selettore.png') });
await page.click('#page');
await page.waitForSelector('[data-storyflow=picker] >> text=Quale testo usiamo');
const choices = await page.locator('[data-storyflow=picker] button.choice').allTextContents();
check('Scelta: proposte tutta la scritta e il solo nome, in quest’ordine', JSON.stringify(choices) === JSON.stringify(['Zona Prova e zona_prova', 'Zona Prova']), JSON.stringify(choices));
check('Scelta: spiegato perché conviene tutta la scritta', (await page.locator('[data-storyflow=picker] .body').textContent()).includes('Facebook e Instagram insieme'));
if (shots) await page.screenshot({ path: join(shots, 'meta-selettore-scelta.png') });
await page.click('[data-storyflow=picker] button.choice >> nth=0');
await page.waitForSelector('[data-storyflow=picker] >> text=Usa questo nome');
if (shots) await page.screenshot({ path: join(shots, 'meta-selettore-conferma.png') });
await page.click('[data-storyflow=picker] >> text=Usa questo nome');
let res = await picked;
check('Scelta: tutta la scritta, congiunzione compresa', res.ok === true && res.text === 'Zona Prova e zona_prova', JSON.stringify(res));
check('Scelta: i clic non arrivano a Meta', await page.evaluate(() => window.metaClicks) === 0);
check('Scelta: il selettore sparisce alla fine', await page.locator('[data-storyflow=picker]').count() === 0);

picked = page.evaluate(() => window.__sfMetaSetup.pick());
await page.waitForSelector('[data-storyflow=picker] >> text=Clicca sul nome');
await page.click('#ig');
await page.click('[data-storyflow=picker] button.choice >> nth=1');
await page.click('[data-storyflow=picker] >> text=Usa questo nome');
res = await picked;
check('Scelta: si può prendere anche solo il profilo', res.ok && res.text === 'zona_prova', JSON.stringify(res));

// Testo già da solo sulla riga: si passa subito alla conferma.
picked = page.evaluate(() => window.__sfMetaSetup.pick());
await page.waitForSelector('[data-storyflow=picker] >> text=Clicca sul nome');
await page.click('#solo');
await page.waitForSelector('[data-storyflow=picker] >> text=Usa questo nome');
await page.click('[data-storyflow=picker] >> text=Usa questo nome');
res = await picked;
check('Nome da solo sulla riga: conferma diretta', res.ok && res.text === 'Pagina Singola', JSON.stringify(res));

// Elemento con più righe: si sceglie quella giusta.
picked = page.evaluate(() => window.__sfMetaSetup.pick());
await page.waitForSelector('[data-storyflow=picker] >> text=Clicca sul nome');
await page.click('#two');
await page.waitForSelector('[data-storyflow=picker] >> text=Quale testo usiamo');
await page.click('[data-storyflow=picker] button:has-text("Riga due")');
await page.click('[data-storyflow=picker] >> text=Usa questo nome');
res = await picked;
check('Scelta tra più righe', res.ok && res.text === 'Riga due', JSON.stringify(res));

// Annulla.
picked = page.evaluate(() => window.__sfMetaSetup.pick());
await page.waitForSelector('[data-storyflow=picker] >> text=Annulla');
await page.click('[data-storyflow=picker] >> text=Annulla');
res = await picked;
check('Annulla: nessun nome, motivo “cancel”', !res.ok && res.reason === 'cancel', JSON.stringify(res));
await page.click('#share');
check('Dopo la scelta Meta torna a ricevere i clic', await page.evaluate(() => window.metaClicks) === 1);

// Android: la pagina desktop è rimpicciolita, il riquadro si ingrandisce ma resta dentro lo schermo.
picked = page.evaluate(() => window.__sfMetaSetup.pick({ zoom: 3 }));
await page.waitForSelector('[data-storyflow=picker] >> text=Annulla');
const bar = await page.locator('[data-storyflow=picker] .bar').boundingBox();
if (shots) await page.screenshot({ path: join(shots, 'meta-selettore-zoom.png') });
check('Zoom: riquadro ingrandito ma dentro la pagina', bar && bar.x >= 0 && bar.x + bar.width <= 1100 && bar.height > 200, JSON.stringify(bar));
await page.click('[data-storyflow=picker] >> text=Annulla');
await picked;

// Verifica: stesso controllo del motore.
res = await page.evaluate(() => window.__sfMetaSetup.verify('Zona Prova e zona_prova'));
check('Verifica: testo presente', res.ok === true, JSON.stringify(res));
res = await page.evaluate(() => window.__sfMetaSetup.verify('zona prova', 1200));
check('Verifica: maiuscole diverse → suggerisce il testo esatto', !res.ok && res.reason === 'notfound' && res.suggestion === 'Zona Prova', JSON.stringify(res));
res = await page.evaluate(() => window.__sfMetaSetup.verify('Altra Pagina', 1200));
check('Verifica: testo assente', !res.ok && res.reason === 'notfound' && res.suggestion === '', JSON.stringify(res));
// Il motore deve accettare quello che la verifica accetta.
check('Verifica allineata al motore (innerText.includes)', /document\.body\.innerText\.includes\(it\.metaTarget\)/.test(readFileSync(join(root, 'engine', 'composer.js'), 'utf8')));

check('Nessun errore JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failures ? 1 : 0);
