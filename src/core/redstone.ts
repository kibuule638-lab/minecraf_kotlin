/**
 * @file redstone.ts
 * Redstone mechanics: power sources (lever, redstone torch), wire propagation,
 * signal falloff (15 to 0), and redstone lamp activation.
 * Also includes clearly marked STUB hooks for stretch dimension and enchanting systems.
 */

import { BlockType } from '../types/voxel';
import { VoxelWorld } from './world';

export class RedstoneSystem {
  public world: VoxelWorld;
  private powerLevels: Map<string, number> = new Map();

  constructor(world: VoxelWorld) {
    this.world = world;
  }

  private getKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  /**
   * Toggle a lever at (x, y, z)
   */
  public toggleLever(x: number, y: number, z: number) {
    const key = this.getKey(x, y, z);
    const currentPower = this.powerLevels.get(key) || 0;
    const newPower = currentPower > 0 ? 0 : 15;
    this.powerLevels.set(key, newPower);
    this.propagateSignals(x, y, z);
  }

  /**
   * Propagate redstone signals to neighbors
   */
  public propagateSignals(startX: number, startY: number, startZ: number) {
    const queue: { x: number; y: number; z: number; power: number }[] = [];
    const visited = new Set<string>();

    const startKey = this.getKey(startX, startY, startZ);
    const startPower = this.powerLevels.get(startKey) || 0;
    queue.push({ x: startX, y: startY, z: startZ, power: startPower });

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curKey = this.getKey(cur.x, cur.y, cur.z);
      if (visited.has(curKey)) continue;
      visited.add(curKey);

      const neighbors = [
        { x: cur.x + 1, y: cur.y, z: cur.z },
        { x: cur.x - 1, y: cur.y, z: cur.z },
        { x: cur.x, y: cur.y + 1, z: cur.z },
        { x: cur.x, y: cur.y - 1, z: cur.z },
        { x: cur.x, y: cur.y, z: cur.z + 1 },
        { x: cur.x, y: cur.y, z: cur.z - 1 },
      ];

      for (const n of neighbors) {
        const blk = this.world.getBlock(n.x, n.y, n.z);

        // Redstone Lamp activation
        if (blk === BlockType.REDSTONE_LAMP || blk === BlockType.REDSTONE_LAMP_LIT) {
          if (cur.power > 0) {
            this.world.setBlock(n.x, n.y, n.z, BlockType.REDSTONE_LAMP_LIT);
          } else {
            this.world.setBlock(n.x, n.y, n.z, BlockType.REDSTONE_LAMP);
          }
        }

        // Wire propagation with falloff
        if (blk === BlockType.REDSTONE_WIRE && cur.power > 1) {
          const nKey = this.getKey(n.x, n.y, n.z);
          const nextPower = cur.power - 1;
          const prevPower = this.powerLevels.get(nKey) || 0;
          if (nextPower > prevPower) {
            this.powerLevels.set(nKey, nextPower);
            queue.push({ x: n.x, y: n.y, z: n.z, power: nextPower });
          }
        }
      }
    }
  }

  // STUB: Nether Portal ignition and dimension transition
  // Can be iterated on with obsidian frame detection (4x5) and flint & steel click
  public checkNetherPortal(x: number, y: number, z: number): boolean {
    // STUB: Check 4x5 obsidian ring geometry and spawn portal blocks
    return false;
  }

  // STUB: Enchanting Table UI and Experience Level system
  public openEnchantingGUI() {
    // STUB: Enchantment level calculation based on surrounding bookshelves
  }

  // STUB: Weather System (Rain / Snow particles)
  public setWeather(type: 'clear' | 'rain' | 'snow') {
    // STUB: Particle emitter for falling rain and snow streaks
  }
}
