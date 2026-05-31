const { exec } = require('child_process');
const path = require('path');

class ProcessMonitor {
  constructor() {
    this.watchedProcesses = new Map();
    // key: exeName (lowercase)
    // value: { gameId, exePath, onExit callback }
    
    this.masterPollInterval = null;
  }

  startMonitoring() {
    if (this.masterPollInterval) {
      clearInterval(this.masterPollInterval);
    }
    // Single master poll — checks ALL watched processes at once
    this.masterPollInterval = setInterval(() => {
      this._pollAll();
    }, 3000); // Every 3 seconds
  }

  watch(exePath, gameId, onExit) {
    const exeName = path.basename(exePath).toLowerCase();
    this.watchedProcesses.set(exeName, { gameId, exePath, onExit });
    console.log(`[Monitor] Watching: ${exeName}`);
  }

  unwatch(exePath) {
    const exeName = path.basename(exePath).toLowerCase();
    this.watchedProcesses.delete(exeName);
  }

  _pollAll() {
    if (this.watchedProcesses.size === 0) return;

    // Get ALL running processes in one tasklist call (efficient)
    exec('tasklist /NH /FO CSV', (err, stdout) => {
      if (err) return;

      const runningProcesses = stdout.toLowerCase();

      this.watchedProcesses.forEach((info, exeName) => {
        const isRunning = runningProcesses.includes(exeName);
        
        if (!isRunning) {
          console.log(`[Monitor] Detected exit: ${exeName}`);
          info.onExit(exeName, info.gameId);
          this.watchedProcesses.delete(exeName);
        }
      });
    });
  }

  // Scan ALL running processes and match against library
  // Call this on app startup to detect already-running games
  scanForLibraryGames(libraryGames, onFound) {
    exec('tasklist /NH /FO CSV', (err, stdout) => {
      if (err) return;

      const runningProcesses = stdout.toLowerCase();

      libraryGames.forEach(game => {
        if (!game.exe_path) return;
        const exeName = path.basename(game.exe_path).toLowerCase();
        
        if (runningProcesses.includes(exeName)) {
          console.log(`[Monitor] Found already-running game: ${game.name}`);
          onFound(game);
        }
      });
    });
  }

  stopMonitoring() {
    if (this.masterPollInterval) {
      clearInterval(this.masterPollInterval);
      this.masterPollInterval = null;
    }
    this.watchedProcesses.clear();
  }
}

module.exports = ProcessMonitor;
