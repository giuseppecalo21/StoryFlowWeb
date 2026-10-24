// StoryFlow 3.0: motore unico aggiornabile dal server (engine/composer.js firmato).
// - Con "Consenti script utente" attivo, il motore scaricato gira come user script.
// - Altrimenti si usa il motore integrato nell'estensione (engine/composer.js).
importScripts('engine-config.js');

const COMPOSER_URL = 'https://business.facebook.com/latest/story_composer/';
const COMPOSER_MATCH = 'https://business.facebook.com/latest/story_composer/*';
const ENGINE_SCRIPT_ID = 'sf-engine';
const CLIENT_API = 1;
const publishError = error => ({ok:false,error:String(error?.message||error||'Errore Chrome non specificato')});
const storageGet = keys => new Promise(res => chrome.storage.local.get(keys, res));
const storageSet = data => new Promise((res, rej) => chrome.storage.local.set(data, () => {
  const e = chrome.runtime.lastError; e ? rej(new Error(e.message)) : res();
}));

// --- MOTORE ---

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const versionOf = code => /ENGINE_VERSION\s*=\s*'([^']+)'/.exec(code)?.[1] || '0.0.0';

async function verifyManifest(m) {
  if (!ENGINE_PUBLIC_KEY) return 'chiave pubblica non configurata';
  if (!m?.signature || !/^[0-9a-f]{64}$/.test(String(m.sha256))) return 'manifest non firmato';
  if ((Number(m.minClientApi) || 1) > CLIENT_API) return 'motore troppo recente per questa estensione';
  try {
    const key = await crypto.subtle.importKey('spki', b64ToBytes(ENGINE_PUBLIC_KEY), {name:'ECDSA', namedCurve:'P-256'}, false, ['verify']);
    const message = new TextEncoder().encode(`storyflow-engine\n${m.version}\n${m.sha256}\n${Number(m.minClientApi) || 1}`);
    const ok = await crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, key, b64ToBytes(m.signature), message);
    return ok ? '' : 'firma non valida';
  } catch (e) { return 'verifica firma: ' + e.message; }
}

function userScriptsAvailable() {
  // Da Chrome 138 serve l'interruttore "Consenti script utente" nei dettagli dell'estensione.
  try { chrome.userScripts.getScripts(); return true; } catch (_) { return false; }
}

async function bundledEngine() {
  const code = await (await fetch(chrome.runtime.getURL('engine/composer.js'))).text();
  return { code, version: versionOf(code), source: 'integrato' };
}

async function cachedEngine() {
  const { sf_engine } = await storageGet(['sf_engine']);
  if (!sf_engine?.code || !sf_engine?.manifest) return null;
  if (await verifyManifest(sf_engine.manifest)) return null;
  const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sf_engine.code)));
  if (digest !== sf_engine.manifest.sha256) return null;
  return { code: sf_engine.code, version: sf_engine.manifest.version, source: 'remoto' };
}

async function bestEngine() {
  const bundled = await bundledEngine();
  const cached = await cachedEngine();
  return cached && compareVersions(cached.version, bundled.version) > 0 ? cached : bundled;
}

let registering = Promise.resolve();
function registerEngine() {
  registering = registering.then(doRegisterEngine).catch(e => console.warn('StoryFlow motore:', e));
  return registering;
}
async function doRegisterEngine() {
  const contentScripts = await chrome.scripting.getRegisteredContentScripts({ ids: [ENGINE_SCRIPT_ID] });
  if (userScriptsAvailable()) {
    const engine = await bestEngine();
    await chrome.userScripts.configureWorld({ messaging: true });
    const script = { id: ENGINE_SCRIPT_ID, matches: [COMPOSER_MATCH], js: [{ code: engine.code }], runAt: 'document_idle', world: 'USER_SCRIPT' };
    const existing = await chrome.userScripts.getScripts({ ids: [ENGINE_SCRIPT_ID] });
    if (existing.length) await chrome.userScripts.update([script]);
    else await chrome.userScripts.register([script]);
    if (contentScripts.length) await chrome.scripting.unregisterContentScripts({ ids: [ENGINE_SCRIPT_ID] });
    await storageSet({ sf_engine_active: { version: engine.version, source: engine.source, mode: 'user script' } });
    return;
  }
  // Senza script utente: solo il motore integrato, come content script.
  if (!contentScripts.length) {
    await chrome.scripting.registerContentScripts([{ id: ENGINE_SCRIPT_ID, matches: [COMPOSER_MATCH], js: ['engine/composer.js'], runAt: 'document_idle' }]);
  }
  const bundled = await bundledEngine();
  await storageSet({ sf_engine_active: { version: bundled.version, source: 'integrato', mode: 'content script' } });
}

async function checkEngineUpdate() {
  try {
    const res = await fetch(ENGINE_MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest HTTP ' + res.status);
    const manifest = await res.json();
    const problem = await verifyManifest(manifest);
    if (problem) throw new Error(problem);
    const current = await bestEngine();
    if (compareVersions(manifest.version, current.version) <= 0) return { updated: false, version: current.version };
    const fileUrl = new URL(manifest.file || 'composer.js', ENGINE_MANIFEST_URL).toString();
    const code = await (await fetch(fileUrl + '?v=' + encodeURIComponent(manifest.version), { cache: 'no-store' })).text();
    const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)));
    if (digest !== manifest.sha256) throw new Error('sha256 del motore non corrisponde al manifest');
    await storageSet({ sf_engine: { code, manifest } });
    await registerEngine();
    return { updated: true, version: manifest.version };
  } catch (e) {
    await storageSet({ sf_engine_error: String(e.message || e) }).catch(() => {});
    return { updated: false, error: String(e.message || e) };
  }
}

const withTimeout = (promise, ms) => Promise.race([promise, new Promise(res => setTimeout(() => res(null), ms))]);

// --- CLIC "VERI" (chrome.debugger) ---

async function withDebugger(tabId, fn) {
  const target = {tabId};
  try { await chrome.debugger.attach(target, '1.3'); } catch (_) {}
  const send = (method, params) => chrome.debugger.sendCommand(target, method, params);
  try { await fn(send); }
  finally { try { await chrome.debugger.detach(target); } catch (_) {} }
}
const mouse = (send, type, x, y, buttons, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, ...extra });

async function trustedClick(tabId, x, y) {
  await withDebugger(tabId, async send => {
    await mouse(send, 'mouseMoved', x, y, 0);
    await mouse(send, 'mousePressed', x, y, 1, { clickCount: 1 });
    await new Promise(r => setTimeout(r, 60));
    await mouse(send, 'mouseReleased', x, y, 0, { clickCount: 1 });
  });
}

async function trustedDrag(tabId, sx, sy, ex, ey) {
  await withDebugger(tabId, async send => {
    await mouse(send, 'mouseMoved', sx, sy, 0);
    await mouse(send, 'mousePressed', sx, sy, 1, { clickCount: 1 });
    for (let i = 1; i <= 25; i++) {
      await mouse(send, 'mouseMoved', Math.round(sx + (ex - sx) * i / 25), Math.round(sy + (ey - sy) * i / 25), 1);
      await new Promise(r => setTimeout(r, 12));
    }
    await mouse(send, 'mouseReleased', ex, ey, 0, { clickCount: 1 });
  });
}

// --- MESSAGGI ---

const fromComposer = sender => (sender.url || sender.tab?.url || '').startsWith(COMPOSER_URL);

// Comandi del motore: arrivano dal content script integrato o dallo user script scaricato.
function handleEngineMessage(msg, sender, sendResponse) {
  if (!msg || typeof msg !== 'object' || !fromComposer(sender)) return false;
  const tabId = sender.tab?.id;

  if (msg.cmd === 'GET_STATE') {
    storageGet(['sf_state']).then(({sf_state}) => sendResponse({ state: sf_state || null }));
    return true;
  }
  if (msg.cmd === 'SAVE_STATE') {
    storageSet({ sf_state: msg.state }).then(() => sendResponse({ok:true}), e => sendResponse(publishError(e)));
    return true;
  }
  if (msg.cmd === 'SF_PROGRESS') {
    storageGet(['sf_dashboardTab','sf_state']).then(({sf_dashboardTab,sf_state}) => {
      if (!Number.isInteger(sf_dashboardTab)) return;
      const progress = {
        stage:String(msg.stage||'start').slice(0,24),
        index:Number(msg.index)||1, total:Number(msg.total)||1,
        dryRun:!!msg.dryRun, message:String(msg.message||'').slice(0,400),
        failedStage:String(msg.failedStage||'').slice(0,24),
        log:Array.isArray(msg.log)?msg.log.slice(-12).map(l=>String(l).slice(0,800)):[],
        reqId:sf_state?.reqId||''
      };
      chrome.tabs.sendMessage(sf_dashboardTab,{cmd:'SF_PROGRESS',progress},()=>{ void chrome.runtime.lastError; });
    });
    return false;
  }
  if ((msg.cmd === 'TRUSTED_CLICK' || msg.cmd === 'TRUSTED_DRAG') && Number.isInteger(tabId)) {
    const n = v => Math.round(Number(v) || 0);
    const job = msg.cmd === 'TRUSTED_CLICK'
      ? trustedClick(tabId, n(msg.x), n(msg.y))
      : trustedDrag(tabId, n(msg.sx), n(msg.sy), n(msg.ex), n(msg.ey));
    job.then(() => sendResponse({ok:true}), e => sendResponse(publishError(e)));
    return true;
  }
  if (msg.cmd === 'NEXT_STORY_NAV' && Number.isInteger(tabId)) {
    const hash = msg.dryRun ? '#sftest' : '#sfauto-next';
    chrome.tabs.update(tabId, { url: `${COMPOSER_URL}?sf_ts=${Date.now()}${hash}` }, () => {
      const err = chrome.runtime.lastError;
      sendResponse(err ? publishError(err.message) : {ok:true});
    });
    return true;
  }
  if (msg.cmd === 'FINISH_QUEUE') {
    storageGet(['sf_dashboardTab']).then(({sf_dashboardTab}) => {
      if (Number.isInteger(sf_dashboardTab)) chrome.tabs.update(sf_dashboardTab, { active: true }, () => { void chrome.runtime.lastError; });
    });
    return false;
  }
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.cmd === 'START_QUEUE') {
    const reqId = typeof msg.reqId === 'string' ? msg.reqId.slice(0,100) : '';
    if (!sender.tab?.id) { sendResponse(publishError('Scheda dashboard non riconosciuta')); return; }
    if (!Array.isArray(msg.items) || !msg.items.length) {
      sendResponse(publishError('La coda è vuota')); return;
    }
    const state = {
      items: msg.items, dryRun: !!msg.dryRun, done: 0, ok: 0, err: 0,
      log: [], t: Date.now(), total: msg.items.length, reqId
    };
    (async () => {
      // Prima di aprire Meta controlla se sul server c'è un motore più recente (massimo 5 secondi).
      await withTimeout(checkEngineUpdate(), 5000);
      await registering;
      try { await storageSet({ sf_state:state, sf_dashboardTab:sender.tab.id }); }
      catch (e) { sendResponse(publishError('Salvataggio coda: '+e.message)); return; }
      chrome.tabs.create({url:COMPOSER_URL+(state.dryRun?'#sftest':'#sfauto')}, tab => {
        const tabError = chrome.runtime.lastError;
        if (tabError || !tab?.id) {
          sendResponse(publishError('Apertura Meta: '+(tabError?.message||'nessuna scheda creata')));
          return;
        }
        sendResponse({ok:true,reqId,metaTabId:tab.id});
      });
    })();
    return true;
  }

  if (msg.cmd === 'GET_LAST_REPORT') {
    // Il registro è accessibile solo alla scheda dashboard che ha avviato
    // l'ultima coda, evitando di inviare dettagli su altre schede web.
    chrome.storage.local.get(['sf_dashboardTab','sf_state'], ({sf_dashboardTab,sf_state}) => {
      const readError=chrome.runtime.lastError;
      if(readError) {sendResponse(publishError(readError.message));return;}
      if (!sender.tab?.id || sender.tab.id !== sf_dashboardTab) {
        sendResponse(publishError('Apri la stessa scheda StoryFlow usata per l’ultimo test. Il registro non è disponibile in questa scheda.'));
        return;
      }
      const entries=Array.isArray(sf_state?.log)?sf_state.log:[];
      const errorLine=[...entries].reverse().find(line=>typeof line==='string' && line.startsWith('ERRORE '))||'';
      sendResponse({ok:true,available:!!sf_state,
        lastError:sf_state?.lastError||null,
        errorLine:String(errorLine).slice(0,800),
        log:entries.slice(-12).map(line=>String(line).slice(0,800)),
        summary:{ok:Number(sf_state?.ok)||0,err:Number(sf_state?.err)||0,dryRun:!!sf_state?.dryRun,total:Number(sf_state?.total)||0},
        at:Number(sf_state?.t)||0
      });
    });
    return true;
  }

  return handleEngineMessage(msg, sender, sendResponse);
});

if (chrome.runtime.onUserScriptMessage) {
  chrome.runtime.onUserScriptMessage.addListener(handleEngineMessage);
}


// Riconnessione per dashboard già aperte quando Chrome abilita o aggiorna l'estensione.
// chrome.scripting restituisce l'accesso al bridge senza chiedere all'utente di
// chiudere la pagina; il file si auto-protegge da doppie installazioni.
async function ensureDashboardBridge(tabId) {
  if (!Number.isInteger(tabId)) return false;
  try {
    const frames=await chrome.scripting.executeScript({
      target:{tabId},
      func:() => Boolean(document.getElementById('storyCanvas') && document.getElementById('siteUrl') && document.getElementById('btnPublishQueue'))
    });
    if (!frames?.[0]?.result) return false;
    await chrome.scripting.executeScript({target:{tabId},files:['saas-bridge.js']});
    return true;
  } catch (_) { return false; }
}
async function reconnectOpenDashboards() {
  try {
    const tabs=await chrome.tabs.query({});
    for (const tab of tabs) {
      if (/^https?:\/\//.test(tab.url||'') && !tab.url?.includes('business.facebook.com')) {
        await ensureDashboardBridge(tab.id);
      }
    }
  } catch (_) {}
}
chrome.runtime.onInstalled.addListener(() => { void reconnectOpenDashboards(); void registerEngine().then(checkEngineUpdate); });
chrome.runtime.onStartup.addListener(() => { void reconnectOpenDashboards(); void registerEngine().then(checkEngineUpdate); });
chrome.tabs.onActivated.addListener(({tabId}) => { void ensureDashboardBridge(tabId); });
chrome.action.onClicked.addListener(tab => { void ensureDashboardBridge(tab.id); void registerEngine(); });
// Eseguito anche quando il service worker riparte dopo riattivazione.
void reconnectOpenDashboards();
void registerEngine();
