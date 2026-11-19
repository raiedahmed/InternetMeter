const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  getDetail: (from, to) => ipcRenderer.invoke('detail:get', from, to),
  getTrackerStatus: () => ipcRenderer.invoke('tracker:status'),
  relaunchAsAdmin: () => ipcRenderer.invoke('admin:relaunch'),
  getIcon: (p) => ipcRenderer.invoke('icon:get', p),
  scanNetwork: () => ipcRenderer.invoke('network:scan'),
  toggleWidget: (show) => ipcRenderer.invoke('widget:toggle', show),
  focusWindow: () => ipcRenderer.invoke('window:focus'),
  onTick: (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on('tick', h);
    return () => ipcRenderer.removeListener('tick', h);
  },
  onTracker: (cb) => {
    const h = (_e, data) => cb(data);
    ipcRenderer.on('tracker', h);
    return () => ipcRenderer.removeListener('tracker', h);
  },
});
