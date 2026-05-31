import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/useGameStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Play, Square, Heart, Trash2, Clock, Edit3, Award, Plus, Save, ArrowLeft, Star, X, Check
} from 'lucide-react';

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { 
    games, sessions, achievements, toggleFavorite, deleteGame, updateGameDetails,
    addManualSession, updateSessionNote, toggleAchievement, addAchievement,
    launchGame, stopGame, activeGameId, activeSessionSeconds, fetchGameDetails
  } = useGameStore();

  const game = useMemo(() => games.find(g => g.id === id), [games, id]);

  useEffect(() => {
    if (id) {
      fetchGameDetails(id);
    }
  }, [id, fetchGameDetails]);
  
  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>Game not found.</p>
        <button onClick={() => navigate('/library')} className="vt-btn-primary cursor-pointer">Back to Library</button>
      </div>
    );
  }

  const isCurrentlyPlaying = activeGameId === game.id;

  const [activeTab, setActiveTab] = useState('sessions');
  const [manualHours, setManualHours] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddAchModal, setShowAddAchModal] = useState(false);
  const [newAchName, setNewAchName] = useState('');
  const [newAchDesc, setNewAchDesc] = useState('');
  const [newAchRarity, setNewAchRarity] = useState('Common');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [gameDescription, setGameDescription] = useState(game.description || '');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionNote, setEditingSessionNote] = useState('');

  // Sync state description when database load finishes
  useEffect(() => {
    if (game && game.description) {
      setGameDescription(game.description);
    }
  }, [game]);

  const gameSessions = useMemo(() => {
    return sessions.filter(s => s.game_id === game.id).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [sessions, game.id]);

  const gameAchievements = useMemo(() => achievements.filter(a => a.game_id === game.id), [achievements, game.id]);

  const totalPlaytimeSecs = useMemo(() => {
    const logged = gameSessions.reduce((acc, curr) => acc + curr.duration_seconds, 0);
    return isCurrentlyPlaying ? logged + activeSessionSeconds : logged;
  }, [gameSessions, isCurrentlyPlaying, activeSessionSeconds]);

  const totalPlaytimeHours = (totalPlaytimeSecs / 3600).toFixed(1);

  const chartData = useMemo(() => {
    const weeks = [];
    const today = new Date();
    for (let i = 7; i >= 0; i--) {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - (i * 7) - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      weeks.push({ start: startOfWeek, label: i === 0 ? 'This Week' : `Wk -${i}`, seconds: 0 });
    }
    gameSessions.forEach(s => {
      const sessionDate = new Date(s.start_time);
      weeks.forEach(w => {
        const nextWeekStart = new Date(w.start);
        nextWeekStart.setDate(w.start.getDate() + 7);
        if (sessionDate >= w.start && sessionDate < nextWeekStart) w.seconds += s.duration_seconds;
      });
    });
    if (isCurrentlyPlaying && weeks[7]) weeks[7].seconds += activeSessionSeconds;
    return weeks.map(w => ({ name: w.label, hours: parseFloat((w.seconds / 3600).toFixed(1)) }));
  }, [gameSessions, isCurrentlyPlaying, activeSessionSeconds]);

  const handleLaunch = () => launchGame(game.id, game.exe_path);
  const handleStop = () => stopGame(game.id);
  const handleUpdateStatus = (status) => updateGameDetails(game.id, { status });
  const handleUpdateRating = (rating) => updateGameDetails(game.id, { rating: parseInt(rating) });
  const handleDelete = () => { if (confirm(`Delete ${game.name}? All data will be lost.`)) { deleteGame(game.id); navigate('/library'); } };

  const handleAddManualSession = (e) => {
    e.preventDefault();
    if (!manualHours || isNaN(manualHours) || parseFloat(manualHours) <= 0) return;
    addManualSession(game.id, parseFloat(manualHours), manualNote, manualDate);
    setManualHours(''); setManualNote('');
  };

  const handleSaveNotes = () => { updateGameDetails(game.id, { description: gameDescription }); setIsEditingNotes(false); };
  const handleStartEditSessionNote = (s) => { setEditingSessionId(s.id); setEditingSessionNote(s.notes || ''); };
  const handleSaveSessionNote = (sId) => { updateSessionNote(sId, editingSessionNote); setEditingSessionId(null); };

  const handleCreateAchievement = (e) => {
    e.preventDefault();
    if (!newAchName.trim()) return;
    addAchievement(game.id, newAchName, newAchDesc, newAchRarity);
    setNewAchName(''); setNewAchDesc(''); setNewAchRarity('Common'); setShowAddAchModal(false);
  };

  const getRarityStyle = (rarity) => {
    switch (rarity) {
      case 'Legendary': return { background: 'rgba(184,146,62,0.1)', color: '#b8923e', border: '1px solid rgba(184,146,62,0.2)' };
      case 'Epic': return { background: 'var(--accent-secondary-soft)', color: 'var(--accent-secondary)', border: '1px solid transparent' };
      case 'Rare': return { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid transparent' };
      default: return { background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid transparent' };
    }
  };

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hrs.toString().padStart(2, '0'), mins.toString().padStart(2, '0'), secs.toString().padStart(2, '0')].join(':');
  };

  return (
    <div className="flex flex-col select-none -mx-14 -mt-12">
      {/* Hero Header */}
      <div className="relative h-[260px] w-full overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-cover bg-center scale-110 opacity-20" style={{ backgroundImage: `url(${game.cover_art})`, filter: 'blur(20px)' }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, var(--bg-base), transparent)` }} />

        <div className="absolute inset-0 flex items-end px-14 pb-8 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-end gap-6 w-full">
            <div className="w-28 h-36 md:w-32 md:h-44 rounded-xl overflow-hidden shrink-0" style={{ border: '1px solid var(--border-strong)' }}>
              <img src={game.cover_art} alt={game.name} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <button onClick={() => navigate('/library')} className="vt-btn-ghost text-[13px] mb-2 cursor-pointer" style={{ color: 'var(--accent)', padding: 0 }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Library
              </button>
              <h1 className="vt-page-title truncate" style={{ fontSize: 32 }}>{game.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-secondary)', fontWeight: 500 }}>{game.developer}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span>{game.genre}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span className="vt-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {totalPlaytimeHours} hrs
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 mt-4 md:mt-0">
              <button onClick={() => toggleFavorite(game.id)}
                className="p-3 rounded-lg transition-colors cursor-pointer"
                style={{ background: game.is_favorite ? 'var(--accent-soft)' : 'var(--bg-surface)', color: game.is_favorite ? 'var(--accent)' : 'var(--text-tertiary)', border: '1px solid var(--border)' }}
                title={game.is_favorite ? 'Remove Favorite' : 'Add Favorite'}
              >
                <Heart className={`w-5 h-5 ${game.is_favorite ? 'fill-current' : ''}`} />
              </button>
              {isCurrentlyPlaying ? (
                <button onClick={handleStop} className="vt-btn-danger h-10 px-6 cursor-pointer">
                  <Square className="w-4 h-4" /> Stop
                </button>
              ) : (
                <button onClick={handleLaunch} className="vt-btn-primary h-10 px-6 cursor-pointer">
                  <Play className="w-4 h-4" /> Launch
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-14 py-8 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Tabs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'sessions', label: 'Sessions' },
              { id: 'achievements', label: 'Achievements' },
              { id: 'notes', label: 'Notes' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-[13px] cursor-pointer transition-colors"
                style={{
                  fontWeight: activeTab === tab.id ? 500 : 400,
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="flex flex-col gap-6">
              <form onSubmit={handleAddManualSession} className="vt-card p-4 flex flex-col gap-3">
                <h4 className="vt-section-header text-[11px]">Log Session</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Hours</label>
                    <input type="text" placeholder="e.g. 2.5" value={manualHours} onChange={e => setManualHours(e.target.value)} className="vt-input" />
                  </div>
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Date</label>
                    <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="vt-input" />
                  </div>
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Note</label>
                    <input type="text" placeholder="What happened?" value={manualNote} onChange={e => setManualNote(e.target.value)} className="vt-input" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="vt-btn-secondary cursor-pointer text-[13px]">
                    <Plus className="w-3.5 h-3.5" /> Add Session
                  </button>
                </div>
              </form>

              <div className="vt-card overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 text-[11px] vt-section-header" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                  <span className="col-span-3">Date</span>
                  <span className="col-span-2">Duration</span>
                  <span className="col-span-6">Notes</span>
                  <span className="col-span-1 text-right">Edit</span>
                </div>
                {gameSessions.length === 0 ? (
                  <div className="p-8 text-center text-[13px]" style={{ color: 'var(--text-secondary)' }}>No sessions recorded yet.</div>
                ) : (
                  <div className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                    {gameSessions.map(s => {
                      const dateStr = new Date(s.start_time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      const durationStr = s.duration_seconds < 3600 ? `${Math.round(s.duration_seconds / 60)} min` : `${(s.duration_seconds / 3600).toFixed(1)} hrs`;
                      const isEditing = editingSessionId === s.id;
                      return (
                        <div key={s.id} className="grid grid-cols-12 px-4 py-3 items-center text-[13px] transition-colors"
                          style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span className="col-span-3 vt-mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{dateStr}</span>
                          <span className="col-span-2 vt-mono" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{durationStr}</span>
                          <div className="col-span-6 pr-4">
                            {isEditing ? (
                              <input type="text" value={editingSessionNote} onChange={e => setEditingSessionNote(e.target.value)} className="vt-input h-8 text-[13px]" autoFocus />
                            ) : (
                              <p className="truncate" style={{ color: 'var(--text-secondary)' }}>{s.notes || 'No notes.'}</p>
                            )}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {isEditing ? (
                              <button onClick={() => handleSaveSessionNote(s.id)} className="p-1 cursor-pointer" style={{ color: 'var(--success)' }} title="Save">
                                <Save className="w-4 h-4" />
                              </button>
                            ) : (
                              <button onClick={() => handleStartEditSessionNote(s)} className="p-1 cursor-pointer" style={{ color: 'var(--text-tertiary)' }} title="Edit Note">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Achievements Tab */}
          {activeTab === 'achievements' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center vt-card p-3">
                <div>
                  <h4 className="text-[13px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Achievements</h4>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {gameAchievements.filter(a => a.unlocked === 1).length} / {gameAchievements.length} unlocked
                  </p>
                </div>
                <button onClick={() => setShowAddAchModal(true)} className="vt-btn-secondary cursor-pointer text-[13px]">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {gameAchievements.map(ach => (
                  <div key={ach.id} className="vt-card p-3 flex items-center justify-between gap-3"
                    style={ach.unlocked ? { borderColor: 'var(--success)', borderWidth: 1 } : {}}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button onClick={() => toggleAchievement(ach.id, ach.unlocked === 1 ? 0 : 1)}
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
                        style={{ background: ach.unlocked ? 'var(--success)' : 'var(--bg-base)', border: ach.unlocked ? 'none' : '1px solid var(--border-strong)' }}
                        title={ach.unlocked ? 'Mark as locked' : 'Mark as unlocked'}
                      >
                        {ach.unlocked === 1 && <Check className="w-3.5 h-3.5" style={{ color: '#fefefe' }} />}
                      </button>
                      <div className="min-w-0">
                        <h4 className="text-[13px] truncate" style={{ fontWeight: 500, color: ach.unlocked ? 'var(--success)' : 'var(--text-primary)' }}>{ach.name}</h4>
                        <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{ach.description || 'No description.'}</p>
                        {ach.unlocked === 1 && ach.unlocked_date && (
                          <p className="vt-mono text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Unlocked {new Date(ach.unlocked_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <span className="vt-badge text-[11px] shrink-0" style={getRarityStyle(ach.rarity)}>{ach.rarity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="vt-card p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h4 className="vt-section-header text-[11px]">Journal</h4>
                {isEditingNotes ? (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingNotes(false)} className="vt-btn-ghost cursor-pointer text-[13px]">Cancel</button>
                    <button onClick={handleSaveNotes} className="vt-btn-primary cursor-pointer text-[13px]"><Save className="w-3.5 h-3.5" /> Save</button>
                  </div>
                ) : (
                  <button onClick={() => { setGameDescription(game.description || ''); setIsEditingNotes(true); }} className="vt-btn-secondary cursor-pointer text-[13px]">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
              {isEditingNotes ? (
                <textarea value={gameDescription} onChange={e => setGameDescription(e.target.value)} rows={8} placeholder="Record your thoughts, progress, and notes..." className="vt-textarea" />
              ) : (
                <div className="p-4 rounded-lg min-h-[160px] text-[14px] whitespace-pre-wrap" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  {game.description || 'No notes yet. Click Edit to start writing.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* Controls */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <h3 className="vt-section-header text-[11px]">Details</h3>
            <div>
              <label className="vt-section-header text-[11px] block mb-1">Status</label>
              <select value={game.status} onChange={e => handleUpdateStatus(e.target.value)} className="vt-select">
                {['Installed','Playing','Completed','On Hold','Dropped','Plan to Play'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="vt-section-header text-[11px] block mb-1">Rating</label>
              <div className="flex items-center gap-3">
                <select value={game.rating || 0} onChange={e => handleUpdateRating(e.target.value)} className="vt-select flex-1">
                  <option value={0}>Unrated</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(r => <option key={r} value={r}>{r} / 10</option>)}
                </select>
                {game.rating > 0 && (
                  <div className="flex items-center gap-1 shrink-0" style={{ color: 'var(--accent)' }}>
                    <Star className="w-4 h-4 fill-current" />
                    <span className="vt-mono text-[13px]" style={{ fontWeight: 500 }}>{game.rating}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border)', marginTop: 4 }} />
            <button onClick={handleDelete} className="vt-btn-danger w-full cursor-pointer">
              <Trash2 className="w-4 h-4" /> Remove Game
            </button>
          </div>

          {/* Chart */}
          <div className="vt-card p-5 flex flex-col gap-3 h-[250px]">
            <h3 className="vt-section-header text-[11px]">Weekly Playtime</h3>
            <div className="flex-1 w-full text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--text-tertiary)" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} tickFormatter={val => `${val}h`} style={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-ui)' }}
                    labelStyle={{ color: 'var(--accent)', fontWeight: 500 }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={val => [`${val} hrs`, 'Playtime']}
                  />
                  <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Session */}
          {isCurrentlyPlaying && (
            <div className="vt-card p-5 flex flex-col items-center gap-2" style={{ borderColor: 'var(--accent)' }}>
              <span className="vt-section-header text-[11px]">Active Session</span>
              <span className="vt-mono text-3xl" style={{ color: 'var(--accent)', fontWeight: 500 }}>{formatTime(activeSessionSeconds)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Achievement Modal */}
      {showAddAchModal && (
        <div className="vt-modal-backdrop">
          <form onSubmit={handleCreateAchievement} className="vt-modal w-full max-w-sm">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-[15px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Add Achievement</h3>
              <button type="button" onClick={() => setShowAddAchModal(false)} className="p-1 cursor-pointer" style={{ color: 'var(--text-tertiary)' }} title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="vt-section-header text-[11px] block mb-1">Name</label>
                <input type="text" required placeholder="e.g. Master Explorer" value={newAchName} onChange={e => setNewAchName(e.target.value)} className="vt-input" />
              </div>
              <div>
                <label className="vt-section-header text-[11px] block mb-1">Description</label>
                <input type="text" placeholder="How to unlock" value={newAchDesc} onChange={e => setNewAchDesc(e.target.value)} className="vt-input" />
              </div>
              <div>
                <label className="vt-section-header text-[11px] block mb-1">Rarity</label>
                <select value={newAchRarity} onChange={e => setNewAchRarity(e.target.value)} className="vt-select">
                  {['Common','Rare','Epic','Legendary'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setShowAddAchModal(false)} className="vt-btn-ghost cursor-pointer">Cancel</button>
                <button type="submit" className="vt-btn-primary cursor-pointer">Add</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
