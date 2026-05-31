const { exec } = require('child_process');
const path = require('path');

let activeInterval = null;
let activeGame = null;

/**
 * Checks if a process is running on Windows using tasklist
 * @param {string} exeName - The executable filename (e.g. 'notepad.exe')
 * @returns {Promise<boolean>}
 */
function isProcessRunning(exeName) {
  return new Promise((resolve) => {
    // Filter tasklist by IMAGENAME
    exec(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      const isRunning = stdout.toLowerCase().includes(exeName.toLowerCase());
      resolve(isRunning);
    });
  });
}

/**
 * Starts monitoring a game process
 * @param {string} gameId - The database ID of the game
 * @param {string} exePath - Absolute path to the game's executable
 * @param {Function} onTick - Callback for each second tick: (elapsedSeconds) => void
 * @param {Function} onExit - Callback when game closes: ({ gameId, startTime, endTime, durationSeconds }) => void
 */
function startMonitoring(gameId, exePath, onTick, onExit) {
  if (activeInterval) {
    stopMonitoring();
  }

  const exeName = path.basename(exePath);
  const startTime = new Date().toISOString();
  let elapsedSeconds = 0;
  let consecFailures = 0;
  let checkCounter = 0;

  activeGame = {
    gameId,
    exePath,
    exeName,
    startTime
  };

  // Periodically check if process is running
  activeInterval = setInterval(async () => {
    elapsedSeconds++;
    onTick(elapsedSeconds);

    checkCounter++;
    // Check system process list every 5 seconds to reduce CPU impact
    if (checkCounter >= 5) {
      checkCounter = 0;
      const isRunning = await isProcessRunning(exeName);
      
      if (isRunning) {
        consecFailures = 0;
      } else {
        consecFailures++;
        const secondsSinceStart = (new Date() - new Date(startTime)) / 1000;
        
        // If it's missing for 3 consecutive checks (~15 seconds) and we are past the 15-second launch grace period
        if (consecFailures >= 3 && secondsSinceStart > 15) {
          stopMonitoring();
          
          // Calculate actual playtime, correcting for the 15s failure buffer
          const finalDuration = Math.max(1, elapsedSeconds - 15);
          onExit({
            gameId,
            startTime,
            endTime: new Date().toISOString(),
            durationSeconds: Math.round(finalDuration)
          });
        }
      }
    }
  }, 1000);
}

/**
 * Stops the current monitoring loop
 */
function stopMonitoring() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
  activeGame = null;
}

/**
 * Gets the current active game stats
 */
function getActiveGame() {
  return activeGame;
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  getActiveGame
};
