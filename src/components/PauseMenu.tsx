/**
 * @file PauseMenu.tsx
 * Pause and Settings Menu with game mode toggling, render distance, time of day slider,
 * sound volume controls, world persistence, standalone single-file HTML export, and controls guide.
 */

import React, { useState } from 'react';
import { Player } from '../core/player';
import { VoxelWorld } from '../core/world';
import { AudioManager } from '../core/audio';
import { generateStandaloneHtml } from '../core/standaloneExport';

interface PauseMenuProps {
  player: Player;
  world: VoxelWorld;
  timeOfDay: number;
  setTimeOfDay: (t: number) => void;
  onResume: () => void;
  onOpenResourcePacks: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  player,
  world,
  timeOfDay,
  setTimeOfDay,
  onResume,
  onOpenResourcePacks,
}) => {
  const audio = AudioManager.getInstance();
  const [renderDist, setRenderDist] = useState<number>(world.renderDistance);
  const [volume, setVolume] = useState<number>(audio.volume);
  const [isMuted, setIsMuted] = useState<boolean>(audio.isMuted);
  const [gameMode, setGameMode] = useState<'survival' | 'creative'>(player.gameMode);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const handleModeToggle = () => {
    const next = gameMode === 'survival' ? 'creative' : 'survival';
    setGameMode(next);
    player.gameMode = next;
    if (next === 'survival') player.isFlying = false;
  };

  const handleRenderDistChange = (val: number) => {
    setRenderDist(val);
    world.renderDistance = val;
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    audio.setVolume(val);
  };

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    audio.setMuted(next);
  };

  const handleSaveWorld = () => {
    world.saveToStorage();
    setSaveStatus('World & Inventories Saved to LocalStorage!');
    setTimeout(() => setSaveStatus(''), 2500);
    audio.playClick();
  };

  const handleLoadWorld = () => {
    const ok = world.loadFromStorage();
    setSaveStatus(ok ? 'World Loaded Successfully!' : 'No Saved World Found in Storage.');
    setTimeout(() => setSaveStatus(''), 2500);
    audio.playClick();
  };

  const handleDownloadStandalone = () => {
    audio.playItemPop();
    const html = generateStandaloneHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minecraft-standalone.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveStatus('Downloaded minecraft-standalone.html! Run directly by opening file.');
    setTimeout(() => setSaveStatus(''), 3500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4 font-mono select-none">
      <div className="bg-[#242424] border-4 border-[#444] rounded-lg p-6 max-w-lg w-full flex flex-col gap-4 text-white shadow-2xl">
        {/* Title */}
        <h1 className="text-xl font-bold text-center tracking-widest text-amber-300 drop-shadow uppercase">
          Game Paused
        </h1>

        {/* Primary Resume Button */}
        <button
          onClick={onResume}
          className="w-full bg-[#4a5568] hover:bg-[#5a6578] border-2 border-[#9ca3af] py-2.5 rounded font-bold text-sm tracking-wider transition-all hover:border-white"
        >
          Back to Game (Esc)
        </button>

        {/* Settings Cluster */}
        <div className="bg-[#1b1b1b] p-3 rounded border border-white/10 flex flex-col gap-3 text-xs">
          {/* Game Mode */}
          <div className="flex justify-between items-center">
            <span className="text-white/70">Game Mode:</span>
            <button
              onClick={handleModeToggle}
              className={`px-3 py-1 rounded font-bold uppercase ${
                gameMode === 'creative' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-700 hover:bg-emerald-600'
              }`}
            >
              {gameMode}
            </button>
          </div>

          {/* Render Distance */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-white/70">Render Distance:</span>
              <strong className="text-amber-300">{renderDist} Chunks</strong>
            </div>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={renderDist}
              onChange={(e) => handleRenderDistChange(Number(e.target.value))}
              className="accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Time of Day */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-white/70">Time of Day:</span>
              <strong className="text-amber-300">
                {timeOfDay < 0.25 ? 'Morning' : timeOfDay < 0.5 ? 'Noon' : timeOfDay < 0.75 ? 'Sunset' : 'Midnight'}
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(Number(e.target.value))}
              className="accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Master Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-white/70">Sound Volume:</span>
              <button
                onClick={handleMuteToggle}
                className="text-[10px] bg-neutral-700 hover:bg-neutral-600 px-2 py-0.5 rounded"
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Resource Pack & Standalone HTML Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenResourcePacks}
            className="bg-[#2d3748] hover:bg-[#3d4758] border border-white/20 py-2 rounded text-xs font-bold text-center transition-colors"
          >
            📦 Resource Packs...
          </button>

          <button
            onClick={handleDownloadStandalone}
            className="bg-amber-700/80 hover:bg-amber-600 border border-amber-400/50 py-2 rounded text-xs font-bold text-center text-amber-100 transition-colors"
          >
            💾 Download Standalone HTML
          </button>
        </div>

        {/* Save / Load World */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSaveWorld}
            className="bg-neutral-700 hover:bg-neutral-600 border border-white/20 py-1.5 rounded text-xs font-bold transition-colors"
          >
            Save World
          </button>
          <button
            onClick={handleLoadWorld}
            className="bg-neutral-700 hover:bg-neutral-600 border border-white/20 py-1.5 rounded text-xs font-bold transition-colors"
          >
            Load World
          </button>
        </div>

        {saveStatus && (
          <div className="text-xs text-amber-300 text-center font-bold bg-amber-950/40 p-1.5 rounded border border-amber-500/30">
            {saveStatus}
          </div>
        )}

        {/* Controls Guide */}
        <div className="text-[10px] text-white/50 leading-relaxed bg-black/40 p-2.5 rounded border border-white/5">
          <strong className="text-white/80">Controls:</strong> WASD move · Mouse look · Space jump/swim · Double-tap Space to fly in creative · Left click mine/attack · Right click place/interact · 1-9 hotbar · E inventory · F3 debug · Esc pause.
        </div>
      </div>
    </div>
  );
};
