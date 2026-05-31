const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const processMonitor = require('./processMonitor');

let mainWindow = null;
let floatingWindow = null;
let tray = null;
let db = null;
let isDbFallback = false;
let fallbackDbPath = '';
let fallbackData = {};

// --- 1. Database Initialization ---
function initDatabase() {
  const dbDir = app.getPath('userData');
  const dbPath = path.join(dbDir, 'vaulttrack.db');
  fallbackDbPath = path.join(dbDir, 'vaulttrack_fallback.json');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    console.log(`Database connected successfully at: ${dbPath}`);
    runMigrations();
  } catch (err) {
    console.warn("better-sqlite3 failed to load. Falling back to local JSON database persistence.", err);
    isDbFallback = true;
    initFallbackDb();
  }
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      exe_path TEXT NOT NULL,
      cover_art TEXT,
      genre TEXT,
      developer TEXT,
      description TEXT,
      status TEXT DEFAULT 'Installed',
      rating INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      date_added TEXT NOT NULL,
      rawg_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      rarity TEXT DEFAULT 'Common',
      unlocked INTEGER DEFAULT 0,
      unlocked_date TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS collection_games (
      collection_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      PRIMARY KEY (collection_id, game_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY DEFAULT 'user_profile',
      username TEXT DEFAULT 'Viper_Gamer',
      avatar_path TEXT,
      bio TEXT DEFAULT 'Ready to play.',
      status_text TEXT DEFAULT 'Online',
      status_type TEXT DEFAULT 'Online',
      age INTEGER DEFAULT 0,
      favorite_genre TEXT DEFAULT '',
      is_onboarded INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Run dynamic schema migrations for existing databases
  try {
    db.exec("ALTER TABLE profile ADD COLUMN age INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE profile ADD COLUMN favorite_genre TEXT DEFAULT ''");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE profile ADD COLUMN is_onboarded INTEGER DEFAULT 0");
  } catch (e) {}

  // Ensure default profile exists
  const profileExists = db.prepare("SELECT id FROM profile WHERE id = 'user_profile'").get();
  if (!profileExists) {
    db.prepare("INSERT INTO profile (id, username, bio, status_text, status_type, age, favorite_genre, is_onboarded) VALUES ('user_profile', 'Viper_Gamer', 'Hacking the mainframe...', 'Online', 'Online', 0, '', 0)").run();
  }
}

// --- 2. JSON Fallback Database Methods ---
function initFallbackDb() {
  if (fs.existsSync(fallbackDbPath)) {
    try {
      fallbackData = JSON.parse(fs.readFileSync(fallbackDbPath, 'utf8'));
    } catch (e) {
      console.error("Failed to read JSON fallback database", e);
      fallbackData = {};
    }
  }

  // Ensure arrays exist
  fallbackData.games = fallbackData.games || [];
  fallbackData.sessions = fallbackData.sessions || [];
  fallbackData.achievements = fallbackData.achievements || [];
  fallbackData.collections = fallbackData.collections || [];
  fallbackData.collection_games = fallbackData.collection_games || [];
  fallbackData.profile = fallbackData.profile || {
    id: 'user_profile',
    username: 'Viper_Gamer',
    avatar_path: null,
    bio: 'Hacking the mainframe...',
    status_text: 'Online',
    status_type: 'Online',
    age: 0,
    favorite_genre: '',
    is_onboarded: 0
  };
  if (fallbackData.profile.age === undefined) fallbackData.profile.age = 0;
  if (fallbackData.profile.favorite_genre === undefined) fallbackData.profile.favorite_genre = '';
  if (fallbackData.profile.is_onboarded === undefined) fallbackData.profile.is_onboarded = 0;
  fallbackData.settings = fallbackData.settings || {};

  saveFallbackDb();
}

function saveFallbackDb() {
  try {
    fs.writeFileSync(fallbackDbPath, JSON.stringify(fallbackData, null, 2), 'utf8');
  } catch (e) {
    console.error("Failed to save JSON fallback database", e);
  }
}

// Router for fallback DB queries
function executeFallbackQuery(sql, params = []) {
  const query = sql.trim().toLowerCase();
  
  if (query.startsWith('select')) {
    if (query.includes('from games')) {
      if (query.includes('where id =') || query.includes('where id = ?')) {
        const id = params[0];
        return fallbackData.games.find(g => g.id === id) || null;
      }
      return fallbackData.games;
    }
    if (query.includes('from sessions')) {
      if (query.includes('where game_id =')) {
        const gameId = params[0];
        return fallbackData.sessions.filter(s => s.game_id === gameId);
      }
      return fallbackData.sessions;
    }
    if (query.includes('from achievements')) {
      if (query.includes('where game_id =')) {
        const gameId = params[0];
        return fallbackData.achievements.filter(a => a.game_id === gameId);
      }
      return fallbackData.achievements;
    }
    if (query.includes('from collections')) {
      return fallbackData.collections;
    }
    if (query.includes('from collection_games')) {
      return fallbackData.collection_games;
    }
    if (query.includes('from profile')) {
      return [fallbackData.profile];
    }
    if (query.includes('from settings')) {
      return Object.entries(fallbackData.settings).map(([key, value]) => ({ key, value }));
    }
  }
  return [];
}

function executeFallbackRun(sql, params = []) {
  const query = sql.trim().toLowerCase();
  
  if (query.startsWith('insert into games')) {
    // games(id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id)
    const [id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id] = params;
    // Remove duplicate if exists
    fallbackData.games = fallbackData.games.filter(g => g.id !== id);
    fallbackData.games.push({ id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id });
    saveFallbackDb();
    return { changes: 1, lastInsertRowid: id };
  }
  
  if (query.startsWith('insert into sessions')) {
    // sessions(game_id, start_time, end_time, duration_seconds, notes)
    const [game_id, start_time, end_time, duration_seconds, notes] = params;
    const id = Date.now();
    fallbackData.sessions.push({ id, game_id, start_time, end_time, duration_seconds, notes });
    saveFallbackDb();
    return { changes: 1, lastInsertRowid: id };
  }

  if (query.startsWith('insert into achievements')) {
    // achievements(id, game_id, name, description, rarity, unlocked, unlocked_date)
    const [id, game_id, name, description, rarity, unlocked, unlocked_date] = params;
    fallbackData.achievements = fallbackData.achievements.filter(a => a.id !== id);
    fallbackData.achievements.push({ id, game_id, name, description, rarity, unlocked, unlocked_date });
    saveFallbackDb();
    return { changes: 1, lastInsertRowid: id };
  }

  if (query.startsWith('insert into collections')) {
    const [id, name, color, icon] = params;
    fallbackData.collections.push({ id, name, color, icon });
    saveFallbackDb();
    return { changes: 1, lastInsertRowid: id };
  }

  if (query.startsWith('insert into collection_games')) {
    const [collection_id, game_id] = params;
    fallbackData.collection_games.push({ collection_id, game_id });
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('update games')) {
    const id = params[params.length - 1];
    const game = fallbackData.games.find(g => g.id === id);
    if (game) {
      if (query.includes('status =')) {
        // e.g. UPDATE games SET status = ?, rating = ?, is_favorite = ? WHERE id = ?
        game.status = params[0];
        game.rating = params[1];
        game.is_favorite = params[2];
      } else if (query.includes('is_favorite =')) {
        game.is_favorite = params[0];
      }
      saveFallbackDb();
      return { changes: 1 };
    }
  }

  if (query.startsWith('update achievements')) {
    // UPDATE achievements SET unlocked = ?, unlocked_date = ? WHERE id = ?
    const [unlocked, unlocked_date, id] = params;
    const ach = fallbackData.achievements.find(a => a.id === id);
    if (ach) {
      ach.unlocked = unlocked;
      ach.unlocked_date = unlocked_date;
      saveFallbackDb();
      return { changes: 1 };
    }
  }

  if (query.startsWith('update profile')) {
    if (query.includes('status_type =')) {
      const [status_type, status_text] = params;
      fallbackData.profile.status_type = status_type;
      fallbackData.profile.status_text = status_text;
    } else if (query.includes('is_onboarded =') && !query.includes('username =')) {
      const [is_onboarded] = params;
      fallbackData.profile.is_onboarded = is_onboarded;
    } else {
      if (query.includes('is_onboarded =')) {
        const [username, avatar_path, bio, age, favorite_genre, is_onboarded] = params;
        fallbackData.profile.username = username;
        fallbackData.profile.avatar_path = avatar_path;
        fallbackData.profile.bio = bio;
        fallbackData.profile.age = age;
        fallbackData.profile.favorite_genre = favorite_genre;
        fallbackData.profile.is_onboarded = is_onboarded;
      } else {
        const [username, avatar_path, bio, age, favorite_genre] = params;
        fallbackData.profile.username = username;
        fallbackData.profile.avatar_path = avatar_path;
        fallbackData.profile.bio = bio;
        fallbackData.profile.age = age;
        fallbackData.profile.favorite_genre = favorite_genre;
      }
    }
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('insert or replace into settings') || query.startsWith('replace into settings') || query.startsWith('insert into settings')) {
    const [key, value] = params;
    fallbackData.settings[key] = value;
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('delete from games')) {
    const id = params[0];
    fallbackData.games = fallbackData.games.filter(g => g.id !== id);
    fallbackData.sessions = fallbackData.sessions.filter(s => s.game_id !== id);
    fallbackData.achievements = fallbackData.achievements.filter(a => a.game_id !== id);
    fallbackData.collection_games = fallbackData.collection_games.filter(cg => cg.game_id !== id);
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('delete from collections')) {
    const id = params[0];
    fallbackData.collections = fallbackData.collections.filter(c => c.id !== id);
    fallbackData.collection_games = fallbackData.collection_games.filter(cg => cg.collection_id !== id);
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('delete from collection_games')) {
    const [collection_id, game_id] = params;
    fallbackData.collection_games = fallbackData.collection_games.filter(cg => !(cg.collection_id === collection_id && cg.game_id === game_id));
    saveFallbackDb();
    return { changes: 1 };
  }

  return { changes: 0 };
}

// --- 3. Window Management ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    frame: false, // frameless for custom cyberpunk titlebar
    icon: path.join(__dirname, '../icon.png'),
    backgroundColor: '#08090c',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load Vite dev server in development, built files in production
  const startUrl = app.isPackaged
    ? `file://${path.join(__dirname, '../dist/index.html')}`
    : 'http://localhost:5173';

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (floatingWindow) {
      floatingWindow.close();
    }
  });
}

function createFloatingWindow(gameId, name, coverArt) {
  if (floatingWindow) {
    floatingWindow.close();
  }

  floatingWindow = new BrowserWindow({
    width: 340,
    height: 180,
    frame: false,
    icon: path.join(__dirname, '../icon.png'),
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Pass active info via hash route query
  const queryStr = `?gameId=${encodeURIComponent(gameId)}&name=${encodeURIComponent(name)}&cover=${encodeURIComponent(coverArt || '')}`;
  const startUrl = app.isPackaged
    ? `file://${path.join(__dirname, '../dist/index.html')}#/floating${queryStr}`
    : `http://localhost:5173/#/floating${queryStr}`;

  floatingWindow.loadURL(startUrl);

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });
}

// --- 4. Tray Integration ---
function createTray() {
  const customIconPath = path.join(__dirname, '../icon.png');
  const iconPath = path.join(__dirname, 'tray_icon.png');
  
  const trayIcon = fs.existsSync(customIconPath)
    ? customIconPath
    : fs.existsSync(iconPath)
      ? iconPath
      : path.join(__dirname, '../public/favicon.ico');
    
  try {
    tray = new Tray(trayIcon);
  } catch (e) {
    // If favicon or icon fails, create an empty tray icon buffer or ignore crashes
    console.warn("Could not load tray icon. System tray creation skipped.", e);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'VaultTrack', enabled: false },
    { type: 'separator' },
    { 
      label: 'Open Dashboard', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createMainWindow();
        }
      } 
    },
    { 
      label: 'Currently Playing', 
      enabled: false,
      id: 'currently-playing'
    },
    { type: 'separator' },
    { label: 'Exit VaultTrack', click: () => {
        app.isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('VaultTrack Game Library Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

function updateTrayStatus(gameName = null) {
  if (!tray) return;
  const menu = tray.getContextMenu();
  const currentlyPlayingItem = menu.items.find(item => item.id === 'currently-playing');
  
  if (currentlyPlayingItem) {
    if (gameName) {
      currentlyPlayingItem.label = `Playing: ${gameName}`;
      currentlyPlayingItem.visible = true;
      // Change tray tooltip
      tray.setToolTip(`VaultTrack - Playing ${gameName}`);
    } else {
      currentlyPlayingItem.label = 'Currently Playing';
      currentlyPlayingItem.visible = false;
      tray.setToolTip('VaultTrack Game Library Tracker');
    }
  }
}

// --- 5. Application Lifecycle & Security ---
app.whenReady().then(() => {
  initDatabase();
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- 6. IPC Call Handlers ---

// DB Query (Select queries)
ipcMain.handle('db:query', async (event, sql, params) => {
  if (isDbFallback) {
    return executeFallbackQuery(sql, params);
  }
  try {
    return db.prepare(sql).all(params);
  } catch (err) {
    console.error("SQLite query error:", sql, err);
    throw err;
  }
});

// DB Run (Insert, Update, Delete)
ipcMain.handle('db:run', async (event, sql, params) => {
  if (isDbFallback) {
    return executeFallbackRun(sql, params);
  }
  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error("SQLite execution error:", sql, err);
    throw err;
  }
});

// Launch EXE Game and monitor it
ipcMain.handle('game:launch', async (event, gameId, exePath) => {
  try {
    if (!fs.existsSync(exePath)) {
      throw new Error(`Executable file not found at path: ${exePath}`);
    }

    const exeDir = path.dirname(exePath);
    const exeName = path.basename(exePath);
    
    // Spawn game process (detached to let it run independently)
    const child = spawn(exePath, [], {
      cwd: exeDir,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    console.log(`Launched game ${gameId} - ${exeName}`);

    // Update DB status to 'Playing'
    const updateSql = "UPDATE games SET status = 'Playing' WHERE id = ?";
    if (isDbFallback) {
      executeFallbackRun(updateSql, ['Playing', gameId]);
    } else {
      db.prepare(updateSql).run('Playing', gameId);
    }

    // Update Profile status_type to 'In-Game' and status_text
    const getGameSql = "SELECT name, cover_art FROM games WHERE id = ?";
    const game = isDbFallback ? executeFallbackQuery(getGameSql, [gameId]) : db.prepare(getGameSql).get(gameId);
    const gameName = game ? game.name : 'a game';
    const coverArt = game ? game.cover_art : '';
    
    const updateProfileSql = "UPDATE profile SET status_type = 'In-Game', status_text = ? WHERE id = 'user_profile'";
    if (isDbFallback) {
      executeFallbackRun(updateProfileSql, [`Playing ${gameName}`]);
    } else {
      db.prepare(updateProfileSql).run(`Playing ${gameName}`);
    }

    // Hide main window and open floating widget overlay
    if (mainWindow) {
      mainWindow.hide();
    }
    createFloatingWindow(gameId, gameName, coverArt);
    updateTrayStatus(gameName);

    // Notify renderer of game status change
    const statusData = { gameId, status: 'running', gameName };
    if (mainWindow) mainWindow.webContents.send('game:status-change', statusData);

    // Start process watcher
    processMonitor.startMonitoring(
      gameId,
      exePath,
      (elapsedSeconds) => {
        // Tick callback (every 1 second)
        if (floatingWindow && !floatingWindow.isDestroyed()) {
          floatingWindow.webContents.send('game:session-tick', { gameId, elapsedSeconds });
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game:session-tick', { gameId, elapsedSeconds });
        }
      },
      async ({ gameId, startTime, endTime, durationSeconds }) => {
        // Exit callback (game closed)
        console.log(`Game ${gameId} exited. Playtime was ${durationSeconds} seconds.`);

        // Insert session record
        const insertSessionSql = "INSERT INTO sessions (game_id, start_time, end_time, duration_seconds, notes) VALUES (?, ?, ?, ?, ?)";
        if (isDbFallback) {
          executeFallbackRun(insertSessionSql, [gameId, startTime, endTime, durationSeconds, 'Auto-tracked session.']);
        } else {
          db.prepare(insertSessionSql).run(gameId, startTime, endTime, durationSeconds, 'Auto-tracked session.');
        }

        // Revert game status to 'Installed' or 'Playing' -> 'Installed'
        const revertGameSql = "UPDATE games SET status = 'Installed' WHERE id = ?";
        if (isDbFallback) {
          executeFallbackRun(revertGameSql, [gameId]);
        } else {
          db.prepare(revertGameSql).run(gameId);
        }

        // Revert Profile status
        const revertProfileSql = "UPDATE profile SET status_type = 'Online', status_text = 'Online' WHERE id = 'user_profile'";
        if (isDbFallback) {
          executeFallbackRun(revertProfileSql, []);
        } else {
          db.prepare(revertProfileSql).run();
        }

        // Close overlay and restore main dashboard
        if (floatingWindow) {
          floatingWindow.close();
          floatingWindow = null;
        }
        if (mainWindow) {
          mainWindow.show();
        }
        updateTrayStatus(null);

        // Show Desktop Notification
        const gameMinutes = Math.round(durationSeconds / 60 * 10) / 10;
        new Notification({
          title: 'Session Tracked! 🎮',
          body: `You finished playing ${gameName}. Logged ${gameMinutes} min.`
        }).show();

        // Send finished status to renderer
        if (mainWindow) {
          mainWindow.webContents.send('game:status-change', { gameId, status: 'stopped', durationSeconds });
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to launch game", error);
    return { success: false, error: error.message };
  }
});

// Force Kill active game
ipcMain.handle('game:kill', async (event, gameId) => {
  const active = processMonitor.getActiveGame();
  if (active && active.gameId === gameId) {
    const exeName = active.exeName;
    console.log(`Force stopping monitoring and task-killing: ${exeName}`);
    
    // Attempt taskkill
    exec(`taskkill /IM ${exeName} /F`, (err) => {
      if (err) {
        console.warn(`Could not taskkill ${exeName}. It might have already exited.`, err);
      }
    });

    processMonitor.stopMonitoring();
    
    // Close overlay and restore main window
    if (floatingWindow) {
      floatingWindow.close();
      floatingWindow = null;
    }
    if (mainWindow) {
      mainWindow.show();
    }
    updateTrayStatus(null);
    
    // Revert DB statuses
    const revertGameSql = "UPDATE games SET status = 'Installed' WHERE id = ?";
    const revertProfileSql = "UPDATE profile SET status_type = 'Online', status_text = 'Online' WHERE id = 'user_profile'";
    
    if (isDbFallback) {
      executeFallbackRun(revertGameSql, [gameId]);
      executeFallbackRun(revertProfileSql, []);
    } else {
      db.prepare(revertGameSql).run(gameId);
      db.prepare(revertProfileSql).run();
    }

    if (mainWindow) {
      mainWindow.webContents.send('game:status-change', { gameId, status: 'stopped', durationSeconds: 0 });
    }
    
    return { success: true };
  }
  return { success: false, error: 'No active monitoring session for this game.' };
});

// Browse EXE file
ipcMain.handle('system:select-exe', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Game Executable File',
    properties: ['openFile'],
    filters: [
      { name: 'Executable Files', extensions: ['exe'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// Export profile card image as PNG
ipcMain.handle('system:export-png', async (event, dataUrl) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Profile Card',
    defaultPath: path.join(app.getPath('downloads'), 'vaulttrack-profile.png'),
    filters: [
      { name: 'PNG Images', extensions: ['png'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  try {
    // Strip data URL header to get raw base64 string
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(result.filePath, base64Data, 'base64');
    return { success: true, filePath: result.filePath };
  } catch (err) {
    console.error("Failed to write PNG file:", err);
    return { success: false, error: err.message };
  }
});

// Native notifications
ipcMain.on('system:notify', (event, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// Minimize to tray
ipcMain.on('system:minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Exit
ipcMain.on('system:exit', () => {
  app.isQuitting = true;
  app.quit();
});
