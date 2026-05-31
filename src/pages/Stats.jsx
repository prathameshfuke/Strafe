import React, { useState, useMemo } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Clock, TrendingUp, Flame, Activity, Zap, Calendar } from 'lucide-react';

export default function Stats() {
  const { games, sessions, activeGameId, activeSessionSeconds } = useGameStore();
  const [timeframe, setTimeframe] = useState('all');

  const filteredSessions = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0);
    if (timeframe === 'week') cutoff = new Date(now.getTime() - 7 * 86400000);
    else if (timeframe === 'month') cutoff = new Date(now.getTime() - 30 * 86400000);
    const list = sessions.filter(s => new Date(s.start_time) >= cutoff);
    if (activeGameId) {
      list.push({ id: 'active_running', game_id: activeGameId, start_time: new Date(Date.now() - activeSessionSeconds * 1000).toISOString(), end_time: new Date().toISOString(), duration_seconds: activeSessionSeconds, notes: 'Active session' });
    }
    return list;
  }, [sessions, timeframe, activeGameId, activeSessionSeconds]);

  const totalPlaytimeSecs = useMemo(() => filteredSessions.reduce((acc, curr) => acc + curr.duration_seconds, 0), [filteredSessions]);
  const daysSpentGaming = (totalPlaytimeSecs / 86400).toFixed(1);
  const totalPlaytimeHours = (totalPlaytimeSecs / 3600).toFixed(1);

  const averageSessionMins = useMemo(() => {
    if (filteredSessions.length === 0) return 0;
    return Math.round(totalPlaytimeSecs / filteredSessions.length / 60);
  }, [filteredSessions, totalPlaytimeSecs]);

  const mostProductiveDay = useMemo(() => {
    if (filteredSessions.length === 0) return 'None';
    const dayTotals = Array(7).fill(0);
    filteredSessions.forEach(s => { dayTotals[new Date(s.start_time).getDay()] += s.duration_seconds; });
    let maxIdx = 0, maxVal = 0;
    dayTotals.forEach((val, idx) => { if (val > maxVal) { maxVal = val; maxIdx = idx; } });
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return maxVal > 0 ? weekdayNames[maxIdx] : 'None';
  }, [filteredSessions]);

  const streakStats = useMemo(() => {
    if (sessions.length === 0) return { current: 0, longest: 0 };
    const activeDates = Array.from(new Set(sessions.map(s => new Date(s.start_time).toLocaleDateString()))).sort((a, b) => new Date(a) - new Date(b));
    let current = 0, longest = 0, temp = 0;
    const todayStr = new Date().toLocaleDateString();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const hasPlayedRecently = activeDates.includes(todayStr) || activeDates.includes(yesterday.toLocaleDateString());
    let prevDate = null;
    activeDates.forEach(dateStr => {
      const curr = new Date(dateStr);
      if (!prevDate) { temp = 1; } else {
        const diffDays = (curr - prevDate) / 86400000;
        if (diffDays === 1) temp++; else if (diffDays > 1) { if (temp > longest) longest = temp; temp = 1; }
      }
      prevDate = curr;
    });
    if (temp > longest) longest = temp;
    current = hasPlayedRecently ? temp : 0;
    return { current, longest };
  }, [sessions]);

  const top10ChartData = useMemo(() => {
    const playtimes = {};
    filteredSessions.forEach(s => { playtimes[s.game_id] = (playtimes[s.game_id] || 0) + s.duration_seconds; });
    return Object.entries(playtimes)
      .map(([gameId, seconds]) => ({ name: games.find(g => g.id === gameId)?.name || 'Unknown', hours: parseFloat((seconds / 3600).toFixed(1)) }))
      .sort((a, b) => b.hours - a.hours).slice(0, 10);
  }, [filteredSessions, games]);

  const trendChartData = useMemo(() => {
    const dailyPlaytime = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); dailyPlaytime[d.toISOString().split('T')[0]] = 0; }
    filteredSessions.forEach(s => { const ds = new Date(s.start_time).toISOString().split('T')[0]; if (dailyPlaytime[ds] !== undefined) dailyPlaytime[ds] += s.duration_seconds / 3600; });
    return Object.entries(dailyPlaytime).map(([ds, hours]) => ({ date: new Date(ds).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), hours: parseFloat(hours.toFixed(1)) }));
  }, [filteredSessions]);

  const genreChartData = useMemo(() => {
    const counts = {};
    games.forEach(g => { if (g.genre) g.genre.split(',').forEach(genre => { const c = genre.trim(); counts[c] = (counts[c] || 0) + 1; }); });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [games]);

  const COLORS = ['var(--accent)', 'var(--accent-secondary)', '#b8923e', 'var(--success)', 'var(--text-secondary)'];

  return (
    <div className="flex flex-col gap-8 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="vt-page-title">Statistics</h1>
          <p className="text-[15px] mt-1" style={{ color: 'var(--text-secondary)' }}>Playtime metrics and gaming analytics.</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {[{ id: 'week', label: '7 Days' }, { id: 'month', label: '30 Days' }, { id: 'all', label: 'All Time' }].map(opt => (
            <button key={opt.id} onClick={() => setTimeframe(opt.id)}
              className="px-3 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors"
              style={{
                background: timeframe === opt.id ? 'var(--accent)' : 'transparent',
                color: timeframe === opt.id ? '#fefefe' : 'var(--text-secondary)',
                fontWeight: timeframe === opt.id ? 500 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Clock, value: `${totalPlaytimeHours}h`, sub: 'Total Playtime' },
          { icon: Calendar, value: `${daysSpentGaming}d`, sub: 'Days Gaming' },
          { icon: Activity, value: `${averageSessionMins}m`, sub: 'Avg Session' },
          { icon: Zap, value: mostProductiveDay, sub: 'Peak Day', small: true },
        ].map((stat, i) => (
          <div key={i} className="vt-stat-card flex flex-col">
            <stat.icon className="w-[18px] h-[18px] mb-3" style={{ color: 'var(--text-secondary)' }} />
            <span className={stat.small ? 'text-xl' : 'vt-display-number'} style={stat.small ? { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-primary)' } : {}}>
              {stat.value}
            </span>
            <span className="vt-section-header text-[11px] mt-2">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend */}
        <div className="lg:col-span-2 vt-card p-5 flex flex-col gap-3 h-[300px]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <h3 className="vt-section-header text-[11px]">Playtime Trend</h3>
            </div>
            <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Last 30 Days</span>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--text-tertiary)" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} tickFormatter={val => `${val}h`} style={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-ui)' }}
                  labelStyle={{ color: 'var(--accent-secondary)', fontWeight: 500 }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={val => [`${val} hrs`, 'Playtime']}
                />
                <Line type="monotone" dataKey="hours" stroke="var(--accent-secondary)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--accent-secondary)', strokeWidth: 1 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Genre Pie */}
        <div className="vt-card p-5 flex flex-col gap-3 h-[300px]">
          <h3 className="vt-section-header text-[11px]">Genre Breakdown</h3>
          <div className="flex-1 w-full flex items-center justify-center">
            {genreChartData.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={genreChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {genreChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-ui)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={val => [`${val} games`, 'Count']}
                  />
                  <Legend verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 10 */}
        <div className="lg:col-span-2 vt-card p-5 flex flex-col gap-3 h-[350px]">
          <h3 className="vt-section-header text-[11px]">Most Played Games</h3>
          <div className="flex-1 w-full">
            {top10ChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-[13px]" style={{ color: 'var(--text-secondary)' }}>No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10ChartData} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                  <XAxis type="number" stroke="var(--text-tertiary)" tickLine={false} axisLine={false} tickFormatter={val => `${val}h`} style={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" tickLine={false} axisLine={false} width={100} style={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-ui)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={val => [`${val} hrs`, 'Playtime']}
                  />
                  <Bar dataKey="hours" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Streak */}
        <div className="vt-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h3 className="vt-section-header text-[11px]">Streaks</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg text-center" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <div>
              <p className="vt-section-header text-[11px] mb-1">Current</p>
              <span className="vt-display-number text-2xl" style={{ color: 'var(--accent)' }}>{streakStats.current}</span>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>days</p>
            </div>
            <div>
              <p className="vt-section-header text-[11px] mb-1">Record</p>
              <span className="vt-display-number text-2xl">{streakStats.longest}</span>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>days</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <p className="vt-section-header text-[11px]">Milestones</p>
            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 max-h-[160px]">
              {[
                { name: 'Getting Started', desc: '3 day streak', req: 3 },
                { name: 'Committed', desc: '7 day streak', req: 7 },
                { name: 'Dedicated', desc: '14 day streak', req: 14 }
              ].map(m => {
                const unlocked = streakStats.longest >= m.req;
                return (
                  <div key={m.name} className="p-3 rounded-lg flex items-center justify-between text-[13px]"
                    style={{ background: unlocked ? 'var(--accent-soft)' : 'var(--bg-base)', border: `1px solid ${unlocked ? 'var(--accent)' : 'var(--border)'}`, color: unlocked ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    <div>
                      <p style={{ fontWeight: 500 }}>{m.name}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{m.desc}</p>
                    </div>
                    {unlocked ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]" style={{ background: 'var(--accent)', color: '#fefefe', fontWeight: 500 }}>✓</span>
                    ) : (
                      <span className="vt-mono text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{streakStats.longest}/{m.req}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
