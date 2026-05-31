const path = require('path');

class SessionManager {
  constructor(db, getMainWindow) {
    this.db = db;
    this.getMainWindow = getMainWindow;
    this.activeSession = null;
    this.pollInterval = null;
    this.tickInterval = null;
  }

  startSession(gameId, exePath, exeName) {
    if (this.activeSession) {
      this.endSession('new_game_started');
    }

    if (!exeName && exePath) {
      exeName = path.basename(exePath);
    }

    const startTime = new Date().toISOString();
    
    // Insert session into DB immediately, providing end_time to avoid NOT NULL constraint errors
    const result = this.db.prepare(`
      INSERT INTO sessions (game_id, start_time, end_time, duration_seconds, notes)
      VALUES (?, ?, ?, 0, '')
    `).run(gameId, startTime, startTime);

    this.activeSession = {
      sessionId: result.lastInsertRowid,
      gameId,
      exeName,
      exePath,
      startTime: Date.now(),  // Use unix ms for accurate diff
      lastUpdate: Date.now(),
      lastPersisted: 0
    };

    // Poll process every 5 seconds to check if still alive
    this.pollInterval = setInterval(() => {
      this._checkProcess();
    }, 5000);

    // Update DB duration every 10 seconds (so if crash, data not lost)
    this.tickInterval = setInterval(() => {
      this._persistDuration();
    }, 10000);

    // Notify renderer immediately
    this._broadcastUpdate();

    console.log(`[STRAFE] Session started: ${exeName}`);
  }

  _checkProcess() {
    if (!this.activeSession) return;

    const { exec } = require('child_process');
    const exeName = this.activeSession.exeName;

    exec(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, (err, stdout) => {
      if (err || !stdout.toLowerCase().includes(exeName.toLowerCase())) {
        console.log(`[STRAFE] Process gone: ${exeName}`);
        this.endSession('process_not_found');
      } else {
        // Still running — update elapsed
        this._broadcastUpdate();
      }
    });
  }

  _persistDuration() {
    if (!this.activeSession) return;

    const elapsed = Math.floor((Date.now() - this.activeSession.startTime) / 1000);
    
    this.db.prepare(`
      UPDATE sessions 
      SET duration_seconds = ?,
          end_time = ?
      WHERE id = ?
    `).run(elapsed, new Date().toISOString(), this.activeSession.sessionId);

    // Also update total playtime on game record
    const delta = elapsed - (this.activeSession.lastPersisted || 0);
    this.db.prepare(`
      UPDATE games
      SET total_seconds = COALESCE(total_seconds, 0) + ?,
          last_played = ?
      WHERE id = ?
    `).run(delta, new Date().toISOString(), this.activeSession.gameId);

    this.activeSession.lastPersisted = elapsed;
  }

  endSession(reason = 'manual') {
    if (!this.activeSession) return;

    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.pollInterval = null;
    this.tickInterval = null;

    const elapsed = Math.floor((Date.now() - this.activeSession.startTime) / 1000);

    // Final DB write
    this.db.prepare(`
      UPDATE sessions
      SET duration_seconds = ?,
          end_time = ?
      WHERE id = ?
    `).run(elapsed, new Date().toISOString(), this.activeSession.sessionId);

    const delta = elapsed - (this.activeSession.lastPersisted || 0);
    this.db.prepare(`
      UPDATE games
      SET total_seconds = COALESCE(total_seconds, 0) + ?,
          last_played = ?
      WHERE id = ?
    `).run(delta, new Date().toISOString(), this.activeSession.gameId);

    console.log(`[STRAFE] Session ended (${reason}): ${elapsed}s`);

    const endedSession = { ...this.activeSession, elapsed, reason };
    this.activeSession = null;

    // Notify renderer session ended
    const mainWindow = this.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send('session:ended', endedSession);
    }

    return endedSession;
  }

  _broadcastUpdate() {
    const mainWindow = this.getMainWindow();
    if (!this.activeSession || !mainWindow) return;

    const elapsed = Math.floor((Date.now() - this.activeSession.startTime) / 1000);

    mainWindow.webContents.send('session:tick', {
      gameId: this.activeSession.gameId,
      sessionId: this.activeSession.sessionId,
      elapsed,               // total seconds
      startTime: this.activeSession.startTime,
    });
  }

  getActiveSession() {
    if (!this.activeSession) return null;
    return {
      ...this.activeSession,
      elapsed: Math.floor((Date.now() - this.activeSession.startTime) / 1000)
    };
  }
}

module.exports = SessionManager;
