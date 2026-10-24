// StoryFlow 2.4.1: avvio confermato + progressi robusti. Nessun cambiamento ai click Meta.
const COMPOSER_URL = 'https://business.facebook.com/latest/story_composer/';
const publishError = error => ({ok:false,error:String(error?.message||error||'Errore Chrome non specificato')});

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
    // La callback intercetta anche quota storage esaurita (es. JPG troppo grandi).
    try {
      chrome.storage.local.set({ sf_state:state, sf_dashboardTab:sender.tab.id }, () => {
        const storageError = chrome.runtime.lastError;
        if (storageError) { sendResponse(publishError('Salvataggio coda: '+storageError.message)); return; }
        try {
          chrome.tabs.create({url:COMPOSER_URL+(state.dryRun?'#zwtest':'#zwauto')}, tab => {
            const tabError = chrome.runtime.lastError;
            if (tabError || !tab?.id) {
              sendResponse(publishError('Apertura Meta: '+(tabError?.message||'nessuna scheda creata')));
              return;
            }
            sendResponse({ok:true,reqId,metaTabId:tab.id});
          });
        } catch (e) { sendResponse(publishError('Apertura Meta: '+e.message)); }
      });
    } catch (e) { sendResponse(publishError('Comunicazione Chrome: '+e.message)); }
    return true;
  }

  if (msg.cmd === 'SF_PROGRESS') {
    // Accettiamo telemetria solo dalla pagina di composizione Meta.
    const sourceUrl = sender.url || sender.tab?.url || '';
    if (!sourceUrl.startsWith(COMPOSER_URL)) return;
    chrome.storage.local.get(['sf_dashboardTab','sf_state'], ({sf_dashboardTab,sf_state}) => {
      if (chrome.runtime.lastError || !Number.isInteger(sf_dashboardTab)) return;
      const progress = {
        stage:String(msg.stage||'start').slice(0,24),
        index:Number(msg.index)||1, total:Number(msg.total)||1,
        dryRun:!!msg.dryRun, message:String(msg.message||'').slice(0,230),
        reqId:sf_state?.reqId||''
      };
      chrome.tabs.sendMessage(sf_dashboardTab,{cmd:'SF_PROGRESS',progress},()=>{
        void chrome.runtime.lastError;
      });
    });
    return;
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

  if (msg.cmd === 'TRUSTED_CLICK' && sender.tab?.id) {
    const tabId=sender.tab.id,x=Math.round(msg.x),y=Math.round(msg.y);
    (async () => {
      try { await chrome.debugger.attach({tabId},'1.3'); } catch (e) {}
      try {
        await chrome.debugger.sendCommand({tabId},'Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'left'});
        await chrome.debugger.sendCommand({tabId},'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
        await new Promise(r=>setTimeout(r,60));
        await chrome.debugger.sendCommand({tabId},'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
        await chrome.debugger.detach({tabId});
        sendResponse({ok:true});
      } catch (e) {
        try { await chrome.debugger.detach({tabId}); } catch (_) {}
        sendResponse(publishError(e));
      }
    })();
    return true;
  }
});


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
chrome.runtime.onInstalled.addListener(() => { void reconnectOpenDashboards(); });
chrome.runtime.onStartup.addListener(() => { void reconnectOpenDashboards(); });
chrome.tabs.onActivated.addListener(({tabId}) => { void ensureDashboardBridge(tabId); });
chrome.action.onClicked.addListener(tab => { void ensureDashboardBridge(tab.id); });
// Eseguito anche quando il service worker riparte dopo riattivazione.
void reconnectOpenDashboards();
