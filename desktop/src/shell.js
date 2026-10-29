'use strict';
const $ = id => document.getElementById(id);
const api = window.StoryFlowShell;
// Testi tradotti: arrivano con lo stato (desktop/src/i18n.js), finché non arrivano restano quelli dell'HTML.
let T = null;
const tx = (key, fallback, params = {}) => String((T && T[key]) || fallback).replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => api.show(tab.dataset.view));
});
$('btnMetaHome').addEventListener('click', () => api.metaHome());
$('btnEngine').addEventListener('click', async () => {
  const b = $('btnEngine');
  b.disabled = true; b.textContent = tx('checking', 'Controllo…');
  try {
    const res = await api.checkEngine();
    b.textContent = res?.updated ? tx('updatedTo', 'Aggiornato a {version}', { version: res.version }) : (res?.lastError ? tx('noUpdate', 'Nessun aggiornamento') : tx('upToDate', 'Già aggiornato'));
  } catch (_) {
    b.textContent = tx('error', 'Errore');
  }
  setTimeout(() => { b.disabled = false; b.textContent = tx('engineBtn', 'Aggiorna motore'); }, 3000);
});

api.onState(state => {
  T = state.texts || T;
  if (state.lang) document.documentElement.lang = state.lang;
  $('tabs').setAttribute('aria-label', tx('viewsAria', 'Viste'));
  $('tabStudio').textContent = tx('tabStudio', '🎨 Pannello storie');
  $('tabMeta').textContent = tx('tabMeta', '🔑 Meta Business Suite');
  $('btnMetaHome').textContent = tx('metaHome', 'Accedi a Meta');
  $('btnMetaHome').title = tx('metaHomeTitle', 'Apri la pagina iniziale di Meta Business Suite');
  $('btnEngine').title = tx('engineBtnTitle', 'Cerca subito una nuova versione del motore');
  if (!$('btnEngine').disabled) $('btnEngine').textContent = tx('engineBtn', 'Aggiorna motore');
  document.title = state.appName;
  $('appName').textContent = state.appName;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === state.front));
  $('metaDot').classList.toggle('ok', Boolean(state.metaLoggedIn));
  $('metaDot').title = state.metaLoggedIn ? tx('metaLoggedIn', 'Accesso a Meta effettuato') : tx('metaLoggedOut', 'Accesso a Meta non rilevato');
  $('btnMetaHome').hidden = Boolean(state.metaLoggedIn) || state.running;
  const status = $('status');
  status.classList.toggle('running', Boolean(state.running));
  status.textContent = state.running ? (state.progressText || tx('publishing', 'Pubblicazione in corso…')) : (state.progressText || '');
  const e = state.engine || {};
  const eng = $('engine');
  const source = e.source === 'integrato' ? tx('sourceBundled', 'integrato') : e.source === 'remoto' ? tx('sourceRemote', 'remoto') : (e.source || '');
  eng.textContent = tx('engine', 'Motore {version} · {source}', { version: e.version || '?', source });
  eng.classList.toggle('warn', Boolean(e.lastError));
  eng.title = e.lastError ? tx('engineLastError', 'Ultimo controllo aggiornamenti: {error}', { error: e.lastError }) : tx('engineOk', 'Motore di pubblicazione aggiornato');
  $('btnEngine').hidden = Boolean(state.running);
});
