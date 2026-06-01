import React, { useState } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { Gamepad2, Upload, User, Sparkles } from 'lucide-react';
import logoImg from '../../logo.png';
import iconImg from '../../icon.png';

export default function Login() {
  const { updateProfile, setOnboarded } = useGameStore();

  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [favGenre, setFavGenre] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [errors, setErrors] = useState({});

  const handleAvatarFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Player name is required';
    }

    if (age && (isNaN(age) || parseInt(age) <= 0)) {
      newErrors.age = 'Please enter a valid age';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save profile details
    await updateProfile(
      username.trim(),
      avatar,
      bio.trim() || 'Ready to play.',
      age ? parseInt(age) : 0,
      favGenre.trim() || 'All-Rounder'
    );

    // Set onboarded to transition application shell
    await setOnboarded(true);
  };

  return (
    <div 
      className="w-full max-w-md p-8 rounded-2xl flex flex-col gap-6"
      style={{ 
        background: 'var(--bg-surface)', 
        border: '1px solid var(--border-strong)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)' 
      }}
    >
      {/* 16:9 Logo Banner */}
      <div className="w-full aspect-[16/9] rounded-xl overflow-hidden shrink-0 relative" style={{ border: '1px solid var(--border)' }}>
        <img src={logoImg} alt="STRAFE Banner" className="w-full h-full object-cover" />
        <span 
          className="absolute bottom-2 right-2 p-1.5 rounded-full flex items-center justify-center shadow-md animate-pulse"
          style={{ background: 'var(--accent)', color: '#fefefe' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </span>
      </div>

      <div className="text-center">
        <h2 
          className="text-2xl tracking-tight"
          style={{ 
            fontFamily: 'var(--font-display)', 
            fontStyle: 'italic', 
            color: 'var(--text-primary)' 
          }}
        >
          Welcome to STRAFE
        </h2>
        <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          Initialize your local player profile. All stats and game libraries remain completely stored on your machine.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Avatar Selection */}
        <div className="flex items-center gap-4 py-2 justify-center">
          <div 
            className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl shrink-0" 
            style={{ 
              background: 'var(--bg-hover)', 
              color: 'var(--accent)', 
              fontWeight: 500,
              border: '2px solid var(--border-strong)'
            }}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
            ) : (
              username ? username.slice(0, 2).toUpperCase() : <User className="w-6 h-6" />
            )}
          </div>
          <label className="vt-btn-secondary cursor-pointer text-[13px] h-9 px-3">
            <Upload className="w-3.5 h-3.5" /> Upload Avatar
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
          </label>
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1">
          <label className="vt-section-header text-[11px] block">Player Name</label>
          <input 
            type="text" 
            placeholder="e.g. Viper_Gamer" 
            value={username} 
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) setErrors(prev => ({ ...prev, username: null }));
            }} 
            className="vt-input"
            style={errors.username ? { borderColor: 'var(--danger)' } : {}}
          />
          {errors.username && (
            <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{errors.username}</p>
          )}
        </div>

        {/* Age and Genre */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="vt-section-header text-[11px] block">Age</label>
            <input 
              type="number" 
              placeholder="e.g. 24" 
              value={age} 
              onChange={(e) => {
                setAge(e.target.value);
                if (errors.age) setErrors(prev => ({ ...prev, age: null }));
              }} 
              className="vt-input"
              style={errors.age ? { borderColor: 'var(--danger)' } : {}}
            />
            {errors.age && (
              <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{errors.age}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="vt-section-header text-[11px] block">Favorite Genre</label>
            <input 
              type="text" 
              placeholder="e.g. RPG, Action" 
              value={favGenre} 
              onChange={(e) => setFavGenre(e.target.value)} 
              className="vt-input"
            />
          </div>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1">
          <label className="vt-section-header text-[11px] block">Bio / Player Motto</label>
          <textarea 
            placeholder="A short description about your gaming style..." 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            rows={3} 
            className="vt-textarea"
          />
        </div>

        {/* Submit */}
        <button 
          type="submit" 
          className="vt-btn-primary w-full h-11 text-[15px] mt-2 cursor-pointer font-medium"
        >
          Enter the Vault
        </button>
      </form>
    </div>
  );
}
