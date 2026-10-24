'use strict';
const $ = id => document.getElementById(id);
const api = window.StoryFlowShell;

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => api.show(tab.dataset.view));
});
$('btnMetaHome').addEventListener('click', () => api.metaHome());
$('btnEngine').addEventListener('click', async () => {
  const b = $('btnEngine');
  b.disabled = true; b.textContent = 'Controllo…';
  try {
    const res = await api.checkEngine();
    b.textContent = res?.updated ? `Aggiornato a ${res.version}` : (res?.lastError ? 'Nessun aggiornamento' : 'Già aggiornato');
  } catch (_) {
    b.textContent = 'Errore';
  }
  setTimeout(() => { b.disabled = false; b.textContent = 'Aggiorna motore'; }, 3000);
});

api.onState(state => {
  document.title = state.appName;
  $('appName').textContent = state.appName;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === state.front));
  $('metaDot').classList.toggle('ok', Boolean(state.metaLoggedIn));
  $('metaDot').title = state.metaLoggedIn ? 'Accesso a Meta effettuato' : 'Accesso a Meta non rilevato';
  $('btnMetaHome').hidden = Boolean(state.metaLoggedIn) || state.running;
  const status = $('status');
  status.classList.toggle('running', Boolean(state.running));
  status.textContent = state.running ? (state.progressText || 'Pubblicazione in corso…') : (state.progressText || '');
  const e = state.engine || {};
  const eng = $('engine');
  eng.textContent = `Motore ${e.version || '?'} · ${e.source || ''}`;
  eng.classList.toggle('warn', Boolean(e.lastError));
  eng.title = e.lastError ? `Ultimo controllo aggiornamenti: ${e.lastError}` : 'Motore di pubblicazione aggiornato';
  $('btnEngine').hidden = Boolean(state.running);
});
