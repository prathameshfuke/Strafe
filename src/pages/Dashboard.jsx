import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/useGameStore';
import { 
  Play, 
  Square, 
  Gamepad2, 
  Clock, 
  Flame, 
  Award, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    games, 
    sessions, 
    achievements, 
    profile,
    activeGameId, 
    activeSessionSeconds, 
    launchGame, 
    stopGame 
  } = useGameStore();

  const activeGame = useMemo(() => games.find(g => g.id === activeGameId), [games, activeGameId]);

  // --- Stats Calculations ---
  const totalPlaytimeSecs = useMemo(() => {
    return sessions.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0) + (activeSessionSeconds || 0);
  }, [sessions, activeSessionSeconds]);

  const totalPlaytimeHours = (totalPlaytimeSecs / 3600).toFixed(1);

  const totalAchievementsUnlocked = useMemo(() => {
    return achievements.filter(a => a.unlocked === 1).length;
  }, [achievements]);

  const currentStreak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const activeDates = new Set(
      sessions.map(s => new Date(s.start_time).toLocaleDateString())
    );
    let streak = 0;
    let checkDate = new Date();
    let playedToday = activeDates.has(checkDate.toLocaleDateString());
    if (!playedToday) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (!activeDates.has(checkDate.toLocaleDateString())) return 0;
    }
    while (activeDates.has(checkDate.toLocaleDateString())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  }, [sessions]);

  const avgRating = useMemo(() => {
    const rated = games.filter(g => g.rating > 0);
    if (rated.length === 0) return 0;
    return (rated.reduce((sum, g) => sum + g.rating, 0) / rated.length).toFixed(1);
  }, [games]);

  // --- Top Played Games ---
  const topPlayedGames = useMemo(() => {
    const playtimes = {};
    sessions.forEach(s => {
      playtimes[s.game_id] = (playtimes[s.game_id] || 0) + s.duration_seconds;
    });
    if (activeGameId) {
      playtimes[activeGameId] = (playtimes[activeGameId] || 0) + activeSessionSeconds;
    }
    return Object.entries(playtimes)
      .map(([gameId, seconds]) => ({
        game: games.find(g => g.id === gameId),
        gameId,
        seconds,
        hours: (seconds / 3600).toFixed(1)
      }))
      .filter(item => item.game !== undefined)
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);
  }, [games, sessions, activeGameId, activeSessionSeconds]);

  // --- Continue Playing (recently played) ---
  const recentlyPlayed = useMemo(() => {
    const lastSessionMap = {};
    sessions.forEach(s => {
      const existing = lastSessionMap[s.game_id];
      if (!existing || new Date(s.start_time) > new Date(existing.start_time)) {
        lastSessionMap[s.game_id] = s;
      }
    });
    if (activeGameId) {
      lastSessionMap[activeGameId] = { game_id: activeGameId, start_time: new Date().toISOString() };
    }
    return Object.values(lastSessionMap)
      .map(session => ({
        game: games.find(g => g.id === session.game_id),
        lastPlayed: session.start_time
      }))
      .filter(item => item.game !== undefined)
      .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
      .slice(0, 3);
  }, [games, sessions, activeGameId]);

  // --- 12-Week Activity Heatmap ---
  const heatmapData = useMemo(() => {
    const dailyPlaytime = {};
    sessions.forEach(s => {
      const dateStr = new Date(s.start_time).toISOString().split('T')[0];
      dailyPlaytime[dateStr] = (dailyPlaytime[dateStr] || 0) + s.duration_seconds;
    });
    if (activeGameId) {
      const dateStr = new Date().toISOString().split('T')[0];
      dailyPlaytime[dateStr] = (dailyPlaytime[dateStr] || 0) + activeSessionSeconds;
    }
    const grid = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (12 * 7) + (7 - today.getDay() - 1));
    for (let w = 0; w < 12; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (w * 7) + d);
        const dateStr = currentDate.toISOString().split('T')[0];
        const seconds = dailyPlaytime[dateStr] || 0;
        const hours = seconds / 3600;
        week.push({
          date: dateStr,
          hours,
          dayLabel: currentDate.toLocaleDateString(undefined, { weekday: 'short' }),
          formattedDate: currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        });
      }
      grid.push(week);
    }
    return grid;
  }, [sessions, activeGameId, activeSessionSeconds]);

  // --- Helpers ---
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const getHeatmapClass = (hours) => {
    if (hours === 0) return 'vt-heatmap-empty';
    if (hours < 1) return 'vt-heatmap-low';
    if (hours < 3) return 'vt-heatmap-med';
    return 'vt-heatmap-high';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed': return 'vt-badge vt-badge-completed';
      case 'Playing': return 'vt-badge vt-badge-playing';
      case 'Plan to Play': return 'vt-badge vt-badge-plan';
      default: return 'vt-badge vt-badge-default';
    }
  };

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getGamePlaytime = (gameId) => {
    const secs = sessions
      .filter(s => s.game_id === gameId)
      .reduce((sum, s) => sum + s.duration_seconds, 0);
    return (secs / 3600).toFixed(1);
  };

  return (
    <div className="flex flex-col gap-8 select-none">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="vt-page-title">{getGreeting()}, {profile.username}</h1>
          <p className="text-[15px] mt-1" style={{ color: 'var(--text-secondary)' }}>
            Here's what's happening with your library.
          </p>
        </div>
      </div>

      {/* Now Playing Banner */}
      {activeGame && (
        <div 
          className="vt-card flex items-center justify-between p-5 gap-6"
          style={{ borderColor: 'var(--accent)', borderWidth: '1px' }}
        >
          <div className="flex items-center gap-4">
            <img 
              src={activeGame.cover_art} 
              alt={activeGame.name} 
              className="w-14 h-[72px] object-cover rounded-lg"
              style={{ border: '1px solid var(--border)' }}
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full vt-pulse-dot" style={{ background: 'var(--accent)' }} />
                <span className="vt-section-header text-[11px]">Now Playing</span>
              </div>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {activeGame.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="vt-section-header text-[11px] mb-1">Session Time</p>
              <p className="vt-mono text-2xl" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                {formatTime(activeSessionSeconds)}
              </p>
            </div>
            <button 
              onClick={() => stopGame(activeGame.id)}
              className="vt-btn-primary cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Gamepad2, value: games.length, label: 'Games', sub: 'In Library' },
          { icon: Clock, value: `${totalPlaytimeHours}h`, label: 'Hours', sub: 'Total Playtime' },
          { icon: Flame, value: currentStreak, label: 'Streak', sub: 'Day Streak' },
          { icon: Award, value: avgRating || '—', label: 'Rating', sub: 'Avg Rating' },
        ].map((stat, i) => (
          <div key={i} className="vt-stat-card flex flex-col">
            <stat.icon className="w-[18px] h-[18px] mb-3" style={{ color: 'var(--text-secondary)' }} />
            <span className="vt-display-number">{stat.value}</span>
            <span className="vt-section-header text-[11px] mt-2">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Continue Playing */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="vt-section-header">Continue Playing</h3>
          <button 
            onClick={() => navigate('/library')} 
            className="vt-btn-ghost text-[13px] cursor-pointer"
          >
            View All
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentlyPlayed.length === 0 ? (
          <div 
            className="vt-card p-10 flex flex-col items-center justify-center text-center"
          >
            <Gamepad2 className="w-10 h-10 mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No games played yet.</p>
            <button 
              onClick={() => navigate('/library')} 
              className="vt-btn-primary mt-4 cursor-pointer"
            >
              Go to Library
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentlyPlayed.map(({ game }) => {
              const isCurrentlyPlaying = activeGameId === game.id;
              return (
                <div 
                  key={game.id}
                  className="vt-card vt-card-hover overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/game/${game.id}`)}
                >
                  {/* Cover Art - 60% height */}
                  <div className="relative aspect-[16/10] overflow-hidden" style={{ borderRadius: '10px 10px 0 0' }}>
                    <img 
                      src={game.cover_art} 
                      alt={game.name} 
                      className="w-full h-full object-cover"
                    />
                    <div className="vt-cover-shadow absolute inset-0" />
                    
                    {/* Status pill - bottom right */}
                    <div className="absolute bottom-2.5 right-2.5">
                      <span className={getStatusBadge(game.status)}>
                        {game.status}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Info */}
                  <div className="p-3.5">
                    <h4 className="text-[15px] truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {game.name}
                    </h4>
                    <p className="vt-mono text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {getGamePlaytime(game.id)} hrs played
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Row: Heatmap + Top Games */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Activity Heatmap */}
        <div className="lg:col-span-3 vt-card p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <h3 className="vt-section-header text-[11px]">Activity</h3>
            </div>
            <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Last 12 Weeks</span>
          </div>

          <div className="flex flex-col items-center p-3 rounded-lg" style={{ background: 'var(--bg-base)' }}>
            <div className="flex gap-[3px]">
              {heatmapData.map((week, wIndex) => (
                <div key={wIndex} className="flex flex-col gap-[3px]">
                  {week.map((day, dIndex) => (
                    <div
                      key={dIndex}
                      className={`vt-heatmap-cell vt-tooltip ${getHeatmapClass(day.hours)}`}
                      data-tip={`${day.formattedDate}: ${day.hours.toFixed(1)} hrs`}
                    />
                  ))}
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              <span>Less</span>
              <div className="flex items-center gap-1">
                <div className="vt-heatmap-cell vt-heatmap-empty" />
                <div className="vt-heatmap-cell vt-heatmap-low" />
                <div className="vt-heatmap-cell vt-heatmap-med" />
                <div className="vt-heatmap-cell vt-heatmap-high" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Top Games */}
        <div className="lg:col-span-2 vt-card p-5 flex flex-col gap-4">
          <h3 className="vt-section-header text-[11px]">Your Top Games</h3>
          
          {topPlayedGames.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <Gamepad2 className="w-8 h-8 mb-2" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No play data yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {topPlayedGames.map((item, index) => (
                <div 
                  key={item.gameId}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                  onClick={() => navigate(`/game/${item.gameId}`)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="vt-mono text-[13px] w-5 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    {index + 1}
                  </span>
                  <img 
                    src={item.game.cover_art} 
                    alt={item.game.name}
                    className="w-8 h-10 object-cover rounded"
                    style={{ border: '1px solid var(--border)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.game.name}
                    </p>
                  </div>
                  <span className="vt-mono text-[13px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {item.hours}h
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
