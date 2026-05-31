import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Square, Clock, Gamepad, Edit3 } from 'lucide-react';

const hasElectron = typeof window !== 'undefined' && window.electron !== undefined;

export default function FloatingWidget() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');
  const name = searchParams.get('name') || 'Active Game';
  const coverArt = searchParams.get('cover') || '';

  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState('');

  // Sync timer tick from IPC
  useEffect(() => {
    if (hasElectron) {
      const unsubscribeTick = window.electron.process.onActiveSessionTick((data) => {
        setSeconds(data.elapsedSeconds);
      });
      return () => {
        unsubscribeTick();
      };
    } else {
      // Browser preview emulation
      const interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  // Save notes to localStorage whenever they change
  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNote(val);
    localStorage.setItem('active_session_note', val);
  };

  const handleStopTracking = () => {
    if (hasElectron) {
      window.electron.process.killGame(gameId);
    } else {
      alert("Mock tracking stop. Notes saved: " + note);
    }
  };

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

  return (
    <div 
      className="w-[340px] h-[180px] rounded-xl overflow-hidden flex flex-col justify-between p-3 select-none"
      style={{
        background: '#1e1b18',
        border: '2px solid #e07d45',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: '#f0ebe4',
      }}
    >
      {/* Title / Drag Area */}
      <div 
        className="flex items-center justify-between pb-1.5 shrink-0"
        style={{ WebkitAppRegion: 'drag', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0" style={{ WebkitAppRegion: 'no-drag' }}>
          <Gamepad className="w-3.5 h-3.5 vt-pulse-dot" style={{ color: '#e07d45' }} />
          <span 
            className="text-[11px] uppercase tracking-widest truncate max-w-[200px]"
            style={{ color: '#e07d45', fontWeight: 500 }}
          >
            {name}
          </span>
        </div>
        <span 
          className="text-[9px] uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-mono)', color: '#4a4540', fontWeight: 500 }}
        >
          Tracking
        </span>
      </div>

      {/* Main Stats */}
      <div className="flex-1 flex items-center justify-between gap-3 my-1">
        {coverArt && (
          <img 
            src={coverArt} 
            alt={name} 
            className="w-10 h-[52px] object-cover rounded shrink-0" 
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          />
        )}
        
        <div className="flex-1 flex flex-col justify-center">
          <p 
            className="text-[9px] uppercase tracking-wider flex items-center gap-1"
            style={{ color: '#4a4540', fontWeight: 500 }}
          >
            <Clock className="w-2.5 h-2.5" style={{ color: '#e07d45' }} />
            Active Session
          </p>
          <span 
            className="text-2xl tracking-widest leading-none mt-1"
            style={{ fontFamily: 'var(--font-mono)', color: '#e07d45', fontWeight: 500 }}
          >
            {formatTime(seconds)}
          </span>
        </div>

        <button 
          onClick={handleStopTracking}
          className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-[11px] uppercase tracking-wider cursor-pointer transition-colors shrink-0"
          style={{ 
            background: '#b85a5a', 
            color: '#fefefe', 
            fontWeight: 500,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#a04e4e'}
          onMouseLeave={e => e.currentTarget.style.background = '#b85a5a'}
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </button>
      </div>

      {/* Bottom Notes */}
      <div 
        className="flex items-center gap-2 pt-1.5 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Edit3 className="w-3.5 h-3.5 shrink-0" style={{ color: '#4a4540' }} />
        <input
          type="text"
          placeholder="Session notes..."
          value={note}
          onChange={handleNoteChange}
          className="w-full bg-transparent text-[11px] outline-none border-none"
          style={{ color: '#8a7f74' }}
        />
      </div>
    </div>
  );
}
