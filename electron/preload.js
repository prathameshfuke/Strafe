const { contextBridge, ipcRenderer } = require('electron');

const electronBridge = {
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params)
  },
  process: {
    launchGame: (gameId, exePath) => ipcRenderer.invoke('game:launch', gameId, exePath),
    killGame: (gameId) => ipcRenderer.invoke('game:kill', gameId),
    onGameStatusChange: (callback) => {
      const subscription = (_, data) => callback(data);
      ipcRenderer.on('game:status-change', subscription);
      return () => ipcRenderer.removeListener('game:status-change', subscription);
    },
    onActiveSessionTick: (callback) => {
      const subscription = (_, data) => callback(data);
      ipcRenderer.on('game:session-tick', subscription);
      return () => ipcRenderer.removeListener('game:session-tick', subscription);
    }
  },
  system: {
    selectExe: () => ipcRenderer.invoke('system:select-exe'),
    selectFolder: () => ipcRenderer.invoke('system:select-folder'),
    scanFolder: (folderPath) => ipcRenderer.invoke('system:scan-folder', folderPath),
    fetchNews: () => ipcRenderer.invoke('system:fetch-news'),
    openDataFolder: () => ipcRenderer.invoke('system:open-data-folder'),
    getVersion: () => ipcRenderer.invoke('system:get-version'),
    exportPng: (dataUrl) => ipcRenderer.invoke('system:export-png', dataUrl),
    cacheImage: (gameId, url) => ipcRenderer.invoke('game:cache-image', gameId, url),
    steamSearch: (term) => ipcRenderer.invoke('system:steam-search', term),
    showNotification: (title, body) => ipcRenderer.send('system:notify', title, body),
    minimizeToTray: () => ipcRenderer.send('system:minimize-to-tray'),
    exitApp: () => ipcRenderer.send('system:exit')
  }
};

contextBridge.exposeInMainWorld('electron', electronBridge);

contextBridge.exposeInMainWorld('strafe', {
  selectExe: electronBridge.system.selectExe,
  selectFolder: electronBridge.system.selectFolder,
  scanFolder: electronBridge.system.scanFolder,
  launchGame: electronBridge.process.launchGame,
  onSessionUpdate: electronBridge.process.onActiveSessionTick,
  onGameExit: (callback) => {
    const subscription = (_, data) => {
      if (data.status === 'stopped') callback(data);
    };
    ipcRenderer.on('game:status-change', subscription);
    return () => ipcRenderer.removeListener('game:status-change', subscription);
  },
  fetchNews: electronBridge.system.fetchNews,
  exportPlayerCard: electronBridge.system.exportPng,
  openDataFolder: electronBridge.system.openDataFolder,
  getVersion: electronBridge.system.getVersion,
  cacheImage: (gameId, url) => ipcRenderer.invoke('game:cache-image', gameId, url),
  steamSearch: (term) => ipcRenderer.invoke('system:steam-search', term),
  
  // New session & process hooks
  onSessionTick: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('session:tick', handler);
    return () => ipcRenderer.removeListener('session:tick', handler);
  },
  onSessionEnded: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('session:ended', handler);
    return () => ipcRenderer.removeListener('session:ended', handler);
  },
  getActiveSession: () => ipcRenderer.invoke('session:getActive'),
  stopSession: () => ipcRenderer.invoke('session:stop'),
  onMinimized: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:minimized', handler);
    return () => ipcRenderer.removeListener('app:minimized', handler);
  },
  onRestored: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('app:restored', handler);
    return () => ipcRenderer.removeListener('app:restored', handler);
  }
});
