// StoryFlow Studio desktop: sostituisce l'estensione Chrome.
// Una finestra con tre viste: barra superiore (shell.html), pannello StoryFlow (web) e Meta Business Suite.
// Il motore di pubblicazione (engine/composer.js) viene iniettato nella vista Meta e comunica
// tramite window.StoryFlowNative, la stessa interfaccia dell'app Android.
'use strict';

const { app, BaseWindow, WebContentsView, ipcMain, session, shell, net, Menu, powerSaveBlocker } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { EngineManager } = require('./engine');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
if (process.env.STORYFLOW_STUDIO_URL) config.studioUrl = process.env.STORYFLOW_STUDIO_URL;
if (process.env.STORYFLOW_ENGINE_MANIFEST_URL) config.engineManifestUrl = process.env.STORYFLOW_ENGINE_MANIFEST_URL;

const COMPOSER_URL = 'https://business.facebook.com/latest/story_composer/';
const LOGIN_URL = 'https://business.facebook.com/';
const TOOLBAR_H = 52;
const STALL_TIMEOUT_MS = 4 * 60 * 1000;
const studioOrigin = new URL(config.studioUrl).origin;

// Meta deve vedere un normale Chrome desktop, non "Electron".
function chromeUserAgent() {
  const major = process.versions.chrome.split('.')[0];
  const platform = process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}
app.userAgentFallback = chromeUserAgent();

if (!app.requestSingleInstanceLock()) app.quit();

/** @type {BaseWindow} */ let win;
/** @type {WebContentsView} */ let toolbarView;
/** @type {WebContentsView} */ let studioView;
/** @type {WebContentsView} */ let metaView;
/** @type {EngineManager} */ let engine;

let front = 'studio';
let metaLoggedIn = false;
let progressText = '';
// stopAfter: "Ferma la coda dopo questa storia"; screenLock: id di powerSaveBlocker, lo schermo resta acceso durante la coda.
const run = { running: false, state: null, lastProgressAt: 0, watchdog: null, stopAfter: false, screenLock: -1 };
// Onboarding: scelta o verifica del nome della pagina nella vista Meta (mai insieme a una coda).
const setup = { busy: false };
/** @type {string} */ let metaSetupCode = '';

const reportPath = () => path.join(app.getPath('userData'), 'last-report.json');

function hostMatches(url, domain) {
  try {
    const h = new URL(url).hostname;
    return h === domain || h.endsWith('.' + domain);
  } catch (_) { return false; }
}
const isMetaUrl = url => hostMatches(url, 'facebook.com') || hostMatches(url, 'instagram.com');
const isComposerUrl = url => String(url || '').startsWith(COMPOSER_URL);
const isStudioUrl = url => { try { return new URL(url).origin === studioOrigin; } catch (_) { return false; } };

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
}

// --- VISTE ---

function layout() {
  const { width, height } = win.getContentBounds();
  toolbarView.setBounds({ x: 0, y: 0, width, height: TOOLBAR_H });
  const body = { x: 0, y: TOOLBAR_H, width, height: Math.max(0, height - TOOLBAR_H) };
  studioView.setBounds(body);
  metaView.setBounds(body);
}

function showView(name) {
  // Durante la coda la vista Meta resta dietro la schermata di pubblicazione del pannello.
  if (name === 'meta' && run.running && !config.showMetaWhilePublishing) return;
  front = name === 'meta' ? 'meta' : 'studio';
  // Aggiungere di nuovo una vista già presente la porta in primo piano.
  win.contentView.addChildView(front === 'meta' ? metaView : studioView);
  (front === 'meta' ? metaView : studioView).webContents.focus();
  pushToolbarState();
}

function pushToolbarState() {
  if (!toolbarView || toolbarView.webContents.isDestroyed()) return;
  toolbarView.webContents.send('shell:state', {
    appName: config.appName,
    front,
    running: run.running,
    progressText,
    metaLoggedIn,
    engine: engine.info()
  });
}

async function refreshMetaLogin() {
  try {
    const cookies = await session.fromPartition('persist:meta').cookies.get({ name: 'c_user' });
    const logged = cookies.some(c => String(c.domain || '').replace(/^\./, '').endsWith('facebook.com'));
    if (logged !== metaLoggedIn) { metaLoggedIn = logged; pushToolbarState(); }
  } catch (_) {}
}

function lockDownSession(partition, allowed) {
  const ses = session.fromPartition(partition);
  ses.setUserAgent(chromeUserAgent());
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.includes(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => allowed.includes(permission));
}

function createWindow() {
  lockDownSession('persist:studio', ['clipboard-sanitized-write', 'fullscreen']);
  lockDownSession('persist:meta', ['clipboard-sanitized-write', 'fullscreen']);

  win = new BaseWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 700,
    title: config.appName, backgroundColor: '#f6f7fa', show: true
  });

  toolbarView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload-shell.js'), contextIsolation: true, sandbox: true }
  });
  studioView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload-studio.js'), partition: 'persist:studio', contextIsolation: true, sandbox: true }
  });
  metaView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-meta.js'), partition: 'persist:meta',
      contextIsolation: true, sandbox: true, backgroundThrottling: false
    }
  });

  win.contentView.addChildView(metaView);
  win.contentView.addChildView(studioView);
  win.contentView.addChildView(toolbarView);
  layout();
  win.on('resize', layout);
  win.on('closed', () => { app.quit(); });

  // Pannello: resta sul proprio dominio, i link esterni si aprono nel browser.
  const sw = studioView.webContents;
  sw.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  sw.on('will-navigate', (e, url) => { if (!isStudioUrl(url)) { e.preventDefault(); openExternal(url); } });
  sw.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) progressText = `Pannello non raggiungibile (${desc}). Controlla la connessione e premi Ctrl+R.`;
    pushToolbarState();
  });

  // Meta: popup di login Facebook/Instagram restano nell'app, il resto va nel browser.
  const mw = metaView.webContents;
  mw.setWindowOpenHandler(({ url }) => {
    if (isMetaUrl(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 900, height: 760, webPreferences: { partition: 'persist:meta', sandbox: true, contextIsolation: true } } };
    }
    openExternal(url);
    return { action: 'deny' };
  });
  mw.on('will-prevent-unload', e => e.preventDefault());
  mw.on('did-finish-load', () => { maybeInject(); void refreshMetaLogin(); });
  mw.on('did-navigate', () => { void refreshMetaLogin(); });
  mw.on('render-process-gone', (_e, details) => {
    if (run.running) failRun(`La pagina Meta si è chiusa inaspettatamente (${details.reason}).`);
  });
  mw.debugger.on('detach', () => {});

  toolbarView.webContents.loadFile(path.join(__dirname, 'shell.html'));
  toolbarView.webContents.on('did-finish-load', pushToolbarState);
  sw.loadURL(config.studioUrl);
  mw.loadURL(LOGIN_URL);
  setInterval(refreshMetaLogin, 15000);
}

// --- CODA DI PUBBLICAZIONE ---

function maybeInject() {
  if (!run.running) return;
  const url = metaView.webContents.getURL();
  if (!isComposerUrl(url)) return;
  metaView.webContents.executeJavaScript(engine.code()).catch(() => {});
}

function loadComposer(dryRun) {
  const hash = dryRun ? '#sftest' : '#sfauto';
  metaView.webContents.loadURL(`${COMPOSER_URL}?sf_ts=${Date.now()}${hash}`);
}

function startWatchdog() {
  stopWatchdog();
  run.watchdog = setInterval(() => {
    if (!run.running) return;
    maybeInject();
    if (Date.now() - run.lastProgressAt > STALL_TIMEOUT_MS) {
      failRun('Nessun avanzamento da 4 minuti: la pagina Meta potrebbe essere bloccata.');
    }
  }, 2000);
}
function stopWatchdog() {
  if (run.watchdog) clearInterval(run.watchdog);
  run.watchdog = null;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(res => setTimeout(() => res(null), ms))]);
}

async function startQueue(payloadJson) {
  if (run.running || setup.busy) return;
  let payload;
  try { payload = JSON.parse(payloadJson); } catch (_) { return; }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return;
  const dryRun = Boolean(payload.dryRun);

  run.running = true;
  run.stopAfter = false;
  run.lastProgressAt = Date.now();
  if (run.screenLock < 0) run.screenLock = powerSaveBlocker.start('prevent-display-sleep');
  progressText = 'Avvio pubblicazione…';
  pushToolbarState();
  // Prima di partire controlla se c'è un motore più recente (massimo 5 secondi di attesa).
  await withTimeout(engine.checkForUpdate(), 5000);
  run.state = {
    items, dryRun, done: 0, ok: 0, err: 0, total: items.length,
    reqId: String(payload.reqId || 'sf-' + Date.now()).slice(0, 100),
    log: [], t: Date.now()
  };
  loadComposer(dryRun);
  startWatchdog();
  showView(config.showMetaWhilePublishing ? 'meta' : 'studio');
}

function saveReport() {
  if (!run.state) return;
  const { ok, err, total, log, lastError, dryRun, t } = run.state;
  try {
    fs.writeFileSync(reportPath(), JSON.stringify({ ok, err, total, log: (log || []).slice(-40), lastError: lastError || null, dryRun, t }));
  } catch (_) {}
}

async function detachDebugger() {
  try { if (metaView.webContents.debugger.isAttached()) metaView.webContents.debugger.detach(); } catch (_) {}
}

function finishRun() {
  if (!run.running) return;
  run.running = false;
  run.stopAfter = false;
  if (run.screenLock >= 0) { powerSaveBlocker.stop(run.screenLock); run.screenLock = -1; }
  stopWatchdog();
  saveReport();
  void detachDebugger();
  progressText = '';
  showView('studio');
}

function failRun(message) {
  if (!run.running) return;
  if (run.state) {
    run.state.err = (run.state.err || 0) + 1;
    run.state.lastError = { stage: 'start', message, at: Date.now() };
    run.state.log.push('ERRORE: ' + message);
  }
  forwardProgress({ stage: 'error', index: (run.state?.done || 0) + 1, total: run.state?.total || 1, dryRun: run.state?.dryRun, message, log: run.state?.log || [] });
  finishRun();
}

function forwardProgress(progress) {
  run.lastProgressAt = Date.now();
  // La storia in lavorazione è la prima della coda salvata dal motore: il pannello ne mostra l'anteprima.
  const current = run.state?.items?.[0]?.id;
  if (current != null && progress.itemId == null) progress.itemId = String(current).slice(0, 100);
  progressText = String(progress.message || progress.stage || '').slice(0, 160);
  pushToolbarState();
  // Ri-serializzato: alla pagina del pannello arriva solo JSON puro.
  const json = JSON.stringify(progress);
  studioView.webContents
    .executeJavaScript(`window.__onStoryFlowNativeProgress && window.__onStoryFlowNativeProgress(${json});`)
    .catch(() => {});
}

// Il motore chiama nextStory sia per la storia successiva sia per riprovare quella attuale
// (un nuovo tentativo ha _retries sulla prima storia): ci si ferma solo nel primo caso.
function nextStory(dryRun) {
  const st = run.state;
  if (run.stopAfter && st && !(Number(st.items?.[0]?._retries) > 0)) {
    const remainingIds = (Array.isArray(st.items) ? st.items : []).map(it => String(it?.id ?? '').slice(0, 100)).filter(Boolean);
    if (Array.isArray(st.log)) st.log.push(`Coda fermata dall'utente: ${remainingIds.length} storie restano in coda`);
    const total = Number(st.total) || (Number(st.done) || 0) + remainingIds.length;
    forwardProgress({
      stage: 'stopped', index: Math.min(Math.max(1, Number(st.done) || 1), Math.max(1, total)), total,
      dryRun: Boolean(st.dryRun), ok: Number(st.ok) || 0, err: Number(st.err) || 0, remainingIds,
      message: 'Coda fermata su richiesta'
    });
    finishRun();
    return;
  }
  loadComposer(dryRun);
}

function lastReport() {
  let st = run.state;
  if (!st) {
    try { st = JSON.parse(fs.readFileSync(reportPath(), 'utf8')); } catch (_) { st = null; }
  }
  if (!st) return JSON.stringify({ available: false });
  return JSON.stringify({
    available: true,
    lastError: st.lastError || null,
    log: (st.log || []).slice(-40),
    summary: { ok: st.ok || 0, err: st.err || 0, total: st.total || 0 }
  });
}

// --- ONBOARDING: NOME DELLA PAGINA META ---
// Apre la pagina delle storie (la stessa del motore) e vi esegue engine/meta-setup.js:
// "pick" fa cliccare all'utente il nome della sua Pagina/profilo, "verify" ripete il controllo del motore.

const SETUP_REASONS = ['cancel', 'timeout', 'notfound', 'login', 'busy', 'navigated', 'error', 'empty', 'restart'];

function cleanSetupResult(res) {
  const r = res && typeof res === 'object' ? res : {};
  return {
    ok: r.ok === true,
    reason: SETUP_REASONS.includes(r.reason) ? r.reason : (r.ok === true ? '' : 'error'),
    text: String(r.text || '').slice(0, 200),
    suggestion: String(r.suggestion || '').slice(0, 200)
  };
}

async function runMetaSetup(kind, text) {
  if (run.running || setup.busy) return cleanSetupResult({ reason: 'busy' });
  setup.busy = true;
  const mw = metaView.webContents;
  /** @type {(() => void) | null} */ let stopWatching = null;
  let needsLogin = false;
  try {
    progressText = kind === 'pick' ? 'Clicca sul nome della tua pagina in Meta Business Suite' : 'Verifica del nome della pagina…';
    pushToolbarState();
    try { await mw.loadURL(`${COMPOSER_URL}?sf_setup=${Date.now()}`); } catch (_) {}
    if (!isComposerUrl(mw.getURL())) {
      // Meta ha mandato al login: lasciamo la vista Meta aperta per accedere.
      needsLogin = true;
      showView('meta');
      return cleanSetupResult({ reason: 'login' });
    }
    if (kind === 'pick') showView('meta');
    const call = kind === 'pick' ? 'window.__sfMetaSetup.pick()' : `window.__sfMetaSetup.verify(${JSON.stringify(String(text || ''))})`;
    // Se la pagina cambia o si chiude, lo script iniettato non risponderà più.
    const interrupted = new Promise(resolve => {
      const onNav = () => resolve({ reason: 'navigated' });
      mw.once('did-navigate', onNav);
      stopWatching = () => mw.removeListener('did-navigate', onNav);
    });
    const limit = kind === 'pick' ? 6 * 60 * 1000 : 40 * 1000;
    const res = await Promise.race([
      mw.executeJavaScript(`${metaSetupCode}\n;${call}`).catch(() => ({ reason: 'error' })),
      interrupted,
      new Promise(resolve => setTimeout(() => resolve({ reason: 'timeout' }), limit))
    ]);
    // Meta può mandare al login anche dopo il caricamento della pagina.
    if (res && res.reason === 'navigated' && !isComposerUrl(mw.getURL())) {
      needsLogin = true;
      showView('meta');
      return cleanSetupResult({ reason: 'login' });
    }
    return cleanSetupResult(res);
  } finally {
    if (stopWatching) stopWatching();
    setup.busy = false;
    progressText = '';
    if (kind === 'pick' && !needsLogin) showView('studio'); else pushToolbarState();
  }
}

// --- CLIC "VERI" tramite Chrome DevTools Protocol (come chrome.debugger nell'estensione) ---

async function cdp(method, params) {
  const dbg = metaView.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  return dbg.sendCommand(method, params);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

async function trustedClick(x, y) {
  x = num(x); y = num(y);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(60);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}

async function trustedDrag(sx, sy, ex, ey) {
  sx = num(sx); sy = num(sy); ex = num(ex); ey = num(ey);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx, y: sy, button: 'none' });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', buttons: 1, clickCount: 1 });
  const steps = 25;
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(sx + (ex - sx) * i / steps), y = Math.round(sy + (ey - sy) * i / steps);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await sleep(12);
  }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ex, y: ey, button: 'left', buttons: 0, clickCount: 1 });
}

// --- IPC: ogni messaggio è accettato solo dalla vista giusta ---

const fromStudio = e => e.sender === studioView.webContents && isStudioUrl(e.senderFrame?.url || '');
const fromMeta = e => e.sender === metaView.webContents && isMetaUrl(e.senderFrame?.url || '');
const fromToolbar = e => e.sender === toolbarView.webContents;

function registerIpc() {
  // Pannello
  ipcMain.on('sf:startQueue', (e, json) => { if (fromStudio(e)) void startQueue(String(json)); });
  ipcMain.on('sf:openMetaLogin', e => {
    if (!fromStudio(e)) return;
    if (!run.running && !isMetaUrl(metaView.webContents.getURL())) metaView.webContents.loadURL(LOGIN_URL);
    showView('meta');
  });
  ipcMain.handle('sf:pickMetaTarget', e => (fromStudio(e) ? runMetaSetup('pick') : null));
  ipcMain.handle('sf:verifyMetaTarget', (e, text) => (fromStudio(e) ? runMetaSetup('verify', String(text || '').slice(0, 200)) : null));
  ipcMain.on('sf:openMetaComposer', e => {
    if (!fromStudio(e) || run.running || setup.busy) return;
    metaView.webContents.loadURL(COMPOSER_URL);
    showView('meta');
  });
  ipcMain.on('sf:cancelMetaSetup', e => {
    if (!fromStudio(e) || !setup.busy) return;
    metaView.webContents.executeJavaScript('window.__sfMetaSetup && window.__sfMetaSetup.cancel()').catch(() => {});
  });
  ipcMain.on('sf:getLastReport', e => { e.returnValue = fromStudio(e) ? lastReport() : JSON.stringify({ available: false }); });
  ipcMain.on('sf:getEngineInfo', e => { e.returnValue = JSON.stringify(engine.info()); });
  ipcMain.on('sf:isQueueRunning', e => { e.returnValue = (fromStudio(e) || fromMeta(e)) && run.running; });
  ipcMain.on('sf:setStopAfterCurrent', (e, stop) => { if (fromStudio(e)) run.stopAfter = Boolean(stop) && run.running; });
  ipcMain.handle('sf:checkEngine', async e => {
    if (!fromStudio(e) && !fromToolbar(e)) return null;
    const res = await engine.checkForUpdate();
    pushToolbarState();
    return res;
  });

  // Motore nella pagina Meta
  ipcMain.on('sf:getState', e => { e.returnValue = fromMeta(e) && run.running ? JSON.stringify(run.state) : 'null'; });
  ipcMain.on('sf:saveState', (e, json) => {
    if (!fromMeta(e) || !run.running) return;
    try { run.state = JSON.parse(String(json)); } catch (_) {}
  });
  ipcMain.on('sf:progress', (e, json) => {
    if (!fromMeta(e) || !run.running) return;
    try { forwardProgress(JSON.parse(String(json))); } catch (_) {}
  });
  ipcMain.handle('sf:trustedClick', async (e, x, y) => {
    if (!fromMeta(e) || !run.running) return false;
    try { await trustedClick(x, y); return true; } catch (_) { return false; }
  });
  ipcMain.handle('sf:trustedDrag', async (e, sx, sy, ex, ey) => {
    if (!fromMeta(e) || !run.running) return false;
    try { await trustedDrag(sx, sy, ex, ey); return true; } catch (_) { return false; }
  });
  ipcMain.on('sf:nextStory', (e, dryRun) => { if (fromMeta(e) && run.running) nextStory(Boolean(dryRun)); });
  ipcMain.on('sf:finishQueue', e => { if (fromMeta(e)) finishRun(); });

  // Barra superiore
  ipcMain.on('shell:show', (e, view) => { if (fromToolbar(e)) showView(String(view)); });
  ipcMain.on('shell:reloadStudio', e => { if (fromToolbar(e)) studioView.webContents.reloadIgnoringCache(); });
  ipcMain.on('shell:metaHome', e => {
    if (!fromToolbar(e) || run.running) return;
    metaView.webContents.loadURL(LOGIN_URL);
    showView('meta');
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac ? [/** @type {Electron.MenuItemConstructorOptions} */ ({ role: 'appMenu' })] : []),
    { role: 'editMenu' },
    {
      label: 'Visualizza',
      submenu: [
        { label: 'Pannello StoryFlow', accelerator: 'CmdOrCtrl+1', click: () => showView('studio') },
        { label: 'Meta Business Suite', accelerator: 'CmdOrCtrl+2', click: () => showView('meta') },
        { type: 'separator' },
        { label: 'Ricarica pannello', accelerator: 'CmdOrCtrl+R', click: () => studioView.webContents.reloadIgnoringCache() },
        { label: 'Strumenti sviluppatore (pannello)', accelerator: 'F12', click: () => studioView.webContents.toggleDevTools() },
        { label: 'Strumenti sviluppatore (Meta)', accelerator: 'Shift+F12', click: () => metaView.webContents.toggleDevTools() }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // Motore integrato: copiato in desktop/engine da "npm run sync-engine"; in sviluppo va bene anche ../engine.
  const copiedDir = path.join(ROOT, 'engine');
  const bundledDir = fs.existsSync(copiedDir) ? copiedDir : path.join(ROOT, '..', 'engine');
  metaSetupCode = fs.readFileSync(path.join(bundledDir, 'meta-setup.js'), 'utf8');
  engine = new EngineManager({
    manifestUrl: config.engineManifestUrl,
    publicKey: config.enginePublicKey,
    bundledDir,
    cacheDir: path.join(app.getPath('userData'), 'engine'),
    fetch: url => net.fetch(url, { cache: 'no-store' })
  });
  registerIpc();
  buildMenu();
  createWindow();
  void engine.checkForUpdate().then(pushToolbarState);
  setInterval(() => { if (!run.running) void engine.checkForUpdate().then(pushToolbarState); },
    Math.max(5, Number(config.engineCheckMinutes) || 30) * 60 * 1000);
});

app.on('window-all-closed', () => app.quit());
