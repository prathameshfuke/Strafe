import React, { useState, useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { Key, Bell, Database, FileUp, FileDown, Trash2, Check, Sun, Moon } from 'lucide-react';

const hasElectron = typeof window !== 'undefined' && window.electron !== undefined;

export default function Settings() {
  const { settings, updateSetting, games, sessions, achievements, collections, profile, initStore } = useGameStore();

  const [apiKey, setApiKey] = useState(settings.rawg_api_key || '');
  const [scanFolder, setScanFolder] = useState(settings.scan_folder || 'C:\\Games');
  const [minimizeToTray, setMinimizeToTray] = useState(settings.minimize_to_tray === 'true');
  const [notifications, setNotifications] = useState(settings.notifications !== 'false');
  const [savedKey, setSavedKey] = useState(false);
  const [savedScan, setSavedScan] = useState(false);

  useEffect(() => {
    setApiKey(settings.rawg_api_key || '');
    setScanFolder(settings.scan_folder || 'C:\\Games');
    setMinimizeToTray(settings.minimize_to_tray === 'true');
    setNotifications(settings.notifications !== 'false');
  }, [settings]);

  const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const handleThemeChange = (newTheme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
    localStorage.setItem('vt-theme', newTheme);
    updateSetting('theme', newTheme);
  };

  const handleSaveApiKey = (e) => { e.preventDefault(); updateSetting('rawg_api_key', apiKey); setSavedKey(true); setTimeout(() => setSavedKey(false), 2000); };
  const handleSaveScanFolder = (e) => { e.preventDefault(); updateSetting('scan_folder', scanFolder); setSavedScan(true); setTimeout(() => setSavedScan(false), 2000); };
  const handleToggleTray = (checked) => { setMinimizeToTray(checked); updateSetting('minimize_to_tray', checked ? 'true' : 'false'); };
  const handleToggleNotifications = (checked) => { setNotifications(checked); updateSetting('notifications', checked ? 'true' : 'false'); };

  const handleExportData = () => {
    const backupData = { version: '1.0.0', timestamp: new Date().toISOString(), games, sessions, achievements, collections, profile };
    const dataStr = JSON.stringify(backupData, null, 2);
    if (hasElectron) window.electron.system.exportPng(dataStr);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `vaulttrack-backup-${new Date().toISOString().split('T')[0]}.json`; link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.games || !data.sessions) { alert("Invalid backup file."); return; }
        if (confirm("Importing will overwrite current data. Continue?")) {
          if (hasElectron) {
            await window.electron.db.run("DELETE FROM games");
            await window.electron.db.run("DELETE FROM sessions");
            await window.electron.db.run("DELETE FROM achievements");
            await window.electron.db.run("DELETE FROM collections");
            await window.electron.db.run("DELETE FROM collection_games");
            for (const g of data.games) await window.electron.db.run("INSERT INTO games (id, name, exe_path, cover_art, genre, developer, description, status, rating, is_favorite, date_added, rawg_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [g.id, g.name, g.exe_path, g.cover_art, g.genre, g.developer, g.description, g.status, g.rating, g.is_favorite, g.date_added, g.rawg_id]);
            for (const s of data.sessions) await window.electron.db.run("INSERT INTO sessions (game_id, start_time, end_time, duration_seconds, notes) VALUES (?, ?, ?, ?, ?)", [s.game_id, s.start_time, s.end_time, s.duration_seconds, s.notes]);
            for (const a of data.achievements) await window.electron.db.run("INSERT INTO achievements (id, game_id, name, description, rarity, unlocked, unlocked_date) VALUES (?, ?, ?, ?, ?, ?, ?)", [a.id, a.game_id, a.name, a.description, a.rarity, a.unlocked, a.unlocked_date]);
          }
          await initStore();
          alert("Backup imported successfully!");
        }
      } catch (err) { console.error(err); alert("Failed to parse backup file."); }
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (confirm("This will permanently delete all data. This cannot be undone. Continue?")) {
      if (hasElectron) {
        await window.electron.db.run("DELETE FROM games");
        await window.electron.db.run("DELETE FROM sessions");
        await window.electron.db.run("DELETE FROM achievements");
        await window.electron.db.run("DELETE FROM collections");
        await window.electron.db.run("DELETE FROM collection_games");
        await window.electron.db.run("DELETE FROM profile");
      }
      localStorage.clear();
      await initStore();
      alert("All data has been reset.");
    }
  };

  return (
    <div className="flex flex-col gap-8 select-none max-w-3xl">
      <div>
        <h1 className="vt-page-title">Settings</h1>
        <p className="text-[15px] mt-1" style={{ color: 'var(--text-secondary)' }}>Configure VaultTrack preferences and data management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left */}
        <div className="flex flex-col gap-6">
          {/* API & Folder */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="vt-section-header text-[11px]">Metadata Engine</h3>
            </div>
            <form onSubmit={handleSaveApiKey} className="flex flex-col gap-2">
              <label className="vt-section-header text-[11px]">RAWG API Key</label>
              <div className="flex gap-2">
                <input type="password" placeholder="Enter API key..." value={apiKey} onChange={e => setApiKey(e.target.value)} className="vt-input flex-1" />
                <button type="submit" className="vt-btn-primary cursor-pointer text-[13px]">
                  {savedKey ? <Check className="w-3.5 h-3.5" /> : 'Save'}
                </button>
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Get a free key at <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>rawg.io/apidocs</a>
              </p>
            </form>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <form onSubmit={handleSaveScanFolder} className="flex flex-col gap-2">
              <label className="vt-section-header text-[11px]">Default Scan Directory</label>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. C:\Games" value={scanFolder} onChange={e => setScanFolder(e.target.value)} className="vt-input vt-mono flex-1" />
                <button type="submit" className="vt-btn-secondary cursor-pointer text-[13px]">
                  {savedScan ? <Check className="w-3.5 h-3.5" /> : 'Set'}
                </button>
              </div>
            </form>
          </div>

          {/* Theme */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <h3 className="vt-section-header text-[11px]">Appearance</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'light', label: 'Light', icon: Sun, desc: 'Warm off-white' },
                { id: 'dark', label: 'Dark', icon: Moon, desc: 'Warm dark' },
              ].map(opt => {
                const isActive = currentTheme === opt.id;
                return (
                  <button key={opt.id} onClick={() => handleThemeChange(opt.id)}
                    className="p-4 rounded-lg text-left cursor-pointer flex flex-col gap-1 transition-colors"
                    style={{
                      background: isActive ? 'var(--accent-soft)' : 'var(--bg-base)',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <opt.icon className="w-5 h-5 mb-1" />
                    <span className="text-[13px]" style={{ fontWeight: 500 }}>{opt.label}</span>
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* About */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <h3 className="vt-section-header text-[11px]">About</h3>
            <div className="flex flex-col gap-1 text-[13px]">
              <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>VaultTrack v1.0.0</p>
              <p style={{ color: 'var(--text-secondary)' }}>A premium offline game library manager and play tracker.</p>
            </div>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <a 
              href="https://github.com/prathameshfuke/Strafe" 
              target="_blank" 
              rel="noreferrer" 
              className="vt-btn-secondary cursor-pointer text-[13px] flex items-center justify-center gap-2"
              style={{ textDecoration: 'none' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              GitHub Repository
            </a>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-6">
          {/* Preferences */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} />
              <h3 className="vt-section-header text-[11px]">Preferences</h3>
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[13px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Minimize to Tray</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Keep running in system tray on close.</p>
                </div>
                <label className="vt-toggle">
                  <input type="checkbox" checked={minimizeToTray} onChange={e => handleToggleTray(e.target.checked)} />
                  <span className="vt-toggle-slider" />
                </label>
              </label>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[13px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Desktop Notifications</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Show alerts for session events.</p>
                </div>
                <label className="vt-toggle">
                  <input type="checkbox" checked={notifications} onChange={e => handleToggleNotifications(e.target.checked)} />
                  <span className="vt-toggle-slider" />
                </label>
              </label>
            </div>
          </div>

          {/* Data Management */}
          <div className="vt-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="vt-section-header text-[11px]">Data Management</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleExportData}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg cursor-pointer transition-colors group"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <FileDown className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
                <span className="text-[13px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Export</span>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Save as JSON</span>
              </button>
              <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg cursor-pointer transition-colors"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--success)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <FileUp className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
                <span className="text-[13px]" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Import</span>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Restore backup</span>
                <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
              </label>
            </div>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <button onClick={handleResetData} className="vt-btn-danger w-full cursor-pointer">
              <Trash2 className="w-4 h-4" /> Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
