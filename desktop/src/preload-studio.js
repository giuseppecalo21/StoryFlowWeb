// Ponte del pannello StoryFlow: stessa interfaccia window.StoryFlowNative dell'app Android.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('StoryFlowNative', {
  getPlatform: () => 'desktop',
  startQueue: json => ipcRenderer.send('sf:startQueue', String(json)),
  isQueueRunning: () => ipcRenderer.sendSync('sf:isQueueRunning'),
  openMetaLogin: () => ipcRenderer.send('sf:openMetaLogin'),
  pickMetaTarget: () => ipcRenderer.invoke('sf:pickMetaTarget'),
  verifyMetaTarget: text => ipcRenderer.invoke('sf:verifyMetaTarget', String(text)),
  openMetaComposer: () => ipcRenderer.send('sf:openMetaComposer'),
  cancelMetaSetup: () => ipcRenderer.send('sf:cancelMetaSetup'),
  getLastReport: () => ipcRenderer.sendSync('sf:getLastReport'),
  getEngineInfo: () => ipcRenderer.sendSync('sf:getEngineInfo'),
  checkEngineUpdate: () => ipcRenderer.invoke('sf:checkEngine')
});
