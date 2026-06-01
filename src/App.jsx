import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useGameStore } from './stores/useGameStore';
import { 
  Home, 
  Library as LibraryIcon, 
  BarChart2, 
  User, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight, 
  Minus, 
  X, 
  Gamepad2, 
  FolderHeart,
  Sun,
  Moon
} from 'lucide-react';

import { useSessionStore } from './stores/sessionStore';
import { SessionTimer } from './components/SessionTimer';

// Lazy load page views for memory optimization
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Library = React.lazy(() => import('./pages/Library'));
const GameDetail = React.lazy(() => import('./pages/GameDetail'));
const Stats = React.lazy(() => import('./pages/Stats'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Settings = React.lazy(() => import('./pages/Settings'));
const FloatingWidget = React.lazy(() => import('./components/FloatingWidget'));
const Login = React.lazy(() => import('./pages/Login'));
import logoImg from '../logo.png';
import iconImg from '../icon.png';

const hasElectron = typeof window !== 'undefined' && window.electron !== undefined;

// ---- Theme Management ----
function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('vt-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  localStorage.setItem('vt-theme', theme);
}

// ---- Titlebar ----
const Titlebar = () => {
  const activeGameId = useGameStore(state => state.activeGameId);
  const games = useGameStore(state => state.games);
  const activeGame = games.find(g => g.id === activeGameId);

  const handleMinimize = () => {
    if (hasElectron) window.electron.system.minimizeToTray();
  };

  const handleClose = () => {
    if (hasElectron) window.electron.system.exitApp();
  };

  return (
    <div 
      className="h-10 w-full flex items-center justify-between px-4 shrink-0 select-none"
      style={{ 
        WebkitAppRegion: 'drag',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <div className="flex items-center gap-2">
        <img src={iconImg} alt="Logo" className="w-5 h-5 object-contain rounded" style={{ border: '1px solid var(--border)' }} />
        <span 
          className="text-sm tracking-wide"
          style={{ 
            fontFamily: 'var(--font-display)', 
            fontStyle: 'italic',
            fontWeight: 400,
            color: 'var(--text-primary)' 
          }}
        >
          STRAFE
        </span>
        {activeGame && (
          <span className="vt-badge vt-badge-ingame ml-3 text-[11px] flex items-center gap-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full vt-pulse-dot" style={{ background: 'var(--accent)' }} />
            Playing: {activeGame.name}
            <SessionTimer />
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button 
          onClick={handleMinimize}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title="Minimize to Tray"
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={handleClose}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title="Close App"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ---- Sidebar ----
const Sidebar = ({ collapsed, setCollapsed, theme, setTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, collections } = useGameStore();

  const libraryItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/library', label: 'Library', icon: LibraryIcon },
    { path: '/stats', label: 'Statistics', icon: BarChart2 },
  ];

  const accountItems = [
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const getStatusBadgeClass = (type) => {
    switch (type) {
      case 'Online': return 'vt-badge-online';
      case 'Away': return 'vt-badge-away';
      case 'DND': return 'vt-badge-dnd';
      case 'In-Game': return 'vt-badge-ingame';
      default: return 'vt-badge-default';
    }
  };

  const getStatusDotColor = (type) => {
    switch (type) {
      case 'Online': return 'var(--status-online)';
      case 'Away': return 'var(--status-away)';
      case 'DND': return 'var(--status-dnd)';
      case 'In-Game': return 'var(--status-ingame)';
      default: return 'var(--text-tertiary)';
    }
  };

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150"
        style={{
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
          fontWeight: isActive ? 500 : 400,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div 
      className="h-full flex flex-col shrink-0 select-none transition-all duration-200"
      style={{ 
        width: collapsed ? 64 : 220,
        backgroundColor: 'var(--bg-sidebar)',
      }}
    >
      {/* Profile Section */}
      <div 
        onClick={() => navigate('/profile')}
        className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${collapsed ? 'justify-center' : ''}`}
        style={{ borderBottom: '1px solid var(--border)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div className="relative shrink-0">
          <div 
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-[13px]"
            style={{ 
              background: 'var(--bg-hover)', 
              color: 'var(--accent)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500 
            }}
          >
            {profile.avatar_path ? (
              <img src={profile.avatar_path} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              profile.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <span 
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ 
              background: getStatusDotColor(profile.status_type),
              border: '2px solid var(--bg-sidebar)'
            }} 
          />
        </div>
        
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {profile.username}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
              {profile.status_text}
            </p>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
        {/* Library Group */}
        {!collapsed && (
          <p className="vt-section-header px-3 mb-1.5 text-[11px]">Library</p>
        )}
        {libraryItems.map(item => <NavItem key={item.path} item={item} />)}

        {/* Collections */}
        {!collapsed && collections.length > 0 && (
          <div className="mt-5">
            <p className="vt-section-header px-3 mb-1.5 text-[11px]">Collections</p>
            <div className="flex flex-col gap-0.5">
              {collections.map(col => (
                <Link
                  key={col.id}
                  to={`/library?collection=${col.id}`}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: col.color || 'var(--accent)' }} 
                  />
                  <span className="truncate">{col.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Account Group */}
        <div className="mt-5">
          {!collapsed && (
            <p className="vt-section-header px-3 mb-1.5 text-[11px]">Account</p>
          )}
          {accountItems.map(item => <NavItem key={item.path} item={item} />)}
        </div>
      </nav>

      {/* Bottom Controls: Theme Toggle + Collapse */}
      <div 
        className="p-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* Theme Toggle */}
        <button
          onClick={() => {
            const next = theme === 'light' ? 'dark' : 'light';
            setTheme(next);
            applyTheme(next);
          }}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <div className="flex-1" />

        {/* Collapse Toggle */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// ---- Main Layout ----
const MainLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <Titlebar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} theme={theme} setTheme={setTheme} />
        <main className="flex-1 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--bg-base)' }}>
          <div className="max-w-[1200px] mx-auto px-14 py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// ---- Route Controller ----
const AppRoutes = () => {
  const location = useLocation();
  const initStore = useGameStore(state => state.initStore);
  const { profile, loading } = useGameStore();
  
  useEffect(() => {
    initStore();
  }, [initStore]);

  const initSessionListeners = useSessionStore(state => state.initListeners);
  const { activeSession, elapsed } = useSessionStore();
  const setActiveGameId = useGameStore(state => state.setActiveGameId);
  const setActiveSessionTime = useGameStore(state => state.setActiveSessionTime);

  useEffect(() => {
    const cleanup = initSessionListeners();
    return () => {
      if (cleanup) cleanup();
    };
  }, [initSessionListeners]);

  useEffect(() => {
    if (activeSession) {
      setActiveGameId(activeSession.gameId);
      setActiveSessionTime(elapsed);
    } else {
      setActiveGameId(null);
      setActiveSessionTime(0);
    }
  }, [activeSession, elapsed, setActiveGameId, setActiveSessionTime]);

  useEffect(() => {
    if (hasElectron) {
      const unsub = window.strafe.onSessionEnded(() => {
        initStore();
      });
      return unsub;
    }
  }, [initStore]);

  const isFloating = location.pathname.startsWith('/floating');

  if (isFloating) {
    return (
      <div className="h-screen w-screen overflow-hidden select-none" style={{ background: 'transparent' }}>
        <Routes>
          <Route path="/floating" element={<FloatingWidget />} />
        </Routes>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 select-none" style={{ backgroundColor: 'var(--bg-base)' }}>
        <img src={iconImg} alt="STRAFE Logo" className="w-16 h-16 object-contain animate-pulse rounded-xl" style={{ border: '1px solid var(--border)' }} />
        <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <span className="text-sm font-medium tracking-wide" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>STRAFE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
        </div>
      </div>
    );
  }

  if (!profile || !profile.is_onboarded) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Titlebar />
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
          <Login />
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/library" element={<Library />} />
        <Route path="/game/:id" element={<GameDetail />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </MainLayout>
  );
};

const PageSkeleton = () => (
  <div style={{ 
    width: '100%', height: '100vh', 
    background: 'var(--bg-base)' 
  }} />
);

export default function App() {
  return (
    <HashRouter>
      <React.Suspense fallback={<PageSkeleton />}>
        <AppRoutes />
      </React.Suspense>
    </HashRouter>
  );
}
