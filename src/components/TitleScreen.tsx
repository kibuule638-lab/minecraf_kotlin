/**
 * @file TitleScreen.tsx
 * Full-viewport Title Screen with bespoke Minecraft pixel title lockup,
 * seed selector, primary Start CTA, resource pack access, and single-file HTML download.
 */

import React, { useState } from 'react';
import { AudioManager } from '../core/audio';
import { generateStandaloneHtml } from '../core/standaloneExport';

interface TitleScreenProps {
  onStartGame: (seed: number, mode: 'survival' | 'creative') => void;
  onOpenResourcePacks: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenResourcePacks,
}) => {
  const [seed, setSeed] = useState<number>(4242);
  const [selectedMode, setSelectedMode] = useState<'survival' | 'creative'>('survival');
  const [downloadMsg, setDownloadMsg] = useState<string>('');

  const handleStart = () => {
    AudioManager.getInstance().playClick();
    onStartGame(seed, selectedMode);
  };

  const handleDownloadStandalone = () => {
    AudioManager.getInstance().playItemPop();
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
    setDownloadMsg('Downloaded minecraft-standalone.html (Runs offline without build tools!)');
    setTimeout(() => setDownloadMsg(''), 4000);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-8 font-mono select-none bg-black/60 pointer-events-auto">
      {/* 1. Top Title Lockup with 35% Negative Space */}
      <div className="flex flex-col items-center mt-8">
        {/* Bespoke Minecraft Logo Lockup */}
        <div className="relative flex flex-col items-center">
          <div className="text-4xl sm:text-5xl md:text-6xl font-black tracking-widest text-[#d8d8d8] drop-shadow-[0_6px_0_#383838] uppercase font-['Silkscreen']">
            MINECRAFT
          </div>
          <div className="text-base sm:text-lg font-bold tracking-widest text-[#5bb534] drop-shadow-[0_2px_0_#1e4710] -mt-1 uppercase">
            WEB BROWSER EDITION
          </div>

          {/* Yellow Retro Splash Text */}
          <div className="absolute -bottom-4 -right-10 rotate-[-12deg] text-yellow-300 font-bold text-xs sm:text-sm drop-shadow-[0_2px_0_#755a00] animate-bounce">
            Now with Greedy Meshing!
          </div>
        </div>
      </div>

      {/* 2. Central Action Menu */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded border border-white/10 text-xs">
          <button
            onClick={() => setSelectedMode('survival')}
            className={`py-1.5 rounded font-bold transition-all ${
              selectedMode === 'survival'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            ⚔️ Survival Mode
          </button>
          <button
            onClick={() => setSelectedMode('creative')}
            className={`py-1.5 rounded font-bold transition-all ${
              selectedMode === 'creative'
                ? 'bg-amber-600 text-white shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            🪽 Creative Mode
          </button>
        </div>

        {/* Seed Input */}
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded border border-white/10 text-xs">
          <span className="text-white/60">World Seed:</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            className="flex-1 bg-transparent text-amber-300 font-bold outline-none"
          />
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 999999))}
            className="text-[10px] text-white/50 hover:text-white"
          >
            🎲 Random
          </button>
        </div>

        {/* Primary Start CTA */}
        <button
          onClick={handleStart}
          className="w-full bg-[#4a5568] hover:bg-[#5a6578] border-2 border-[#a0aec0] hover:border-white text-white font-bold py-3 rounded text-sm tracking-widest drop-shadow transition-transform active:scale-95 cursor-pointer uppercase"
        >
          Singleplayer (Play World)
        </button>

        {/* Resource Pack Button */}
        <button
          onClick={onOpenResourcePacks}
          className="w-full bg-[#2d3748] hover:bg-[#3d4758] border border-white/20 text-white font-bold py-2 rounded text-xs tracking-wider transition-colors cursor-pointer"
        >
          📦 Resource Packs (.zip loader)
        </button>

        {/* Download Standalone HTML Button */}
        <button
          onClick={handleDownloadStandalone}
          className="w-full bg-amber-800/80 hover:bg-amber-700 border border-amber-400/50 text-amber-100 font-bold py-2 rounded text-xs tracking-wider transition-colors cursor-pointer"
        >
          💾 Download Standalone Single-File .html
        </button>

        {downloadMsg && (
          <div className="text-[11px] text-emerald-300 text-center font-bold bg-emerald-950/60 p-1.5 rounded border border-emerald-500/30">
            {downloadMsg}
          </div>
        )}
      </div>

      {/* 3. Flat Control-Hint Line */}
      <div className="text-center text-xs text-white/60 tracking-wide font-mono">
        WASD Move · Space Jump · Left-Click Mine · Right-Click Place · E Inventory · Esc Pause
      </div>
    </div>
  );
};
