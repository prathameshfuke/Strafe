import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGameStore } from '../stores/useGameStore';
import { useVirtualizer } from '@tanstack/react-virtual';
import GameImage from '../components/GameImage';
import { 
  Search, 
  Grid, 
  List, 
  Filter, 
  Plus, 
  Play, 
  Heart, 
  Trash2, 
  Check, 
  Loader2,
  FileSearch,
  UploadCloud,
  X
} from 'lucide-react';

const cleanGameName = (rawName) => {
  let name = rawName;

  // Step 1: Remove file extension
  name = name.replace(/\.(exe|bat|cmd|lnk)$/i, '');

  // Step 2: Remove common engine/build suffixes (no leading dashes)
  const buildSuffixes = [
    'Win64', 'Win32', 'x64', 'x86',
    'Shipping', 'Release', 'Final', 'Launch',
    'Game', 'Client', 'Launcher', 'Desktop',
    'DX11', 'DX12', 'Vulkan',
    'UWP', 'EGS', 'Steam', 'GOG',
    '_BE',
    'Win64-Shipping',
  ];
  buildSuffixes.forEach(suffix => {
    name = name.replace(new RegExp(`[\\s._-]?${suffix}`, 'gi'), '');
  });

  // Step 3: Split CamelCase into separate words
  name = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Step 4: Split digits from letters
  name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)([a-zA-Z])/g, '$1 $2');

  // Step 5: Replace separators with spaces
  name = name.replace(/[._\-]+/g, ' ');

  // Step 6: Known abbreviation expansions
  const expansions = {
    'Lot\\s*DK': 'Lord of the Dark Knight',
    'Lot\\s*R': 'Lord of the Rings',
    'Go\\s*T': 'Game of Thrones',
    'GTA': 'Grand Theft Auto',
    'RDR': 'Red Dead Redemption',
    'AC': 'Assassins Creed',
    'BF': 'Battlefield',
    'CoD': 'Call of Duty',
    'MW': 'Modern Warfare',
    'TW': 'The Witcher',
    'DS': 'Dark Souls',
    'FF': 'Final Fantasy',
  };
  Object.entries(expansions).forEach(([abbr, full]) => {
    name = name.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
  });

  // Step 7: Clean extra whitespace
  name = name.replace(/\s+/g, ' ').trim();

  return name;
};

export default function Library() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryCollection = searchParams.get('collection');

  const { 
    games, sessions, collections, collectionGames,
    addGame, deleteGame, toggleFavorite, updateGameDetails,
    launchGame, stopGame, activeGameId, settings
  } = useGameStore();

  // --- UI State ---
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCollection, setSelectedCollection] = useState(queryCollection || 'all');
  const [sortBy, setSortBy] = useState('name');
  
  const [batchMode, setBatchMode] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState([]);

  // Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [exePath, setExePath] = useState('');
  const [gameName, setGameName] = useState('');
  const [metadataList, setMetadataList] = useState([]);
  const [selectedMetadata, setSelectedMetadata] = useState(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [manualCoverArt, setManualCoverArt] = useState('');
  const [manualGenre, setManualGenre] = useState('');
  const [manualDeveloper, setManualDeveloper] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // --- Computed ---
  const gamePlaytimes = useMemo(() => {
    const playtimes = {};
    sessions.forEach(s => { playtimes[s.game_id] = (playtimes[s.game_id] || 0) + s.duration_seconds; });
    return playtimes;
  }, [sessions]);

  const gameLastPlayed = useMemo(() => {
    const lastPlayed = {};
    sessions.forEach(s => {
      const existing = lastPlayed[s.game_id];
      if (!existing || new Date(s.start_time) > new Date(existing)) {
        lastPlayed[s.game_id] = s.start_time;
      }
    });
    return lastPlayed;
  }, [sessions]);

  const allGenres = useMemo(() => {
    const genres = new Set();
    games.forEach(g => { if (g.genre) g.genre.split(',').forEach(genre => genres.add(genre.trim())); });
    return Array.from(genres);
  }, [games]);

  const filteredGames = useMemo(() => {
    let result = [...games];
    if (searchQuery.trim()) result = result.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (selectedGenre !== 'all') result = result.filter(g => g.genre && g.genre.toLowerCase().includes(selectedGenre.toLowerCase()));
    if (selectedStatus !== 'all') result = result.filter(g => g.status === selectedStatus);
    if (selectedCollection !== 'all') {
      const ids = collectionGames.filter(cg => cg.collection_id === selectedCollection).map(cg => cg.game_id);
      result = result.filter(g => ids.includes(g.id));
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'playtime') return (gamePlaytimes[b.id] || 0) - (gamePlaytimes[a.id] || 0);
      if (sortBy === 'last_played') return new Date(gameLastPlayed[b.id] || 0) - new Date(gameLastPlayed[a.id] || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'date_added') return new Date(b.date_added) - new Date(a.date_added);
      return 0;
    });
    return result;
  }, [games, searchQuery, selectedGenre, selectedStatus, selectedCollection, collectionGames, sortBy, gamePlaytimes, gameLastPlayed]);

  const parentRef = useRef(null);
  const CARD_HEIGHT = 280;
  const COLUMNS = 5;

  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < filteredGames.length; i += COLUMNS) {
      r.push(filteredGames.slice(i, i + COLUMNS));
    }
    return r;
  }, [filteredGames]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + 16,
    overscan: 2,
  });

  // --- Wizard Functions ---
  const handleSelectExe = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      const path = await window.electron.system.selectExe();
      if (path) {
        setExePath(path);
        const filename = path.split('\\').pop();
        const cleanedName = cleanGameName(filename);
        setGameName(cleanedName);
        setWizardStep(2);
        searchRAWGMetadata(filename);
      }
    } else {
      setExePath('C:\\MockGames\\Cyberpunk2077\\Cyberpunk2077.exe');
      setGameName('Cyberpunk 2077');
      setWizardStep(2);
      searchRAWGMetadata('Cyberpunk2077.exe');
    }
  };

  const searchGameWithFallbacks = async (rawExeName, apiKey) => {
    const cleaned = cleanGameName(rawExeName);
    
    // Generate multiple search attempts, from most to least specific
    const searchAttempts = [
      cleaned,
      cleaned.split(' ').slice(0, 4).join(' '),
      cleaned.split(' ').slice(0, 3).join(' '),
      cleaned.split(' ').slice(0, 2).join(' '),
      cleaned.split(' ')[0],
    ];

    for (const attempt of searchAttempts) {
      if (!attempt || attempt.length < 2) continue;

      try {
        const res = await fetch(
          `https://api.rawg.io/api/games?search=${encodeURIComponent(attempt)}&key=${apiKey}&page_size=6`
        );
        const data = await res.json();

        if (data.results && data.results.length > 0) {
          console.log(`RAWG matched "${attempt}" → ${data.results[0].name}`);
          return data.results;
        }
      } catch (e) {
        console.warn(`RAWG fetch error for "${attempt}":`, e);
      }
    }

    // Final fallback: Steam store search via Electron main process to avoid CORS
    if (typeof window !== 'undefined' && window.electron && window.electron.system.steamSearch) {
      try {
        const steamData = await window.electron.system.steamSearch(cleaned);
        if (steamData && steamData.items && steamData.items.length > 0) {
          return steamData.items.map(item => ({
            id: item.id,
            name: item.name,
            background_image: `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/library_600x900.jpg`,
            genres: [{ name: 'Steam Game' }],
            released: null,
            steam_app_id: item.id
          }));
        }
      } catch (e) {
        console.warn("Steam fallback error:", e);
      }
    }

    return [];
  };

  const searchRAWGMetadata = async (name) => {
    setLoadingMetadata(true);
    setMetadataList([]);
    const rawgKey = settings.rawg_api_key || 'c537d92ffbf04a3e9d8cb404e8d35f79';
    try {
      const results = await searchGameWithFallbacks(name, rawgKey);
      if (results && results.length > 0) {
        setMetadataList(results);
        setSelectedMetadata(results[0]);
        populateMetadataDetails(results[0]);
      } else {
        setSelectedMetadata(null);
      }
    } catch {
      setSelectedMetadata(null);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const populateMetadataDetails = (meta) => {
    setGameName(meta.name);
    setManualCoverArt(meta.background_image || '');
    setManualGenre(meta.genres ? meta.genres.map(g => g.name).join(', ') : 'Action');
    setManualDeveloper('Various Developers');
    setManualDescription(`${meta.name} fetched from catalog database.`);
  };

  const handleSelectMetadata = (meta) => { setSelectedMetadata(meta); populateMetadataDetails(meta); };

  const handleSaveGame = async () => {
    let coverArt = manualCoverArt;
    let genre = manualGenre;
    let developer = manualDeveloper;
    let description = manualDescription;
    let rawgId = selectedMetadata ? selectedMetadata.id : null;

    if (!coverArt && gameName) {
      const rawgKey = settings.rawg_api_key || 'c537d92ffbf04a3e9d8cb404e8d35f79';
      try {
        const results = await searchGameWithFallbacks(gameName, rawgKey);
        if (results && results.length > 0) {
          const meta = results[0];
          coverArt = meta.background_image || '';
          rawgId = meta.id;
          if (!genre) genre = meta.genres ? meta.genres.map(g => g.name).join(', ') : 'Action';
          if (!description) description = `${meta.name} fetched from catalog database.`;
        }
      } catch (e) {
        console.warn("Background fetch during save failed:", e);
      }
    }

    addGame({ name: gameName, exe_path: exePath, cover_art: coverArt, genre: genre || 'Action', developer: developer || 'Unknown', description: description || '', rawg_id: rawgId });
    setShowWizard(false); 
    setWizardStep(1); 
    setExePath(''); 
    setGameName(''); 
    setMetadataList([]); 
    setSelectedMetadata(null); 
    setManualCoverArt(''); 
    setManualGenre('');
    setManualDeveloper('');
    setManualDescription('');
  };

  // --- Drag & Drop ---
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.path && file.path.toLowerCase().endsWith('.exe')) {
      setExePath(file.path);
      const filename = file.name;
      const cleanedName = cleanGameName(filename);
      setGameName(cleanedName); setShowWizard(true); setWizardStep(2);
      searchRAWGMetadata(filename);
    }
  };

  // --- Batch ---
  const handleToggleSelectGame = (gameId) => { setSelectedGameIds(prev => prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]); };
  const handleBatchFavorite = () => { selectedGameIds.forEach(id => { const g = games.find(game => game.id === id); if (g && !g.is_favorite) toggleFavorite(id); }); setSelectedGameIds([]); setBatchMode(false); };
  const handleBatchCompleted = () => { selectedGameIds.forEach(id => updateGameDetails(id, { status: 'Completed' })); setSelectedGameIds([]); setBatchMode(false); };
  const handleBatchDelete = () => { if (confirm(`Remove ${selectedGameIds.length} games?`)) { selectedGameIds.forEach(id => deleteGame(id)); setSelectedGameIds([]); setBatchMode(false); } };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed': return 'vt-badge vt-badge-completed';
      case 'Playing': return 'vt-badge vt-badge-playing';
      case 'Plan to Play': return 'vt-badge vt-badge-plan';
      default: return 'vt-badge vt-badge-default';
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none h-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none" style={{ background: 'rgba(26,22,18,0.85)' }}>
          <div className="text-center flex flex-col items-center gap-4 p-12 rounded-2xl" style={{ border: '3px dashed var(--accent)' }}>
            <UploadCloud className="w-14 h-14" style={{ color: 'var(--accent)' }} />
            <h2 className="text-xl" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-primary)' }}>
              Drop to Add Game
            </h2>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Release the .exe file to begin indexing.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="vt-page-title">Library</h1>
          <p className="text-[15px] mt-1" style={{ color: 'var(--text-secondary)' }}>{filteredGames.length} games in collection</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setBatchMode(!batchMode); setSelectedGameIds([]); }} className={`vt-btn-ghost text-[13px] cursor-pointer`} style={batchMode ? { background: 'var(--accent-secondary-soft)', color: 'var(--accent-secondary)' } : {}}>
            {batchMode ? 'Cancel' : 'Select'}
          </button>
          <button onClick={() => setShowWizard(true)} className="vt-btn-primary cursor-pointer">
            <Plus className="w-4 h-4" /> Add Game
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input type="text" placeholder="Search games..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="vt-input pl-10" />
        </div>
        <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="vt-select">
          <option value="all">All Genres</option>
          {allGenres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="vt-select">
          <option value="all">All Statuses</option>
          {['Installed','Playing','Completed','On Hold','Dropped','Plan to Play'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className="vt-select">
          <option value="all">All Collections</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Sort + View Toggle */}
      <div className="flex justify-between items-center text-[13px]">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
          <span>Sort:</span>
          {['name', 'playtime', 'last_played', 'rating', 'date_added'].map(type => (
            <button key={type} onClick={() => setSortBy(type)}
              className="capitalize cursor-pointer transition-colors px-1"
              style={{ color: sortBy === type ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: sortBy === type ? 500 : 400 }}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <button onClick={() => setViewMode('grid')} className="p-1.5 rounded cursor-pointer" style={{ background: viewMode === 'grid' ? 'var(--accent-soft)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-tertiary)' }} title="Grid View">
            <Grid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')} className="p-1.5 rounded cursor-pointer" style={{ background: viewMode === 'list' ? 'var(--accent-soft)' : 'transparent', color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-tertiary)' }} title="List View">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Game Views */}
      {filteredGames.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 vt-card">
          <FileSearch className="w-12 h-12 mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-[15px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>No games found</h3>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Try adjusting your filters or add a new game.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div ref={parentRef} className="custom-scrollbar" style={{ height: 'calc(100vh - 220px)', overflow: 'auto' }}>
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const rowItems = rows[virtualRow.index];
              if (!rowItems) return null;
              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: virtualRow.start,
                    left: 0,
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 16,
                    paddingBottom: 16,
                  }}
                >
                  {rowItems.map(game => {
                    const isCurrentlyPlaying = activeGameId === game.id;
                    const hours = ((gamePlaytimes[game.id] || 0) / 3600).toFixed(1);
                    const isSelected = selectedGameIds.includes(game.id);
                    return (
                      <div key={game.id}
                        onClick={() => { if (batchMode) handleToggleSelectGame(game.id); else navigate(`/game/${game.id}`); }}
                        className={`vt-card overflow-hidden cursor-pointer ${!batchMode ? 'vt-card-hover' : ''}`}
                        style={isSelected ? { borderColor: 'var(--accent-secondary)', background: 'var(--accent-secondary-soft)' } : {}}
                      >
                        <div className="relative aspect-[3/4] overflow-hidden" style={{ borderRadius: '10px 10px 0 0' }}>
                          <GameImage src={game.cover_art} alt={game.name} className="w-full h-full object-cover" />
                          <div className="vt-cover-shadow absolute inset-0" />
                          {batchMode && (
                            <div className="absolute top-2 left-2 z-20">
                              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: isSelected ? 'var(--accent-secondary)' : 'rgba(0,0,0,0.4)', border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.3)' }}>
                                {isSelected && <Check className="w-3.5 h-3.5" style={{ color: '#fefefe' }} />}
                              </div>
                            </div>
                          )}
                          {/* Status pill */}
                          <div className="absolute bottom-2 right-2">
                            <span className={getStatusBadge(game.status)} style={{ fontSize: '11px' }}>{game.status}</span>
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="text-[15px] truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{game.name}</h3>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(game.id); }} className="shrink-0 cursor-pointer" style={{ color: game.is_favorite ? 'var(--accent)' : 'var(--text-tertiary)' }} title={game.is_favorite ? 'Remove favorite' : 'Add to favorites'}>
                              <Heart className={`w-4 h-4 ${game.is_favorite ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                          <p className="vt-mono text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{hours} hrs</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-12 px-4 py-2 text-[12px] vt-section-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="col-span-5">Title</span>
            <span className="col-span-2">Genre</span>
            <span className="col-span-1">Status</span>
            <span className="col-span-1 text-center">Rating</span>
            <span className="col-span-2 text-right">Playtime</span>
            <span className="col-span-1 text-right">Action</span>
          </div>
          {filteredGames.map(game => {
            const isCurrentlyPlaying = activeGameId === game.id;
            const hours = ((gamePlaytimes[game.id] || 0) / 3600).toFixed(1);
            const isSelected = selectedGameIds.includes(game.id);
            return (
              <div key={game.id}
                onClick={() => { if (batchMode) handleToggleSelectGame(game.id); else navigate(`/game/${game.id}`); }}
                className="grid grid-cols-12 items-center px-4 py-3 rounded-lg cursor-pointer transition-colors"
                style={{ background: isSelected ? 'var(--accent-secondary-soft)' : 'transparent', border: '1px solid transparent', borderColor: isSelected ? 'var(--accent-secondary)' : 'transparent' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  {batchMode && (
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: isSelected ? 'var(--accent-secondary)' : 'var(--bg-base)', border: isSelected ? 'none' : '1px solid var(--border-strong)' }}>
                      {isSelected && <Check className="w-3 h-3" style={{ color: '#fefefe' }} />}
                    </div>
                  )}
                  <GameImage src={game.cover_art} alt={game.name} className="w-7 h-9 object-cover rounded shrink-0" style={{ border: '1px solid var(--border)' }} />
                  <div className="min-w-0">
                    <h3 className="text-[13px] truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{game.name}</h3>
                    <p className="vt-mono text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{game.exe_path}</p>
                  </div>
                </div>
                <span className="col-span-2 text-[13px] truncate" style={{ color: 'var(--text-secondary)' }}>{game.genre}</span>
                <div className="col-span-1"><span className={getStatusBadge(game.status)} style={{ fontSize: '11px' }}>{game.status}</span></div>
                <div className="col-span-1 text-center vt-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>{game.rating ? `${game.rating}/10` : '—'}</div>
                <div className="col-span-2 text-right vt-mono text-[13px]" style={{ color: 'var(--text-secondary)' }}>{hours} hrs</div>
                <div className="col-span-1 flex items-center justify-end" onClick={e => e.stopPropagation()}>
                  {isCurrentlyPlaying ? (
                    <button onClick={() => stopGame(game.id)} className="vt-btn-danger h-8 px-2 cursor-pointer text-[12px]" title="Stop Game"><span className="w-3 h-3 rounded-sm" style={{ background: 'currentColor' }} /></button>
                  ) : (
                    <button onClick={() => launchGame(game.id, game.exe_path)} className="vt-btn-primary h-8 px-2 cursor-pointer text-[12px]" title="Launch Game"><Play className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Action Bar */}
      {batchMode && selectedGameIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 500, color: 'var(--accent-secondary)' }}>{selectedGameIds.length}</span> selected
          </span>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <button onClick={handleBatchFavorite} className="vt-btn-ghost text-[13px] cursor-pointer"><Heart className="w-3.5 h-3.5" /> Favorite</button>
          <button onClick={handleBatchCompleted} className="vt-btn-ghost text-[13px] cursor-pointer"><Check className="w-3.5 h-3.5" /> Complete</button>
          <button onClick={handleBatchDelete} className="vt-btn-danger text-[13px] cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
        </div>
      )}

      {/* Add Game Wizard Modal */}
      {showWizard && (
        <div className="vt-modal-backdrop select-none">
          <div className="vt-modal w-full max-w-lg">
            <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-[15px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Add Game</h2>
              <button onClick={() => { setShowWizard(false); setWizardStep(1); }} className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-tertiary)' }} title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              {/* Step Indicator */}
              <div className="flex items-center gap-2 text-[12px] pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                {['Select File', 'Find Metadata', 'Confirm'].map((label, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />}
                    <span style={{ color: wizardStep >= i + 1 ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: wizardStep >= i + 1 ? 500 : 400 }}>
                      {i + 1}. {label}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {wizardStep === 1 && (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
                  <div className="p-4 rounded-2xl" style={{ background: 'var(--accent-soft)' }}>
                    <UploadCloud className="w-10 h-10" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <h3 className="text-[15px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Select Game Executable</h3>
                    <p className="text-[13px] mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>Browse for a .exe file or drag and drop it onto the library page.</p>
                  </div>
                  <button onClick={handleSelectExe} className="vt-btn-primary mt-2 cursor-pointer">Browse Files</button>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Game Name</label>
                    <div className="flex gap-2">
                      <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)} className="vt-input flex-1" />
                      <button onClick={() => searchRAWGMetadata(gameName)} className="vt-btn-secondary cursor-pointer">Search</button>
                    </div>
                  </div>
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Search Results</label>
                    {loadingMetadata ? (
                      <div className="flex items-center justify-center p-6 gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="text-[13px]">Searching...</span>
                      </div>
                    ) : metadataList.length === 0 ? (
                      <div className="p-4 rounded-lg text-center text-[13px]" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
                        No matches found. Continue to enter details manually.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {metadataList.map(meta => (
                          <div key={meta.id} onClick={() => handleSelectMetadata(meta)}
                            className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                            style={{ background: selectedMetadata?.id === meta.id ? 'var(--accent-soft)' : 'var(--bg-base)', border: `1px solid ${selectedMetadata?.id === meta.id ? 'var(--accent)' : 'var(--border)'}` }}
                          >
                            <img src={meta.background_image} alt={meta.name} className="w-8 h-10 object-cover rounded shrink-0" style={{ border: '1px solid var(--border)' }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-[13px] truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{meta.name}</p>
                                {meta.released && (
                                  <span className="text-[11px] shrink-0 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                                    {meta.released.split('-')[0]}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{meta.genres?.map(g => g.name).join(', ')}</p>
                            </div>
                          </div>
                        ))}

                        {/* None of these Option */}
                        <div onClick={() => {
                          setSelectedMetadata(null);
                          setManualCoverArt('');
                          setManualGenre('');
                          setManualDeveloper('');
                          setManualDescription('');
                          setWizardStep(3);
                        }}
                          className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                        >
                          <div className="w-8 h-10 flex items-center justify-center bg-[var(--bg-hover)] rounded shrink-0 border border-[var(--border)]">
                            <X className="w-4 h-4 text-[var(--text-secondary)]" />
                          </div>
                          <div>
                            <p className="text-[13px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>None of these / Manual Entry</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Skip match and enter details manually</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => setWizardStep(1)} className="vt-btn-ghost cursor-pointer">Back</button>
                    <button onClick={() => setWizardStep(3)} className="vt-btn-primary cursor-pointer">Next</button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4">
                    <div className="shrink-0 w-24">
                      <label className="vt-section-header text-[11px] block mb-1">Cover</label>
                      <div className="aspect-[3/4] w-24 rounded-lg overflow-hidden" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                        {manualCoverArt ? <img src={manualCoverArt} alt="Cover" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No Image</div>}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <div>
                        <label className="vt-section-header text-[11px] block mb-1">Title</label>
                        <div className="flex gap-2">
                          <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)} className="vt-input flex-1" />
                          <button 
                            type="button"
                            onClick={async () => {
                              if (!gameName) return;
                              const rawgKey = settings.rawg_api_key || 'c537d92ffbf04a3e9d8cb404e8d35f79';
                              try {
                                const results = await searchGameWithFallbacks(gameName, rawgKey);
                                if (results && results.length > 0) {
                                  const meta = results[0];
                                  setManualCoverArt(meta.background_image || '');
                                  if (!manualGenre) setManualGenre(meta.genres ? meta.genres.map(g => g.name).join(', ') : 'Action');
                                  if (!manualDescription) setManualDescription(`${meta.name} fetched from catalog database.`);
                                }
                              } catch (e) {
                                console.warn(e);
                              }
                            }} 
                            className="vt-btn-secondary px-3 text-[12px] cursor-pointer"
                          >
                            Fetch Details
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="vt-section-header text-[11px] block mb-1">Genre</label>
                        <input type="text" value={manualGenre} onChange={(e) => setManualGenre(e.target.value)} placeholder="RPG, Action" className="vt-input" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="vt-section-header text-[11px] block mb-1">Developer</label>
                      <input type="text" value={manualDeveloper} onChange={(e) => setManualDeveloper(e.target.value)} className="vt-input" />
                    </div>
                    <div>
                      <label className="vt-section-header text-[11px] block mb-1">Cover URL</label>
                      <input type="text" value={manualCoverArt} onChange={(e) => setManualCoverArt(e.target.value)} className="vt-input" />
                    </div>
                  </div>
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Description</label>
                    <textarea value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} rows={2} className="vt-textarea" />
                  </div>
                  <div className="p-2.5 rounded-lg vt-mono text-[12px]" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    {exePath}
                  </div>
                  <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => setWizardStep(2)} className="vt-btn-ghost cursor-pointer">Back</button>
                    <button onClick={handleSaveGame} className="vt-btn-primary cursor-pointer">Add Game</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
