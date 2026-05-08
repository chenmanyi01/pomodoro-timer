const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close-window'),
  setTrayTooltip: (text) => ipcRenderer.send('tray-tooltip', text),
});
