// StoryFlow 2.5.2: il pannello sa se il bridge riceve il messaggio e se Meta viene aperto.
(() => {
  // Una scheda già aperta può ricevere nuovamente il bridge dopo l'attivazione.
  if (globalThis.__STORYFLOW_BRIDGE_ACTIVE__) {
    try {
      window.postMessage({source:'STORYFLOW_EXT',status:'READY',version:chrome.runtime.getManifest().version},location.origin);
      return;
    } catch (_) { globalThis.__STORYFLOW_BRIDGE_ACTIVE__=false; }
  }
  globalThis.__STORYFLOW_BRIDGE_ACTIVE__=true;
  const post = (status, extra={}) => window.postMessage({source:'STORYFLOW_EXT',status,...extra},location.origin);
  function available() {
    try { return Boolean(chrome.runtime?.id); } catch (_) { return false; }
  }
  let lossReported=false;
  function announce() {
    if (available()) {lossReported=false; post('READY',{version:chrome.runtime.getManifest().version});}
    else if (!lossReported) {lossReported=true;post('EXTENSION_CONTEXT_LOST',{error:'Estensione disattivata o aggiornata. Clicca l’icona StoryFlow o ricarica la dashboard.'});}
  }
  announce();
  setInterval(announce, 3000);

  window.addEventListener('message', event => {
    if (event.source!==window || event.origin!==location.origin || event.data?.source!=='STORYFLOW_SAAS') return;
    const msg=event.data;
    if (msg.cmd==='PING_EXTENSION') { announce(); return; }
    if (msg.cmd==='REQUEST_LAST_REPORT') {
      if (!available()) {post('LAST_REPORT',{ok:false,error:'Estensione non connessa'});return;}
      try {
        chrome.runtime.sendMessage({cmd:'GET_LAST_REPORT'}, response => {
          const lastError=chrome.runtime.lastError?.message;
          post('LAST_REPORT',{...(response||{}),ok:!lastError&&Boolean(response?.ok),error:lastError||response?.error||''});
        });
      } catch(e) { post('LAST_REPORT',{ok:false,error:e.message}); }
      return;
    }
    if (msg.cmd!=='START_PUBLISH_QUEUE') return;
    const reqId=typeof msg.reqId==='string'?msg.reqId:'';
    if (!available()) {
      post('START_FAILED',{reqId,error:'Contesto estensione non valido. Ricarica dashboard ed estensione.'}); return;
    }
    post('BRIDGE_RECEIVED',{reqId});
    try {
      chrome.runtime.sendMessage({
        cmd:'START_QUEUE',items:msg.items,dryRun:!!msg.dryRun,reqId
      }, response => {
        let lastError;
        try { lastError=chrome.runtime.lastError?.message; } catch (e) { lastError=e.message; }
        if (lastError || !response?.ok) {
          post('START_FAILED',{reqId,error:lastError||response?.error||'Il service worker non ha avviato Meta'});
          return;
        }
        post('STARTED',{reqId,metaTabId:response.metaTabId});
      });
    } catch(e) { post('START_FAILED',{reqId,error:'Invio al service worker: '+e.message}); }
  });

  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.cmd==='SF_PROGRESS') post('PROGRESS',{progress:msg.progress});
  });
})();
