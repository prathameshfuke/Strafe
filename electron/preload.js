const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
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
    exportPng: (dataUrl) => ipcRenderer.invoke('system:export-png', dataUrl),
    showNotification: (title, body) => ipcRenderer.send('system:notify', title, body),
    minimizeToTray: () => ipcRenderer.send('system:minimize-to-tray'),
    exitApp: () => ipcRenderer.send('system:exit')
  }
});
