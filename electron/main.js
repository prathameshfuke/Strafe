const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu, protocol, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const https = require('https');
const http = require('http');

// Set app icon on Windows
if (process.platform === 'win32') {
  const iconPath = path.join(__dirname, '../icon.ico');
  if (fs.existsSync(iconPath)) {
    app.setAppUserModelId('com.strafe.vaulttrack');
  }
}

// Optimize memory parameters
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const ProcessMonitor = require('./processMonitor');
const SessionManager = require('./sessionManager');
const { fetchNews } = require('./newsService');

// Register custom protocol for local cover art loading
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }
]);

let mainWindow = null;
let floatingWindow = null;
let tray = null;
let db = null;
let isDbFallback = false;
let fallbackDbPath = '';
let fallbackData = {};
let achievementInterval = null;
let sessionManager = null;
const processMonitor = new ProcessMonitor();

const dbHelper = {
  prepare: (sql) => {
    return {
      run: (...params) => {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        if (isDbFallback) {
          return executeFallbackRun(sql, args);
        } else {
          return db.prepare(sql).run(args);
        }
      },
      all: (...params) => {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        if (isDbFallback) {
          return executeFallbackQuery(sql, args);
        } else {
          return db.prepare(sql).all(args);
        }
      },
      get: (...params) => {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        if (isDbFallback) {
          return executeFallbackQuery(sql, args)[0] || null;
        } else {
          return db.prepare(sql).get(args);
        }
      }
    };
  }
};

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
      rawg_id INTEGER,
      steam_app_id INTEGER,
      cover_portrait TEXT,
      cover_hero TEXT,
      release_year INTEGER
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
      key TEXT,
      icon_url TEXT,
      icon_local TEXT,
      global_percent REAL,
      unlocked_session_id INTEGER,
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
      id TEXT PRIMARY KEY,
      username TEXT,
      avatar_path TEXT,
      bio TEXT,
      status_text TEXT,
      status_type TEXT,
      age INTEGER,
      favorite_genre TEXT,
      is_onboarded INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reddit_id TEXT UNIQUE,
      title TEXT,
      url TEXT,
      upvotes INTEGER,
      comments INTEGER,
      posted_at TEXT,
      fetched_at TEXT,
      is_read INTEGER DEFAULT 0,
      matched_game_id TEXT
    );

    CREATE TABLE IF NOT EXISTS player_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT,
      milestone INTEGER,
      playstyle TEXT,
      generated_at TEXT,
      exported_path TEXT
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

  // Games migrations
  try {
    db.exec("ALTER TABLE games ADD COLUMN steam_app_id INTEGER");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE games ADD COLUMN cover_portrait TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE games ADD COLUMN cover_hero TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE games ADD COLUMN release_year INTEGER");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE games ADD COLUMN total_seconds INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE games ADD COLUMN last_played TEXT");
  } catch (e) {}

  // Achievements migrations
  try {
    db.exec("ALTER TABLE achievements ADD COLUMN key TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE achievements ADD COLUMN icon_url TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE achievements ADD COLUMN icon_local TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE achievements ADD COLUMN global_percent REAL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE achievements ADD COLUMN unlocked_session_id INTEGER");
  } catch (e) {}

  // Ensure default profile exists
  const profileExists = db.prepare("SELECT id FROM profile WHERE id = 'user_profile'").get();
  if (!profileExists) {
    db.prepare("INSERT INTO profile (id, is_onboarded) VALUES ('user_profile', 0)").run();
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
  fallbackData.news = fallbackData.news || [];
  fallbackData.player_cards = fallbackData.player_cards || [];
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
  fallbackData.games.forEach(g => {
    if (g.total_seconds === undefined) g.total_seconds = 0;
    if (g.last_played === undefined) g.last_played = null;
  });

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
    if (query.includes('from news')) {
      return fallbackData.news;
    }
    if (query.includes('from player_cards')) {
      return fallbackData.player_cards;
    }
  }
  return [];
}

function executeFallbackRun(sql, params = []) {
  const query = sql.trim().toLowerCase();
  
  if (query.startsWith('insert into games')) {
    // games(id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id, steam_app_id, cover_portrait, cover_hero, release_year)
    const [id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id, steam_app_id, cover_portrait, cover_hero, release_year] = params;
    // Remove duplicate if exists
    fallbackData.games = fallbackData.games.filter(g => g.id !== id);
    fallbackData.games.push({ id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id, steam_app_id, cover_portrait, cover_hero, release_year });
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

  if (query.startsWith('insert into achievements') || query.startsWith('insert or replace into achievements')) {
    // achievements(id, game_id, name, description, rarity, unlocked, unlocked_date, key, icon_url, icon_local, global_percent, unlocked_session_id)
    const [id, game_id, name, description, rarity, unlocked, unlocked_date, key, icon_url, icon_local, global_percent, unlocked_session_id] = params;
    fallbackData.achievements = fallbackData.achievements.filter(a => a.id !== id);
    fallbackData.achievements.push({ id, game_id, name, description, rarity, unlocked, unlocked_date, key, icon_url, icon_local, global_percent, unlocked_session_id });
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

  if (query.startsWith('insert into news') || query.startsWith('insert or replace into news') || query.startsWith('replace into news')) {
    const [reddit_id, title, url, upvotes, comments, posted_at, fetched_at, is_read, matched_game_id] = params;
    fallbackData.news = fallbackData.news.filter(n => n.reddit_id !== reddit_id);
    fallbackData.news.push({ id: Date.now() + Math.random(), reddit_id, title, url, upvotes, comments, posted_at, fetched_at, is_read: is_read || 0, matched_game_id });
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('insert into player_cards')) {
    const [game_id, milestone, playstyle, generated_at, exported_path] = params;
    fallbackData.player_cards.push({ id: Date.now() + Math.random(), game_id, milestone, playstyle, generated_at, exported_path });
    saveFallbackDb();
    return { changes: 1 };
  }

  if (query.startsWith('update games')) {
    const id = params[params.length - 1];
    const game = fallbackData.games.find(g => g.id === id);
    if (game) {
      if (query.includes('status =') && query.includes('rating =')) {
        // e.g. UPDATE games SET status = ?, rating = ?, is_favorite = ? WHERE id = ?
        game.status = params[0];
        game.rating = params[1];
        game.is_favorite = params[2];
      } else if (query.includes('is_favorite =')) {
        game.is_favorite = params[0];
      } else if (query.includes('total_seconds =')) {
        // e.g. UPDATE games SET total_seconds = COALESCE(total_seconds, 0) + ?, last_played = ? WHERE id = ?
        game.total_seconds = (game.total_seconds || 0) + params[0];
        game.last_played = params[1];
      }
      saveFallbackDb();
      return { changes: 1 };
    }
  }

  if (query.startsWith('update achievements')) {
    // UPDATE achievements SET unlocked = ?, unlocked_date = ? WHERE id = ?
    // OR UPDATE achievements SET unlocked = 1, unlocked_date = ? WHERE game_id = ? AND key = ?
    if (query.includes('key =')) {
      const [unlocked_date, game_id, key] = params;
      const ach = fallbackData.achievements.find(a => a.game_id === game_id && a.key === key);
      if (ach) {
        ach.unlocked = 1;
        ach.unlocked_date = unlocked_date;
        saveFallbackDb();
        return { changes: 1 };
      }
    } else {
      const [unlocked, unlocked_date, id] = params;
      const ach = fallbackData.achievements.find(a => a.id === id);
      if (ach) {
        ach.unlocked = unlocked;
        ach.unlocked_date = unlocked_date;
        saveFallbackDb();
        return { changes: 1 };
      }
    }
  }

  if (query.startsWith('update news')) {
    if (query.includes('is_read =')) {
      const is_read = params[0];
      const idOrRedditId = params[1];
      const newsItem = fallbackData.news.find(n => n.reddit_id === idOrRedditId || String(n.id) === String(idOrRedditId));
      if (newsItem) {
        newsItem.is_read = is_read;
        saveFallbackDb();
        return { changes: 1 };
      }
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
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Use .ico on Windows for proper icon display (PNG shows default Electron icon)
  const mainIconPath = process.platform === 'win32'
    ? path.join(__dirname, '../icon.ico')
    : path.join(__dirname, '../icon.png');

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // frameless for custom cyberpunk titlebar
    icon: mainIconPath,
    backgroundColor: '#161412', // Match warm/dark sidebar theme to prevent white flash
    show: false,
    skipTaskbar: false,        // CRITICAL: always show in taskbar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // prevents timer slowdown
      v8CacheOptions: 'bypassHeatCheck' // faster startup, less recompile
    }
  });

  mainWindow.maximize();

  // Load Vite dev server in development, built files in production
  const startUrl = app.isPackaged
    ? `file://${path.join(__dirname, '../dist/index.html')}`
    : 'http://localhost:5173';

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept close → minimize instead of exit (unless app.isQuitting)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.minimize(); // minimize NOT hide — stays in taskbar
      return false;
    }
  });

  mainWindow.on('minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:minimized');
    }
  });

  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:restored');
    }
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

  const floatIconPath = process.platform === 'win32'
    ? path.join(__dirname, '../icon.ico')
    : path.join(__dirname, '../icon.png');

  floatingWindow = new BrowserWindow({
    width: 340,
    height: 180,
    frame: false,
    icon: floatIconPath,
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
  // Use .ico for tray on Windows — PNG sometimes fails or shows generic icon
  const icoPath = path.join(__dirname, '../icon.ico');
  const pngPath = path.join(__dirname, '../icon.png');
  const fallbackPath = path.join(__dirname, 'tray_icon.png');

  const trayIcon = (process.platform === 'win32' && fs.existsSync(icoPath))
    ? icoPath
    : fs.existsSync(pngPath)
      ? pngPath
      : fs.existsSync(fallbackPath)
        ? fallbackPath
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

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
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
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.whenReady().then(() => {
  // Register file protocol to allow loading local cached cover art
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error("Protocol error:", error);
    }
  });

  initDatabase();
  
  // Initialize SessionManager and start monitoring
  sessionManager = new SessionManager(dbHelper, () => mainWindow);
  processMonitor.startMonitoring();

  createMainWindow();
  createTray();

  // On startup: check if any library game is already running
  try {
    const games = isDbFallback
      ? executeFallbackQuery("SELECT * FROM games")
      : db.prepare("SELECT * FROM games").all();
    processMonitor.scanForLibraryGames(games, (game) => {
      console.log(`[STRAFE] Game already running on startup: ${game.name}`);
      sessionManager.startSession(game.id, game.exe_path, game.name);
      processMonitor.watch(game.exe_path, game.id, handleGameExit);
    });
  } catch (err) {
    console.error("Failed to run startup game scan:", err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', (event) => {
  if (process.platform !== 'darwin' && app.isQuitting) {
    app.quit();
  } else {
    event.preventDefault();
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
    dbHelper.prepare(updateSql).run('Playing', gameId);

    // Update Profile status_type to 'In-Game' and status_text
    const getGameSql = "SELECT name, cover_art FROM games WHERE id = ?";
    const game = dbHelper.prepare(getGameSql).get(gameId);
    const gameName = game ? game.name : 'a game';
    const coverArt = game ? game.cover_art : '';
    
    const updateProfileSql = "UPDATE profile SET status_type = 'In-Game', status_text = ? WHERE id = 'user_profile'";
    dbHelper.prepare(updateProfileSql).run(`Playing ${gameName}`);

    sessionManager.startSession(gameId, exePath, gameName);
    processMonitor.watch(exePath, gameId, handleGameExit);

    // Minimize window instead of hiding it
    if (mainWindow) {
      mainWindow.minimize();
    }
    createFloatingWindow(gameId, gameName, coverArt);
    updateTrayStatus(gameName);

    // Notify renderer of game status change
    const statusData = { gameId, status: 'running', gameName };
    if (mainWindow) mainWindow.webContents.send('game:status-change', statusData);

    return { success: true };
  } catch (error) {
    console.error("Failed to launch game", error);
    return { success: false, error: error.message };
  }
});

// Force Kill active game
ipcMain.handle('game:kill', async (event, gameId) => {
  const active = sessionManager.activeSession;
  if (active && active.gameId === gameId) {
    const exeName = active.exeName;
    console.log(`Force stopping monitoring and task-killing: ${exeName}`);
    
    // Attempt taskkill
    exec(`taskkill /IM ${exeName} /F`, (err) => {
      if (err) {
        console.warn(`Could not taskkill ${exeName}. It might have already exited.`, err);
      }
    });

    processMonitor.unwatch(active.exePath);
    const endedSession = sessionManager.endSession('manual_stop');
    const elapsed = endedSession ? endedSession.elapsed : 0;
    
    // Restore main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
    // Close overlay
    if (floatingWindow) {
      floatingWindow.close();
      floatingWindow = null;
    }
    updateTrayStatus(null);
    
    // Revert DB statuses
    const revertGameSql = "UPDATE games SET status = 'Installed' WHERE id = ?";
    const revertProfileSql = "UPDATE profile SET status_type = 'Online', status_text = 'Online' WHERE id = 'user_profile'";
    
    dbHelper.prepare(revertGameSql).run(gameId);
    dbHelper.prepare(revertProfileSql).run();

    if (mainWindow) {
      mainWindow.webContents.send('game:status-change', { gameId, status: 'stopped', durationSeconds: elapsed });
    }
    
    return { success: true };
  }
  return { success: false, error: 'No active monitoring session for this game.' };
});

// IPC: Manual stop session
ipcMain.handle('session:stop', () => {
  if (sessionManager.activeSession) {
    processMonitor.unwatch(sessionManager.activeSession.exePath);
  }
  return sessionManager.endSession('manual_stop');
});

// IPC: Get current session (for when renderer reloads)
ipcMain.handle('session:getActive', () => {
  return sessionManager.getActiveSession();
});

// IPC: Fetch Crackwatch Reddit News
ipcMain.handle('system:fetch-news', async () => {
  await fetchNews(dbHelper);
  return dbHelper.prepare("SELECT * FROM news ORDER BY posted_at DESC LIMIT 25").all();
});

// Called when process monitor detects game closed
function handleGameExit(exeName, gameId) {
  const activeSession = sessionManager.activeSession;
  const elapsed = activeSession ? Math.floor((Date.now() - activeSession.startTime) / 1000) : 0;
  
  sessionManager.endSession('process_exited');
  
  // Bring STRAFE back to foreground
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
  
  // Close overlay
  if (floatingWindow) {
    floatingWindow.close();
    floatingWindow = null;
  }
  updateTrayStatus(null);

  // Show Desktop Notification
  try {
    const getGameSql = "SELECT name FROM games WHERE id = ?";
    const game = dbHelper.prepare(getGameSql).get(gameId);
    const gameName = game ? game.name : 'Game';
    const gameMinutes = Math.round(elapsed / 60 * 10) / 10;
    
    new Notification({
      title: 'Session Tracked! 🎮',
      body: `You finished playing ${gameName}. Logged ${gameMinutes} min.`
    }).show();
  } catch (err) {
    console.error(err);
  }

  // Revert DB statuses
  const revertGameSql = "UPDATE games SET status = 'Installed' WHERE id = ?";
  const revertProfileSql = "UPDATE profile SET status_type = 'Online', status_text = 'Online' WHERE id = 'user_profile'";
  dbHelper.prepare(revertGameSql).run(gameId);
  dbHelper.prepare(revertProfileSql).run();

  // Send stopped status to renderer
  if (mainWindow) {
    mainWindow.webContents.send('game:status-change', { gameId, status: 'stopped', durationSeconds: elapsed });
  }
}

// Steam Store API Search Fallback (to avoid CORS in renderer)
ipcMain.handle('system:steam-search', async (event, term) => {
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=en&cc=US`;
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Steam search error:", error);
    return null;
  }
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

// Helper to download an image from a URL, automatically following redirects
function downloadImage(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'));
      return;
    }

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolve(downloadImage(response.headers.location, destPath, redirectCount + 1));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image (status: ${response.statusCode})`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    });

    request.on('error', (err) => {
      reject(err);
    });
  });
}

// Caching game cover art fetched from API
ipcMain.handle('game:cache-image', async (event, gameId, url) => {
  try {
    if (!url || !url.startsWith('http')) {
      return null;
    }

    // Determine extension
    let ext = '.jpg';
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const lastDot = pathname.lastIndexOf('.');
      if (lastDot !== -1) {
        const urlExt = pathname.substring(lastDot).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(urlExt)) {
          ext = urlExt;
        }
      }
    } catch (e) {
      console.warn("Could not parse image URL extension, defaulting to .jpg", e);
    }

    const coversDir = path.join(app.getPath('userData'), 'covers');
    const destPath = path.join(coversDir, `${gameId}${ext}`);

    await downloadImage(url, destPath);

    const normalizedPath = destPath.replace(/\\/g, '/');
    const localUrl = `media://${normalizedPath}`;

    // Update database
    const updateSql = "UPDATE games SET cover_art = ? WHERE id = ?";
    if (isDbFallback) {
      executeFallbackRun(updateSql, [localUrl, gameId]);
    } else {
      db.prepare(updateSql).run(localUrl, gameId);
    }

    console.log(`Successfully cached game image for ${gameId} to ${localUrl}`);
    return localUrl;
  } catch (error) {
    console.error(`Failed to cache image for game ${gameId}:`, error);
    return null;
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
