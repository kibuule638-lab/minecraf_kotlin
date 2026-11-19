/**
 * @file InventoryModal.tsx
 * Full Minecraft inventory GUI with:
 * - 2x2 Player Pocket Crafting
 * - 3x3 Crafting Table GUI
 * - Furnace GUI with fuel burning & smelting progress
 * - Chest GUI with 27-slot container storage
 */

import React, { useState, useEffect } from 'react';
import { Player } from '../core/player';
import { VoxelWorld } from '../core/world';
import { ItemStack } from '../types/voxel';
import { ITEM_REGISTRY } from '../core/items';
import { findMatchingRecipe, SMELTING_RECIPES, FUEL_VALUES } from '../core/crafting';
import { AudioManager } from '../core/audio';

export type InventoryMode = 'player' | 'crafting' | 'furnace' | 'chest';

interface InventoryModalProps {
  mode: InventoryMode;
  player: Player;
  world: VoxelWorld;
  containerPos?: { x: number; y: number; z: number } | null;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  mode,
  player,
  world,
  containerPos,
  onClose,
}) => {
  // Hand cursor held item stack
  const [cursorItem, setCursorItem] = useState<ItemStack | null>(null);

  // Crafting grid state (2x2 for player pocket crafting, 3x3 for crafting table)
  const gridSize = mode === 'crafting' ? 3 : 2;
  const [craftingGrid, setCraftingGrid] = useState<(ItemStack | null)[]>(
    new Array(gridSize * gridSize).fill(null)
  );
  const [craftResult, setCraftResult] = useState<ItemStack | null>(null);

  // Furnace state
  const [furnaceInput, setFurnaceInput] = useState<ItemStack | null>(null);
  const [furnaceFuel, setFurnaceFuel] = useState<ItemStack | null>(null);
  const [furnaceOutput, setFurnaceOutput] = useState<ItemStack | null>(null);
  const [burnTime, setBurnTime] = useState<number>(0);
  const [maxBurnTime, setMaxBurnTime] = useState<number>(0);
  const [cookProgress, setCookProgress] = useState<number>(0);

  // Chest slots (27 items)
  const [chestSlots, setChestSlots] = useState<(ItemStack | null)[]>(new Array(27).fill(null));

  // Initialize container data if opening Chest or Furnace
  useEffect(() => {
    if (mode === 'chest' && containerPos) {
      const key = `${containerPos.x},${containerPos.y},${containerPos.z}`;
      const saved = world.chestStorage.get(key);
      if (saved) {
        setChestSlots([...saved]);
      } else {
        const fresh = new Array(27).fill(null);
        world.chestStorage.set(key, fresh);
        setChestSlots(fresh);
      }
    } else if (mode === 'furnace' && containerPos) {
      const key = `${containerPos.x},${containerPos.y},${containerPos.z}`;
      const saved = world.furnaceStorage.get(key);
      if (saved) {
        setFurnaceInput(saved.input);
        setFurnaceFuel(saved.fuel);
        setFurnaceOutput(saved.output);
        setBurnTime(saved.burnTime);
        setMaxBurnTime(saved.maxBurnTime);
        setCookProgress(saved.cookProgress);
      }
    }
  }, [mode, containerPos]);

  // Recalculate craft output whenever crafting grid changes
  useEffect(() => {
    if (mode === 'player' || mode === 'crafting') {
      const result = findMatchingRecipe(craftingGrid, gridSize);
      setCraftResult(result);
    }
  }, [craftingGrid, mode, gridSize]);

  // Furnace smelting tick loop
  useEffect(() => {
    if (mode !== 'furnace') return;

    const interval = setInterval(() => {
      setBurnTime((prevBurn) => {
        let newBurn = prevBurn;

        // Consume fuel if furnace is out of fire and there is smeltable input
        if (newBurn <= 0 && furnaceInput && furnaceInput.count > 0) {
          const smeltRecipe = SMELTING_RECIPES.find((r) => r.input === furnaceInput.id);
          if (smeltRecipe && furnaceFuel && furnaceFuel.count > 0) {
            const fuelVal = FUEL_VALUES[furnaceFuel.id];
            if (fuelVal) {
              newBurn = fuelVal * 10;
              setMaxBurnTime(fuelVal * 10);
              // Decrement fuel
              const updatedFuel = { ...furnaceFuel };
              updatedFuel.count--;
              setFurnaceFuel(updatedFuel.count > 0 ? updatedFuel : null);
            }
          }
        }

        if (newBurn > 0) {
          newBurn = Math.max(0, newBurn - 1);

          // Advance cook progress
          if (furnaceInput && furnaceInput.count > 0) {
            const smeltRecipe = SMELTING_RECIPES.find((r) => r.input === furnaceInput.id);
            if (smeltRecipe) {
              setCookProgress((prevCook) => {
                const nextCook = prevCook + 2;
                if (nextCook >= 100) {
                  // Finish smelt
                  setFurnaceInput((prevInput) => {
                    if (!prevInput) return null;
                    const dec = { ...prevInput };
                    dec.count--;
                    return dec.count > 0 ? dec : null;
                  });

                  setFurnaceOutput((prevOut) => {
                    if (!prevOut) return { ...smeltRecipe.result };
                    return { ...prevOut, count: prevOut.count + smeltRecipe.result.count };
                  });

                  AudioManager.getInstance().playItemPop();
                  return 0;
                }
                return nextCook;
              });
            } else {
              setCookProgress(0);
            }
          } else {
            setCookProgress(0);
          }
        } else {
          setCookProgress(0);
        }

        return newBurn;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [mode, furnaceInput, furnaceFuel, furnaceOutput]);

  // Persist chest / furnace back to world on close
  const handleClose = () => {
    if (cursorItem) {
      // Put cursor item back into inventory or drop it
      player.addItem(cursorItem);
      setCursorItem(null);
    }

    if (mode === 'chest' && containerPos) {
      const key = `${containerPos.x},${containerPos.y},${containerPos.z}`;
      world.chestStorage.set(key, [...chestSlots]);
    } else if (mode === 'furnace' && containerPos) {
      const key = `${containerPos.x},${containerPos.y},${containerPos.z}`;
      world.furnaceStorage.set(key, {
        input: furnaceInput,
        fuel: furnaceFuel,
        output: furnaceOutput,
        burnTime,
        maxBurnTime,
        cookProgress,
      });
    }

    onClose();
  };

  /**
   * Universal Slot Click handler
   */
  const handleSlotClick = (
    currentSlot: ItemStack | null,
    setSlot: (item: ItemStack | null) => void,
    isCraftOutput = false
  ) => {
    AudioManager.getInstance().playClick();

    if (isCraftOutput) {
      if (!currentSlot) return;
      // Player crafted an item!
      if (!cursorItem) {
        setCursorItem({ ...currentSlot });
        consumeCraftGrid();
      } else if (cursorItem.id === currentSlot.id) {
        const itemDef = ITEM_REGISTRY[cursorItem.id];
        const max = itemDef?.maxStack ?? 64;
        if (cursorItem.count + currentSlot.count <= max) {
          cursorItem.count += currentSlot.count;
          consumeCraftGrid();
        }
      }
      return;
    }

    // Normal Slot Interaction
    if (!cursorItem) {
      if (currentSlot) {
        // Pick up stack
        setCursorItem(currentSlot);
        setSlot(null);
      }
    } else {
      if (!currentSlot) {
        // Place held stack into empty slot
        setSlot(cursorItem);
        setCursorItem(null);
      } else if (currentSlot.id === cursorItem.id) {
        // Merge identical items
        const itemDef = ITEM_REGISTRY[cursorItem.id];
        const max = itemDef?.maxStack ?? 64;
        const available = max - currentSlot.count;
        if (available > 0) {
          const moveCount = Math.min(cursorItem.count, available);
          currentSlot.count += moveCount;
          cursorItem.count -= moveCount;
          if (cursorItem.count <= 0) setCursorItem(null);
          setSlot({ ...currentSlot });
        }
      } else {
        // Swap different items
        const temp = currentSlot;
        setSlot(cursorItem);
        setCursorItem(temp);
      }
    }
  };

  /**
   * Consume 1 item from each non-empty crafting grid cell
   */
  const consumeCraftGrid = () => {
    const next = craftingGrid.map((slot) => {
      if (!slot) return null;
      const count = slot.count - 1;
      return count > 0 ? { ...slot, count } : null;
    });
    setCraftingGrid(next);
  };

  const renderSlot = (
    item: ItemStack | null,
    onSlotClick: () => void,
    isOutput = false
  ) => {
    const def = item ? ITEM_REGISTRY[item.id] : null;
    return (
      <div
        onClick={onSlotClick}
        className={`w-10 h-10 border-2 border-[#373737] bg-[#1e1e1e] hover:border-[#888] flex items-center justify-center relative cursor-pointer select-none transition-colors ${
          isOutput ? 'w-12 h-12 border-amber-500/80 bg-[#252525]' : ''
        }`}
      >
        {item && def && (
          <span className="text-[11px] font-bold text-center text-white px-0.5 leading-tight">
            {def.name.slice(0, 4)}
          </span>
        )}
        {item && item.count > 1 && (
          <span className="absolute bottom-0.5 right-1 text-[11px] font-bold text-white drop-shadow-[1px_1px_0_#000]">
            {item.count}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center font-mono select-none">
      <div className="bg-[#2b2b2b] border-4 border-[#4f4f4f] p-4 rounded-lg shadow-2xl flex flex-col gap-4 text-white max-w-lg w-full relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/20 pb-2">
          <h2 className="font-bold text-sm tracking-wide text-amber-300 uppercase">
            {mode === 'player' && 'Crafting & Inventory'}
            {mode === 'crafting' && '3x3 Crafting Table'}
            {mode === 'furnace' && 'Furnace'}
            {mode === 'chest' && 'Large Wooden Chest'}
          </h2>
          <button
            onClick={handleClose}
            className="text-xs bg-red-600/80 hover:bg-red-500 px-2 py-0.5 rounded font-bold"
          >
            ✕ (Close E)
          </button>
        </div>

        {/* 1. Crafting Top Area (Pocket or Crafting Table) */}
        {(mode === 'player' || mode === 'crafting') && (
          <div className="flex items-center justify-center gap-6 bg-[#1f1f1f] p-3 rounded border border-white/10">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              }}
            >
              {craftingGrid.map((slot, i) =>
                renderSlot(slot, () =>
                  handleSlotClick(
                    slot,
                    (newSlot) => {
                      const updated = [...craftingGrid];
                      updated[i] = newSlot;
                      setCraftingGrid(updated);
                    }
                  )
                )
              )}
            </div>

            <div className="text-xl text-white/50">➜</div>

            {/* Crafting Result Slot */}
            <div>{renderSlot(craftResult, () => handleSlotClick(craftResult, () => {}, true), true)}</div>
          </div>
        )}

        {/* 2. Furnace Area */}
        {mode === 'furnace' && (
          <div className="flex items-center justify-around bg-[#1f1f1f] p-4 rounded border border-white/10">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-white/60">Input Ore</span>
              {renderSlot(furnaceInput, () => handleSlotClick(furnaceInput, setFurnaceInput))}
              
              {/* Animated Fire Flame */}
              <div className="text-sm">
                {burnTime > 0 ? (
                  <span className="text-amber-500 animate-pulse">🔥 Burn</span>
                ) : (
                  <span className="text-white/20">🔥 Off</span>
                )}
              </div>

              <span className="text-[10px] text-white/60">Fuel (Coal/Wood)</span>
              {renderSlot(furnaceFuel, () => handleSlotClick(furnaceFuel, setFurnaceFuel))}
            </div>

            {/* Cook Progress Bar */}
            <div className="flex flex-col items-center gap-1 w-24">
              <span className="text-[10px] text-amber-300 font-bold">Smelting {cookProgress}%</span>
              <div className="w-full h-3 bg-black/60 rounded border border-white/20 overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${cookProgress}%` }} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-white/60">Output</span>
              {renderSlot(furnaceOutput, () => handleSlotClick(furnaceOutput, setFurnaceOutput), true)}
            </div>
          </div>
        )}

        {/* 3. Chest Area (27 Slots) */}
        {mode === 'chest' && (
          <div className="bg-[#1f1f1f] p-3 rounded border border-white/10">
            <div className="text-xs text-white/60 mb-1">Chest Storage (27 Slots)</div>
            <div className="grid grid-cols-9 gap-1">
              {chestSlots.map((slot, i) =>
                renderSlot(slot, () =>
                  handleSlotClick(slot, (newSlot) => {
                    const next = [...chestSlots];
                    next[i] = newSlot;
                    setChestSlots(next);
                  })
                )
              )}
            </div>
          </div>
        )}

        {/* 4. Player Main Inventory (27 Slots) */}
        <div className="bg-[#1f1f1f] p-3 rounded border border-white/10">
          <div className="text-xs text-white/60 mb-1">Player Inventory</div>
          <div className="grid grid-cols-9 gap-1">
            {player.inventory.map((slot, i) =>
              renderSlot(slot, () =>
                handleSlotClick(slot, (newSlot) => {
                  player.inventory[i] = newSlot;
                })
              )
            )}
          </div>
        </div>

        {/* 5. Player Hotbar (9 Slots) */}
        <div className="bg-[#1f1f1f] p-3 rounded border border-white/10">
          <div className="text-xs text-white/60 mb-1">Hotbar</div>
          <div className="grid grid-cols-9 gap-1">
            {player.hotbar.map((slot, i) =>
              renderSlot(slot, () =>
                handleSlotClick(slot, (newSlot) => {
                  player.hotbar[i] = newSlot;
                })
              )
            )}
          </div>
        </div>

        {/* Held Cursor Item following mouse cursor */}
        {cursorItem && (
          <div className="text-xs text-center text-amber-300 bg-black/80 py-1 px-2 rounded border border-amber-400">
            Held in Hand: <span className="font-bold">{cursorItem.id}</span> (x{cursorItem.count}) — click slot to place
          </div>
        )}
      </div>
    </div>
  );
};
