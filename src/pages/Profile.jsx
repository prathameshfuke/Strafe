import React, { useState, useMemo } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { User, Upload, Save, Share2, Flame, Gamepad2, Clock, Award, CornerRightDown } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function Profile() {
  const { games, sessions, achievements, profile, updateProfile, updateProfileStatus, activeGameId } = useGameStore();

  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatar, setAvatar] = useState(profile.avatar_path || '');
  const [age, setAge] = useState(profile.age || '');
  const [favGenre, setFavGenre] = useState(profile.favorite_genre || '');
  const [isEditing, setIsEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customStatus, setCustomStatus] = useState(profile.status_text || '');
  const [statusType, setStatusType] = useState(profile.status_type || 'Online');

  const totalPlaytimeSecs = useMemo(() => sessions.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0), [sessions]);
  const totalPlaytimeHours = (totalPlaytimeSecs / 3600).toFixed(1);
  const totalAchievementsUnlocked = useMemo(() => achievements.filter(a => a.unlocked === 1).length, [achievements]);

  const favoriteGenre = useMemo(() => {
    if (games.length === 0) return 'None';
    const counts = {};
    games.forEach(g => { if (g.genre) g.genre.split(',').forEach(genre => { const c = genre.trim(); counts[c] = (counts[c] || 0) + 1; }); });
    let maxGenre = 'None', maxVal = 0;
    Object.entries(counts).forEach(([genre, count]) => { if (count > maxVal) { maxVal = count; maxGenre = genre; } });
    return maxGenre;
  }, [games]);

  const topGame = useMemo(() => {
    if (sessions.length === 0 || games.length === 0) return null;
    const playtimes = {};
    sessions.forEach(s => { playtimes[s.game_id] = (playtimes[s.game_id] || 0) + s.duration_seconds; });
    let topId = null, maxSecs = 0;
    Object.entries(playtimes).forEach(([id, secs]) => { if (secs > maxSecs) { maxSecs = secs; topId = id; } });
    return games.find(g => g.id === topId) || null;
  }, [games, sessions]);

  const streakStats = useMemo(() => {
    if (sessions.length === 0) return { longest: 0 };
    const activeDates = Array.from(new Set(sessions.map(s => new Date(s.start_time).toLocaleDateString()))).sort((a, b) => new Date(a) - new Date(b));
    let longest = 0, temp = 0, prevDate = null;
    activeDates.forEach(dateStr => {
      const curr = new Date(dateStr);
      if (!prevDate) { temp = 1; } else {
        const diff = (curr - prevDate) / 86400000;
        if (diff === 1) temp++; else if (diff > 1) { if (temp > longest) longest = temp; temp = 1; }
      }
      prevDate = curr;
    });
    if (temp > longest) longest = temp;
    return { longest };
  }, [sessions]);

  const handleSaveProfile = (e) => { e.preventDefault(); updateProfile(username, avatar, bio, age, favGenre); setIsEditing(false); };
  const handleUpdatePresence = (type) => {
    setStatusType(type);
    let msg = type;
    if (type === 'DND') msg = 'Do Not Disturb';
    updateProfileStatus(type, msg);
    setCustomStatus(msg);
  };
  const handleCustomStatusSubmit = (e) => { e.preventDefault(); updateProfileStatus(statusType, customStatus); };
  const handleAvatarFile = (e) => {
    const file = e.target.files[0];
    if (file) { const reader = new FileReader(); reader.onload = () => setAvatar(reader.result); reader.readAsDataURL(file); }
  };

  const handleExportCard = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 200));
    const card = document.getElementById('profile-share-card');
    if (card) {
      try {
        const canvas = await html2canvas(card, { backgroundColor: '#1e1b18', scale: 2, logging: false, useCORS: true });
        const dataUrl = canvas.toDataURL('image/png');
        if (typeof window !== 'undefined' && window.electron) {
          const res = await window.electron.system.exportPng(dataUrl);
          if (res.success) window.electron.system.showNotification('Profile Card Exported!', `Saved to: ${res.filePath.split('\\').pop()}`);
        } else {
          const link = document.createElement('a'); link.download = 'strafe-profile-card.png'; link.href = dataUrl; link.click();
        }
      } catch (err) { console.error("Export failed", err); }
      finally { setExporting(false); }
    }
  };

  const getStatusStyle = (type) => {
    const isActive = profile.status_type === type;
    if (isActive) return { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)' };
    return { background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-secondary)' };
  };

  return (
    <div className="flex flex-col gap-8 select-none">
      <div>
        <h1 className="vt-page-title">Profile</h1>
        <p className="text-[15px] mt-1" style={{ color: 'var(--text-secondary)' }}>Your identity and presence settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Status + Settings */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Status */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <h3 className="vt-section-header text-[11px]">Presence</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'Online', label: 'Online', dot: 'var(--status-online)' }, { id: 'Away', label: 'Away', dot: 'var(--status-away)' }, { id: 'DND', label: 'Do Not Disturb', dot: 'var(--status-dnd)' }].map(opt => (
                <button key={opt.id} onClick={() => handleUpdatePresence(opt.id)}
                  disabled={activeGameId !== null}
                  className="py-2.5 px-3 rounded-lg text-[13px] cursor-pointer transition-colors flex items-center gap-2"
                  style={{ ...getStatusStyle(opt.id), border: '1px solid', opacity: activeGameId !== null ? 0.5 : 1 }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.dot }} />
                  {opt.label}
                </button>
              ))}
              {activeGameId !== null && (
                <div className="py-2.5 px-3 rounded-lg text-[13px] flex items-center gap-2 text-center" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  <span className="w-2 h-2 rounded-full shrink-0 vt-pulse-dot" style={{ background: 'var(--accent)' }} />
                  In-Game
                </div>
              )}
            </div>
            <form onSubmit={handleCustomStatusSubmit} className="flex gap-2">
              <input type="text" placeholder="Set custom status..." value={customStatus} onChange={e => setCustomStatus(e.target.value)} className="vt-input flex-1" />
              <button type="submit" className="vt-btn-secondary cursor-pointer">Set</button>
            </form>
          </div>

          {/* Profile Settings */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="vt-section-header text-[11px]">Profile Details</h3>
              {!isEditing && <button onClick={() => setIsEditing(true)} className="vt-btn-ghost text-[13px] cursor-pointer">Edit</button>}
            </div>
            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'var(--bg-hover)', color: 'var(--accent)', fontWeight: 500 }}>
                    {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : username.slice(0, 2).toUpperCase()}
                  </div>
                  <label className="vt-btn-secondary cursor-pointer text-[13px]">
                    <Upload className="w-3.5 h-3.5" /> Browse
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                  </label>
                </div>
                <div>
                  <label className="vt-section-header text-[11px] block mb-1">Username</label>
                  <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="vt-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Age</label>
                    <input type="number" value={age} onChange={e => setAge(e.target.value)} className="vt-input" />
                  </div>
                  <div>
                    <label className="vt-section-header text-[11px] block mb-1">Favorite Genre</label>
                    <input type="text" value={favGenre} onChange={e => setFavGenre(e.target.value)} className="vt-input" />
                  </div>
                </div>
                <div>
                  <label className="vt-section-header text-[11px] block mb-1">Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="vt-textarea" />
                </div>
                <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => { setUsername(profile.username); setBio(profile.bio); setAvatar(profile.avatar_path); setAge(profile.age || ''); setFavGenre(profile.favorite_genre || ''); setIsEditing(false); }} className="vt-btn-ghost cursor-pointer">Cancel</button>
                  <button type="submit" className="vt-btn-primary cursor-pointer"><Save className="w-3.5 h-3.5" /> Save</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-[15px]" style={{ background: 'var(--bg-hover)', color: 'var(--accent)', fontWeight: 500 }}>
                    {profile.avatar_path ? <img src={profile.avatar_path} alt="Avatar" className="w-full h-full object-cover" /> : profile.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{profile.username}</h3>
                    <p className="vt-mono text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      STRAFE Member {profile.age ? `• ${profile.age} yrs` : ''}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 py-2" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h4 className="vt-section-header text-[11px] mb-0.5">Favorite Genre</h4>
                    <p className="text-[14px]" style={{ color: 'var(--text-primary)' }}>{profile.favorite_genre || 'Not Specified'}</p>
                  </div>
                  <div>
                    <h4 className="vt-section-header text-[11px] mb-0.5">Auto-Calculated Genre</h4>
                    <p className="text-[14px]" style={{ color: 'var(--text-primary)' }}>{favoriteGenre}</p>
                  </div>
                </div>
                <div>
                  <h4 className="vt-section-header text-[11px] mb-1">Bio</h4>
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{profile.bio}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Share Card */}
        <div className="lg:col-span-7 flex flex-col gap-4 items-center">
          <div className="w-full flex justify-between items-center max-w-sm px-1">
            <span className="vt-section-header text-[11px] flex items-center gap-1.5">
              <CornerRightDown className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} />
              Share Card
            </span>
            <button onClick={handleExportCard} disabled={exporting} className="vt-btn-primary cursor-pointer text-[13px]">
              {exporting ? 'Exporting...' : <><Share2 className="w-3.5 h-3.5" /> Save PNG</>}
            </button>
          </div>

          {/* Profile Card */}
          <div id="profile-share-card" className="w-full max-w-sm aspect-[5/8] rounded-2xl overflow-hidden flex flex-col justify-between p-6 relative select-none"
            style={{ background: '#1e1b18', border: '2px solid var(--accent)' }}
          >
            {/* Top */}
            <div className="relative flex flex-col gap-4 z-10">
              <div className="flex justify-between items-center pb-2" style={{ borderBottom: '1px solid rgba(224,125,69,0.2)' }}>
                <span className="text-[11px] tracking-widest uppercase" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#e07d45' }}>Profile Card</span>
                <span className="vt-mono text-[10px]" style={{ color: '#4a4540' }}>STRAFE</span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg" style={{ background: '#2d2925', border: '2px solid #e07d45', color: '#e07d45', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                  {profile.avatar_path ? <img src={profile.avatar_path} alt="Avatar" className="w-full h-full object-cover" /> : profile.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg leading-none" style={{ color: '#f0ebe4', fontWeight: 500 }}>{profile.username}</h3>
                  {(profile.age || profile.favorite_genre) && (
                    <p className="text-[11px] mt-1" style={{ color: '#8a7f74' }}>
                      {profile.age ? `${profile.age} yrs` : ''}
                      {profile.age && profile.favorite_genre ? ' • ' : ''}
                      {profile.favorite_genre || ''}
                    </p>
                  )}
                  <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: '#8a7f74' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#5cb86a' }} />
                    {profile.status_text}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 z-10 my-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { icon: Clock, label: 'Playtime', value: `${totalPlaytimeHours}h`, color: '#e07d45' },
                { icon: Award, label: 'Trophies', value: totalAchievementsUnlocked, color: '#5cb86a' },
                { icon: Gamepad2, label: 'Games', value: `${games.length}`, color: '#9b87c2' },
                { icon: Flame, label: 'Streak', value: `${streakStats.longest} days`, color: '#e07d45' },
              ].map((s, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ color: '#4a4540' }}>
                    <s.icon className="w-3 h-3" style={{ color: s.color }} />
                    {s.label}
                  </span>
                  <span className="text-xl mt-1" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: '#f0ebe4' }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Top Game */}
            <div className="z-10 flex flex-col gap-2 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#4a4540' }}>Top Game</span>
              {topGame ? (
                <div className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: '#161412', border: '1px solid rgba(155,135,194,0.15)' }}>
                  <img src={topGame.cover_art} alt={topGame.name} className="w-7 h-10 object-cover rounded" style={{ border: '1px solid rgba(255,255,255,0.06)' }} />
                  <div className="min-w-0">
                    <p className="text-[13px] truncate" style={{ fontWeight: 500, color: '#9b87c2' }}>{topGame.name}</p>
                    <p className="vt-mono text-[10px] mt-0.5" style={{ color: '#4a4540' }}>Favorite genre: {favoriteGenre}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg text-center text-[11px]" style={{ background: '#161412', color: '#4a4540' }}>No top game yet.</div>
              )}
            </div>

            {/* Footer */}
            <div className="z-10 flex items-center justify-between pt-3 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-[10px] uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: '#4a4540' }}>STRAFE v1.0</span>
              <div className="flex gap-0.5">
                <span className="w-2 h-1 rounded-full" style={{ background: '#e07d45' }} />
                <span className="w-2 h-1 rounded-full" style={{ background: '#9b87c2' }} />
                <span className="w-2 h-1 rounded-full" style={{ background: '#5cb86a' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
