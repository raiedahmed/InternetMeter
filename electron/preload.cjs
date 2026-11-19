const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  onTick: (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on('tick', h);
    return () => ipcRenderer.removeListener('tick', h);
  },
});
