/**
 * @file App.tsx
 * Master Game Shell orchestrator managing state transitions:
 * Title Screen -> Playing -> Pause / Inventory / Container / Death Screen.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Player } from './core/player';
import { VoxelWorld } from './core/world';
import { MobManager } from './core/mobs';
import { RedstoneSystem } from './core/redstone';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { TitleScreen } from './components/TitleScreen';
import { PauseMenu } from './components/PauseMenu';
import { InventoryModal, InventoryMode } from './components/InventoryModal';
import { ResourcePackModal } from './components/ResourcePackModal';
import { AudioManager } from './core/audio';

type GameState = 'title' | 'playing' | 'paused' | 'inventory' | 'resource_pack' | 'dead';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [inventoryMode, setInventoryMode] = useState<InventoryMode>('player');
  const [containerPos, setContainerPos] = useState<{ x: number; y: number; z: number } | null>(null);

  // Settings & World State
  const [seed, setSeed] = useState<number>(4242);
  const [gameMode, setGameMode] = useState<'survival' | 'creative'>('survival');
  const [timeOfDay, setTimeOfDay] = useState<number>(0.2); // Start morning
  const [fps, setFps] = useState<number>(60);
  const [biome, setBiome] = useState<string>('Plains');
  const [loadedChunks, setLoadedChunks] = useState<number>(0);
  const [showF3, setShowF3] = useState<boolean>(false);

  // Shared Core References
  const playerRef = useRef<Player | null>(null);
  const worldRef = useRef<VoxelWorld | null>(null);
  const mobManagerRef = useRef<MobManager | null>(null);
  const redstoneRef = useRef<RedstoneSystem | null>(null);

  // Check death state in survival
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.isDead && gameState === 'playing') {
        setGameState('dead');
      }
    }, 200);
    return () => clearInterval(interval);
  }, [gameState]);

  // F3 Key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'F3') {
        e.preventDefault();
        setShowF3((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleStartGame = (chosenSeed: number, chosenMode: 'survival' | 'creative') => {
    setSeed(chosenSeed);
    setGameMode(chosenMode);
    setGameState('playing');
  };

  const handleOpenInventory = (mode: InventoryMode = 'player', pos: { x: number; y: number; z: number } | null = null) => {
    setInventoryMode(mode);
    setContainerPos(pos);
    setGameState('inventory');
    document.exitPointerLock?.();
  };

  const handleRespawn = () => {
    if (playerRef.current) {
      playerRef.current.respawn();
      setGameState('playing');
      AudioManager.getInstance().playClick();
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-mono">
      {/* 1. Underlying 3D WebGL Canvas (Stays mounted so scene is continuous) */}
      <GameCanvas
        playerRef={playerRef}
        worldRef={worldRef}
        mobManagerRef={mobManagerRef}
        redstoneRef={redstoneRef}
        seed={seed}
        gameMode={gameMode}
        isPlaying={gameState === 'playing'}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        setFps={setFps}
        setBiome={setBiome}
        setLoadedChunks={setLoadedChunks}
        onOpenInventory={() => handleOpenInventory('player')}
        onOpenCrafting={() => handleOpenInventory('crafting')}
        onOpenFurnace={(pos) => handleOpenInventory('furnace', pos)}
        onOpenChest={(pos) => handleOpenInventory('chest', pos)}
        onPause={() => {
          if (gameState === 'playing') setGameState('paused');
        }}
      />

      {/* 2. Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenResourcePacks={() => setGameState('resource_pack')}
        />
      )}

      {/* 3. Playing HUD Overlay */}
      {gameState === 'playing' && playerRef.current && (
        <HUD
          player={playerRef.current}
          fps={fps}
          biome={biome}
          loadedChunks={loadedChunks}
          showF3={showF3}
        />
      )}

      {/* 4. Pause Menu */}
      {gameState === 'paused' && playerRef.current && worldRef.current && (
        <PauseMenu
          player={playerRef.current}
          world={worldRef.current}
          timeOfDay={timeOfDay}
          setTimeOfDay={setTimeOfDay}
          onResume={() => setGameState('playing')}
          onOpenResourcePacks={() => setGameState('resource_pack')}
        />
      )}

      {/* 5. Inventory / Crafting Table / Furnace / Chest Modal */}
      {gameState === 'inventory' && playerRef.current && worldRef.current && (
        <InventoryModal
          mode={inventoryMode}
          player={playerRef.current}
          world={worldRef.current}
          containerPos={containerPos}
          onClose={() => setGameState('playing')}
        />
      )}

      {/* 6. Resource Pack Loader Modal */}
      {gameState === 'resource_pack' && (
        <ResourcePackModal
          onClose={() => setGameState(playerRef.current ? 'playing' : 'title')}
        />
      )}

      {/* 7. Death Screen */}
      {gameState === 'dead' && (
        <div className="fixed inset-0 bg-red-950/70 z-50 flex flex-col items-center justify-center gap-6 select-none font-mono">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl sm:text-5xl font-black text-red-500 tracking-widest drop-shadow-[0_4px_4px_#000] uppercase font-['Silkscreen']">
              You Died!
            </h1>
            <p className="text-sm text-white/80 mt-2 font-bold">
              Score: <span className="text-yellow-400">0</span>
            </p>
          </div>

          <button
            onClick={handleRespawn}
            className="bg-[#4b5563] hover:bg-[#6b7280] border-2 border-white px-8 py-3 rounded font-bold text-sm tracking-wider text-white shadow-2xl transition-transform active:scale-95 cursor-pointer uppercase"
          >
            Respawn
          </button>
        </div>
      )}
    </div>
  );
}
