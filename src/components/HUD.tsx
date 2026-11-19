/**
 * @file HUD.tsx
 * Authentic Minecraft HUD with pixelated health hearts, hunger drumsticks,
 * air bubbles, hotbar with active selector, item tooltip, and F3 debug screen.
 */

import React, { useEffect, useState } from 'react';
import { Player } from '../core/player';
import { ITEM_REGISTRY } from '../core/items';
import { TextureManager } from '../core/textures';

interface HUDProps {
  player: Player;
  fps: number;
  biome: string;
  loadedChunks: number;
  showF3: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  player,
  fps,
  biome,
  loadedChunks,
  showF3,
}) => {
  const [tooltip, setTooltip] = useState<string>('');
  const [tooltipOpacity, setTooltipOpacity] = useState<number>(0);

  // Active item tooltip popup on slot change
  useEffect(() => {
    const activeItem = player.getActiveItem();
    if (activeItem) {
      const def = ITEM_REGISTRY[activeItem.id];
      setTooltip(def ? def.name : activeItem.id);
      setTooltipOpacity(1);
      const timer = setTimeout(() => setTooltipOpacity(0), 1600);
      return () => clearTimeout(timer);
    } else {
      setTooltipOpacity(0);
    }
  }, [player.activeSlot, player.hotbar[player.activeSlot]]);

  // Calculate health hearts (10 hearts total, half-heart support)
  const hearts = [];
  const hp = Math.max(0, player.health);
  for (let i = 0; i < 10; i++) {
    const val = hp - i * 2;
    if (val >= 2) hearts.push('full');
    else if (val >= 1) hearts.push('half');
    else hearts.push('empty');
  }

  // Calculate hunger drumsticks
  const drumsticks = [];
  const hg = Math.max(0, player.hunger);
  for (let i = 0; i < 10; i++) {
    const val = hg - i * 2;
    if (val >= 2) drumsticks.push('full');
    else if (val >= 1) drumsticks.push('half');
    else drumsticks.push('empty');
  }

  // Air bubbles (when underwater)
  const bubbles = Math.ceil(Math.max(0, player.air) / 30);

  const getFacing = (yaw: number): string => {
    const deg = (((yaw * 180) / Math.PI) % 360 + 360) % 360;
    if (deg >= 315 || deg < 45) return 'South (+Z)';
    if (deg >= 45 && deg < 135) return 'West (-X)';
    if (deg >= 135 && deg < 225) return 'North (-Z)';
    return 'East (+X)';
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-3 font-mono">
      {/* 1. F3 Debug Screen */}
      {showF3 && (
        <div className="bg-black/60 p-2 text-xs text-white max-w-sm rounded border border-white/20 leading-relaxed font-mono">
          <div className="text-yellow-400 font-bold mb-1">Minecraft Web (Three.js Engine)</div>
          <div>FPS: <span className="text-emerald-400 font-bold">{fps}</span></div>
          <div>
            XYZ: {player.position.x.toFixed(1)} / {player.position.y.toFixed(1)} / {player.position.z.toFixed(1)}
          </div>
          <div>Facing: {getFacing(player.yaw)}</div>
          <div>Biome: <span className="text-cyan-400">{biome}</span></div>
          <div>Chunks Loaded: {loadedChunks}</div>
          <div>Mode: <span className="uppercase text-amber-300">{player.gameMode}</span> {player.isFlying ? '(Flying)' : ''}</div>
          <div className="text-white/60 text-[10px] mt-1">Press F3 to close debug info</div>
        </div>
      )}

      {/* Crosshair (Center) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
        <div className="absolute top-[7px] left-0 w-4 h-[2px] bg-white/90 shadow-[0_0_1px_#000]" />
        <div className="absolute top-0 left-[7px] w-[2px] h-4 bg-white/90 shadow-[0_0_1px_#000]" />
      </div>

      {/* 2. Bottom HUD Stack: Hearts, Hunger, Bubbles, Tooltip, Hotbar */}
      <div className="w-full flex flex-col items-center gap-1.5 pb-2">
        {/* Item Name Tooltip */}
        <div
          className="text-sm font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)] transition-opacity duration-300"
          style={{ opacity: tooltipOpacity }}
        >
          {tooltip}
        </div>

        {/* Air Bubbles when underwater */}
        {player.inWater && player.air < 300 && (
          <div className="flex gap-1 mb-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={`text-sm ${i < bubbles ? 'text-cyan-300 drop-shadow-[0_1px_1px_#000]' : 'opacity-0'}`}
              >
                🫧
              </span>
            ))}
          </div>
        )}

        {/* Survival Status Cluster: Hearts & Hunger */}
        {player.gameMode === 'survival' && (
          <div className="flex justify-between w-[380px] max-w-full px-2 mb-1">
            {/* Hearts Row */}
            <div className="flex gap-0.5">
              {hearts.map((h, i) => (
                <span key={i} className="text-base leading-none drop-shadow-[0_1px_1px_#000]">
                  {h === 'full' ? '❤️' : h === 'half' ? '💔' : '🖤'}
                </span>
              ))}
            </div>

            {/* Hunger Drumsticks Row */}
            <div className="flex gap-0.5 flex-row-reverse">
              {drumsticks.map((d, i) => (
                <span key={i} className="text-base leading-none drop-shadow-[0_1px_1px_#000]">
                  {d === 'full' ? '🍗' : d === 'half' ? '🍖' : '🦴'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hotbar (9 Slots) */}
        <div className="flex gap-1 p-1 bg-[#181818]/85 border-2 border-[#3c3c3c] rounded shadow-2xl pointer-events-auto">
          {player.hotbar.map((slot, index) => {
            const isActive = player.activeSlot === index;
            const def = slot ? ITEM_REGISTRY[slot.id] : null;

            return (
              <div
                key={index}
                onClick={() => player.setActiveSlot(index)}
                className={`w-11 h-11 border-2 flex flex-col items-center justify-center relative cursor-pointer select-none transition-transform ${
                  isActive
                    ? 'border-white bg-[#444] scale-105 z-10 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                    : 'border-[#2e2e2e] bg-[#222] hover:bg-[#2a2a2a]'
                }`}
              >
                {/* Hotbar Slot Number Hint */}
                <span className="absolute top-0.5 left-1 text-[9px] text-white/40">
                  {index + 1}
                </span>

                {/* Slot Item Icon or Label */}
                {slot && def && (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-center px-0.5 text-white drop-shadow">
                      {def.name.slice(0, 4)}
                    </span>
                  </div>
                )}

                {/* Stack Count */}
                {slot && slot.count > 1 && (
                  <span className="absolute bottom-0.5 right-1 text-xs font-bold text-white drop-shadow-[1px_1px_0_#000]">
                    {slot.count}
                  </span>
                )}

                {/* Tool Durability Bar */}
                {slot && slot.durability !== undefined && def?.durability && (
                  <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-black/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.max(0, Math.min(100, (slot.durability / def.durability) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
