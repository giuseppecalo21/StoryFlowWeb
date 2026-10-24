// Ponte della barra superiore (shell.html, file locale dell'app).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('StoryFlowShell', {
  onState: callback => ipcRenderer.on('shell:state', (_e, state) => callback(state)),
  show: view => ipcRenderer.send('shell:show', String(view)),
  reloadStudio: () => ipcRenderer.send('shell:reloadStudio'),
  metaHome: () => ipcRenderer.send('shell:metaHome'),
  checkEngine: () => ipcRenderer.invoke('sf:checkEngine')
});
