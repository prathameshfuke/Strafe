import { create } from 'zustand';

// Generate some beautiful mock data for browser mode or initial startup
const MOCK_GAMES = [
  {
    id: 'g1',
    name: 'Cyberpunk 2077',
    exe_path: 'C:\\Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe',
    cover_art: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    genre: 'RPG, Action',
    developer: 'CD PROJEKT RED',
    description: 'Cyberpunk 2077 is an open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification.',
    status: 'Playing',
    rating: 9,
    is_favorite: 1,
    date_added: '2026-01-15T12:00:00Z',
    rawg_id: 28
  },
  {
    id: 'g2',
    name: 'Hades II',
    exe_path: 'C:\\Games\\Hades2\\Hades2.exe',
    cover_art: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    genre: 'Action, Roguelike',
    developer: 'Supergiant Games',
    description: 'Battle beyond the Underworld using dark sorcery to confront the Titan of Time in this witchy rogue-like dungeon crawler.',
    status: 'Playing',
    rating: 10,
    is_favorite: 1,
    date_added: '2026-05-10T15:30:00Z',
    rawg_id: 853503
  },
  {
    id: 'g3',
    name: 'Elden Ring',
    exe_path: 'C:\\Games\\Elden Ring\\game\\eldenring.exe',
    cover_art: 'https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?w=600&auto=format&fit=crop&q=80',
    genre: 'RPG, Action',
    developer: 'FromSoftware',
    description: 'Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.',
    status: 'Completed',
    rating: 10,
    is_favorite: 1,
    date_added: '2026-02-20T10:00:00Z',
    rawg_id: 326244
  },
  {
    id: 'g4',
    name: 'Hollow Knight',
    exe_path: 'C:\\Games\\Hollow Knight\\hollow_knight.exe',
    cover_art: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    genre: 'Action, Metroidvania',
    developer: 'Team Cherry',
    description: 'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom of insects and heroes.',
    status: 'Installed',
    rating: 8,
    is_favorite: 0,
    date_added: '2026-03-01T08:45:00Z',
    rawg_id: 9767
  }
];

const MOCK_SESSIONS = [
  { id: 1, game_id: 'g1', start_time: '2026-05-25T19:00:00Z', end_time: '2026-05-25T21:30:00Z', duration_seconds: 9000, notes: 'Completed the Chippin In questline with Rogue.' },
  { id: 2, game_id: 'g1', start_time: '2026-05-28T20:00:00Z', end_time: '2026-05-28T23:00:00Z', duration_seconds: 10800, notes: 'Farmed legendary components in Santo Domingo.' },
  { id: 3, game_id: 'g2', start_time: '2026-05-30T14:00:00Z', end_time: '2026-05-30T16:15:00Z', duration_seconds: 8100, notes: 'Defeated Hecate on third attempt. Melinoë feels amazing to control!' },
  { id: 4, game_id: 'g3', start_time: '2026-05-24T12:00:00Z', end_time: '2026-05-24T17:00:00Z', duration_seconds: 18000, notes: 'Co-op run helping friends beat Malenia.' }
];

const MOCK_ACHIEVEMENTS = [
  { id: 'a1_1', game_id: 'g1', name: 'The Fool', description: 'Become a mercenary.', rarity: 'Common', unlocked: 1, unlocked_date: '2026-01-16T18:30:00Z' },
  { id: 'a1_2', game_id: 'g1', name: 'The Star', description: 'Leave Night City with the Aldecaldos.', rarity: 'Epic', unlocked: 0, unlocked_date: null },
  { id: 'a2_1', game_id: 'g2', name: 'Witchcraft', description: 'Cast 100 Hexes.', rarity: 'Common', unlocked: 1, unlocked_date: '2026-05-11T20:45:00Z' },
  { id: 'a2_2', game_id: 'g2', name: 'Chronos Slayer', description: 'Defeat Time.', rarity: 'Legendary', unlocked: 0, unlocked_date: null },
  { id: 'a3_1', game_id: 'g3', name: 'Shardbearer Godrick', description: 'Defeat Godrick the Grafted.', rarity: 'Rare', unlocked: 1, unlocked_date: '2026-02-22T14:20:00Z' },
  { id: 'a3_2', game_id: 'g3', name: 'Elden Lord', description: 'Achieve the Elden Lord ending.', rarity: 'Legendary', unlocked: 1, unlocked_date: '2026-04-10T22:15:00Z' }
];

const MOCK_COLLECTIONS = [
  { id: 'c1', name: 'Favorites', color: '#ff007f', icon: 'Heart' },
  { id: 'c2', name: 'Backlog / To Play', color: '#00d4ff', icon: 'FolderOpen' },
  { id: 'c3', name: '100% Achievements', color: '#39ff14', icon: 'Award' }
];

const MOCK_COLLECTION_GAMES = [
  { collection_id: 'c1', game_id: 'g1' },
  { collection_id: 'c1', game_id: 'g2' },
  { collection_id: 'c2', game_id: 'g4' }
];

const MOCK_PROFILE = {
  id: 'user_profile',
  username: 'Viper_Gamer',
  avatar_path: '',
  bio: 'Hacking the matrix. Building VaultTrack. Collecting pixel trophies.',
  status_text: 'Online',
  status_type: 'Online',
  age: 0,
  favorite_genre: '',
  is_onboarded: 0
};

const hasElectron = typeof window !== 'undefined' && window.electron !== undefined;

export const useGameStore = create((set, get) => ({
  games: [],
  sessions: [],
  achievements: [],
  collections: [],
  collectionGames: [],
  profile: MOCK_PROFILE,
  settings: {},
  loading: false,
  activeGameId: null,
  activeSessionSeconds: 0,

  // Initialize store and sync from database
  initStore: async () => {
    set({ loading: true });
    if (hasElectron) {
      try {
        const games = await window.electron.db.query("SELECT * FROM games");
        const sessions = await window.electron.db.query("SELECT * FROM sessions");
        const achievements = await window.electron.db.query("SELECT * FROM achievements");
        const collections = await window.electron.db.query("SELECT * FROM collections");
        const cg = await window.electron.db.query("SELECT * FROM collection_games");
        const profileArr = await window.electron.db.query("SELECT * FROM profile");
        const settingsArr = await window.electron.db.query("SELECT * FROM settings");

        const settings = {};
        settingsArr.forEach(s => { settings[s.key] = s.value; });

        set({
          games: games || [],
          sessions: sessions || [],
          achievements: achievements || [],
          collections: collections || [],
          collectionGames: cg || [],
          profile: (profileArr && profileArr[0]) ? profileArr[0] : MOCK_PROFILE,
          settings,
          loading: false
        });
      } catch (err) {
        console.error("Database sync failed, keeping local memory", err);
        set({ loading: false });
      }
    } else {
      // Browser Mock Simulation
      setTimeout(() => {
        const savedProfile = localStorage.getItem('vt-mock-profile');
        const parsedProfile = savedProfile ? JSON.parse(savedProfile) : {
          ...MOCK_PROFILE,
          age: 0,
          favorite_genre: '',
          is_onboarded: 0
        };
        set({
          games: MOCK_GAMES,
          sessions: MOCK_SESSIONS,
          achievements: MOCK_ACHIEVEMENTS,
          collections: MOCK_COLLECTIONS,
          collectionGames: MOCK_COLLECTION_GAMES,
          profile: parsedProfile,
          settings: { rawg_api_key: '', default_scan_path: 'C:\\Games' },
          loading: false
        });
      }, 500);
    }
  },

  // Add Game
  addGame: async (gameData) => {
    const newGame = {
      id: gameData.id || `g_${Date.now()}`,
      name: gameData.name,
      exe_path: gameData.exe_path,
      cover_art: gameData.cover_art || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
      genre: gameData.genre || 'Unknown',
      developer: gameData.developer || 'Unknown',
      description: gameData.description || '',
      status: gameData.status || 'Installed',
      rating: gameData.rating || 0,
      is_favorite: gameData.is_favorite || 0,
      date_added: new Date().toISOString(),
      rawg_id: gameData.rawg_id || null
    };

    if (hasElectron) {
      await window.electron.db.run(
        `INSERT INTO games (id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newGame.id, newGame.name, newGame.exe_path, newGame.cover_art,
          newGame.genre, newGame.developer, newGame.description, newGame.status,
          newGame.rating, newGame.is_favorite, newGame.date_added, newGame.rawg_id
        ]
      );
    }

    set(state => ({
      games: [...state.games, newGame]
    }));

    // Setup initial achievements manually or generate 3 default ones for the game
    const defaultAchs = [
      { id: `${newGame.id}_a1`, game_id: newGame.id, name: 'First Launch', description: 'Launch the game for the first time.', rarity: 'Common', unlocked: 0, unlocked_date: null },
      { id: `${newGame.id}_a2`, game_id: newGame.id, name: 'Dedicated Player', description: 'Log a total of 10 hours played.', rarity: 'Rare', unlocked: 0, unlocked_date: null },
      { id: `${newGame.id}_a3`, game_id: newGame.id, name: 'Master Collector', description: 'Write 3 session notes in the journal.', rarity: 'Epic', unlocked: 0, unlocked_date: null }
    ];

    for (const ach of defaultAchs) {
      if (hasElectron) {
        await window.electron.db.run(
          `INSERT INTO achievements (id, game_id, name, description, rarity, unlocked, unlocked_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ach.id, ach.game_id, ach.name, ach.description, ach.rarity, ach.unlocked, ach.unlocked_date]
        );
      }
    }

    set(state => ({
      achievements: [...state.achievements, ...defaultAchs]
    }));
  },

  // Delete Game
  deleteGame: async (gameId) => {
    if (hasElectron) {
      await window.electron.db.run("DELETE FROM games WHERE id = ?", [gameId]);
    }
    set(state => ({
      games: state.games.filter(g => g.id !== gameId),
      sessions: state.sessions.filter(s => s.game_id !== gameId),
      achievements: state.achievements.filter(a => a.game_id !== gameId),
      collectionGames: state.collectionGames.filter(cg => cg.game_id !== gameId)
    }));
  },

  // Toggle Pinned/Favorite
  toggleFavorite: async (gameId) => {
    const game = get().games.find(g => g.id === gameId);
    if (!game) return;
    const isFavorite = game.is_favorite ? 0 : 1;

    if (hasElectron) {
      await window.electron.db.run("UPDATE games SET is_favorite = ? WHERE id = ?", [isFavorite, gameId]);
    }
    set(state => ({
      games: state.games.map(g => g.id === gameId ? { ...g, is_favorite: isFavorite } : g)
    }));
  },

  // Update Rating & Status
  updateGameDetails: async (gameId, details) => {
    // details can contain status, rating, is_favorite
    const game = get().games.find(g => g.id === gameId);
    if (!game) return;
    const updated = { ...game, ...details };

    if (hasElectron) {
      await window.electron.db.run(
        "UPDATE games SET status = ?, rating = ?, is_favorite = ? WHERE id = ?",
        [updated.status, updated.rating, updated.is_favorite, gameId]
      );
    }
    set(state => ({
      games: state.games.map(g => g.id === gameId ? updated : g)
    }));
  },

  // Add a Manual Session
  addManualSession: async (gameId, durationHours, note, date) => {
    const durationSeconds = Math.round(durationHours * 3600);
    const start_time = new Date(date).toISOString();
    const end_time = new Date(new Date(date).getTime() + durationSeconds * 1000).toISOString();
    
    if (hasElectron) {
      const info = await window.electron.db.run(
        "INSERT INTO sessions (game_id, start_time, end_time, duration_seconds, notes) VALUES (?, ?, ?, ?, ?)",
        [gameId, start_time, end_time, durationSeconds, note]
      );
      set(state => ({
        sessions: [...state.sessions, { id: info.lastInsertRowid, game_id: gameId, start_time, end_time, duration_seconds: durationSeconds, notes: note }]
      }));
    } else {
      set(state => ({
        sessions: [...state.sessions, { id: Date.now(), game_id: gameId, start_time, end_time, duration_seconds: durationSeconds, notes: note }]
      }));
    }
  },

  // Update session note
  updateSessionNote: async (sessionId, notes) => {
    if (hasElectron) {
      await window.electron.db.run("UPDATE sessions SET notes = ? WHERE id = ?", [notes, sessionId]);
    }
    set(state => ({
      sessions: state.sessions.map(s => s.id === sessionId ? { ...s, notes } : s)
    }));
  },

  // Toggle Achievement Status
  toggleAchievement: async (achievementId, unlocked) => {
    const unlockedDate = unlocked ? new Date().toISOString() : null;
    if (hasElectron) {
      await window.electron.db.run("UPDATE achievements SET unlocked = ?, unlocked_date = ? WHERE id = ?", [unlocked ? 1 : 0, unlockedDate, achievementId]);
    }
    set(state => ({
      achievements: state.achievements.map(a => a.id === achievementId ? { ...a, unlocked: unlocked ? 1 : 0, unlocked_date: unlockedDate } : a)
    }));
  },

  // Add Achievement manually
  addAchievement: async (gameId, name, description, rarity) => {
    const ach = {
      id: `ach_${Date.now()}`,
      game_id: gameId,
      name,
      description,
      rarity,
      unlocked: 0,
      unlocked_date: null
    };

    if (hasElectron) {
      await window.electron.db.run(
        "INSERT INTO achievements (id, game_id, name, description, rarity, unlocked, unlocked_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [ach.id, ach.game_id, ach.name, ach.description, ach.rarity, ach.unlocked, ach.unlocked_date]
      );
    }
    set(state => ({
      achievements: [...state.achievements, ach]
    }));
  },

  // Update User Profile
  updateProfile: async (username, avatarPath, bio, age = 0, favoriteGenre = '') => {
    const profile = get().profile;
    const updated = { 
      ...profile, 
      username, 
      avatar_path: avatarPath, 
      bio, 
      age: parseInt(age) || 0, 
      favorite_genre: favoriteGenre 
    };

    if (hasElectron) {
      await window.electron.db.run(
        "UPDATE profile SET username = ?, avatar_path = ?, bio = ?, age = ?, favorite_genre = ? WHERE id = 'user_profile'",
        [username, avatarPath, bio, parseInt(age) || 0, favoriteGenre]
      );
    } else {
      localStorage.setItem('vt-mock-profile', JSON.stringify(updated));
    }
    set({ profile: updated });
  },

  // Set User Onboarding Status
  setOnboarded: async (onboarded) => {
    const profile = get().profile;
    const updated = { ...profile, is_onboarded: onboarded ? 1 : 0 };

    if (hasElectron) {
      await window.electron.db.run(
        "UPDATE profile SET is_onboarded = ? WHERE id = 'user_profile'",
        [onboarded ? 1 : 0]
      );
    } else {
      localStorage.setItem('vt-mock-profile', JSON.stringify(updated));
    }
    set({ profile: updated });
  },

  // Update User Profile Status
  updateProfileStatus: async (statusType, statusText) => {
    const profile = get().profile;
    const updated = { ...profile, status_type: statusType, status_text: statusText };

    if (hasElectron) {
      await window.electron.db.run(
        "UPDATE profile SET status_type = ?, status_text = ? WHERE id = 'user_profile'",
        [statusType, statusText]
      );
    } else {
      localStorage.setItem('vt-mock-profile', JSON.stringify(updated));
    }
    set({ profile: updated });
  },

  // Create Custom Collection
  createCollection: async (name, color, icon) => {
    const id = `col_${Date.now()}`;
    const newCol = { id, name, color, icon };

    if (hasElectron) {
      await window.electron.db.run(
        "INSERT INTO collections (id, name, color, icon) VALUES (?, ?, ?, ?)",
        [id, name, color, icon]
      );
    }
    set(state => ({
      collections: [...state.collections, newCol]
    }));
  },

  // Add/Remove Game from Collection
  addGameToCollection: async (collectionId, gameId) => {
    // Check if already mapped
    const exists = get().collectionGames.some(cg => cg.collection_id === collectionId && cg.game_id === gameId);
    if (exists) return;

    if (hasElectron) {
      await window.electron.db.run("INSERT INTO collection_games (collection_id, game_id) VALUES (?, ?)", [collectionId, gameId]);
    }
    set(state => ({
      collectionGames: [...state.collectionGames, { collection_id: collectionId, game_id: gameId }]
    }));
  },

  removeGameFromCollection: async (collectionId, gameId) => {
    if (hasElectron) {
      await window.electron.db.run("DELETE FROM collection_games WHERE collection_id = ? AND game_id = ?", [collectionId, gameId]);
    }
    set(state => ({
      collectionGames: state.collectionGames.filter(cg => !(cg.collection_id === collectionId && cg.game_id === gameId))
    }));
  },

  // Update Settings
  updateSetting: async (key, value) => {
    if (hasElectron) {
      await window.electron.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }
    set(state => ({
      settings: { ...state.settings, [key]: value }
    }));
  },

  // Launch Game
  launchGame: async (gameId, exePath) => {
    if (hasElectron) {
      set({ activeGameId: gameId, activeSessionSeconds: 0 });
      const result = await window.electron.process.launchGame(gameId, exePath);
      return result;
    } else {
      // Mock launcher for browser testing
      set({ activeGameId: gameId, activeSessionSeconds: 0 });
      // Simulate live session increment
      const interval = setInterval(() => {
        set(state => {
          if (state.activeGameId !== gameId) {
            clearInterval(interval);
            return state;
          }
          return { activeSessionSeconds: state.activeSessionSeconds + 1 };
        });
      }, 1000);
      
      // Keep track of interval on window for easy browser mocking stop
      window.activeMockInterval = interval;
      return { success: true };
    }
  },

  // Force Stop monitoring/playing
  stopGame: async (gameId) => {
    if (hasElectron) {
      await window.electron.process.killGame(gameId);
    } else {
      if (window.activeMockInterval) {
        clearInterval(window.activeMockInterval);
      }
      
      const sessionSecs = get().activeSessionSeconds;
      const game = get().games.find(g => g.id === gameId);
      
      if (sessionSecs > 0 && game) {
        // Record mock session
        const start = new Date(Date.now() - sessionSecs * 1000).toISOString();
        const end = new Date().toISOString();
        
        set(state => ({
          sessions: [...state.sessions, {
            id: Date.now(),
            game_id: gameId,
            start_time: start,
            end_time: end,
            duration_seconds: sessionSecs,
            notes: 'Mock game session.'
          }],
          activeGameId: null,
          activeSessionSeconds: 0
        }));
      }
    }
  },

  // External updates from ipc notifications
  setActiveSessionTime: (seconds) => {
    set({ activeSessionSeconds: seconds });
  },

  setActiveGameId: (gameId) => {
    set({ activeGameId: gameId });
  }
}));
