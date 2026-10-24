// Ponte della vista Meta: usato dal motore (engine/composer.js) iniettato nel composer delle storie.
// Il processo principale accetta questi messaggi solo da pagine facebook.com e solo durante una coda.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('StoryFlowNative', {
  getPlatform: () => 'desktop',
  isQueueRunning: () => ipcRenderer.sendSync('sf:isQueueRunning'),
  getState: () => ipcRenderer.sendSync('sf:getState'),
  saveState: json => ipcRenderer.send('sf:saveState', String(json)),
  sendProgress: json => ipcRenderer.send('sf:progress', String(json)),
  trustedClick: (x, y) => ipcRenderer.invoke('sf:trustedClick', Number(x), Number(y)),
  trustedDrag: (sx, sy, ex, ey) => ipcRenderer.invoke('sf:trustedDrag', Number(sx), Number(sy), Number(ex), Number(ey)),
  nextStory: dryRun => ipcRenderer.send('sf:nextStory', Boolean(dryRun)),
  finishQueue: () => ipcRenderer.send('sf:finishQueue')
});
