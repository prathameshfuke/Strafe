import React from 'react';
import { useSessionStore } from '../stores/sessionStore';

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const SessionTimer = () => {
  const { activeSession, elapsed } = useSessionStore();

  if (!activeSession) return null;

  return (
    <div 
      className="session-timer flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all"
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent-border)',
        color: 'var(--accent)'
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
      <span className="timer-display vt-mono">
        {formatTime(elapsed)}
      </span>
    </div>
  );
};
