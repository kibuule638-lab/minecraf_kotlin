/**
 * @file worldGen.ts
 * Procedural voxel terrain generator with multiple biomes, 3D caves, ore veins,
 * dynamic water table, and procedural vegetation.
 */

import { BlockType, BiomeType } from '../types/voxel';
import { SimplexNoise } from './noise';

export const SEA_LEVEL = 38;
export const WORLD_HEIGHT = 128;
export const CHUNK_SIZE = 16;

export class WorldGenerator {
  private noise: SimplexNoise;
  private biomeNoise: SimplexNoise;
  private caveNoise: SimplexNoise;
  private oreNoise: SimplexNoise;
  public seed: number;

  constructor(seed: number = 4242) {
    this.seed = seed;
    this.noise = new SimplexNoise(seed);
    this.biomeNoise = new SimplexNoise(seed + 101);
    this.caveNoise = new SimplexNoise(seed + 202);
    this.oreNoise = new SimplexNoise(seed + 303);
  }

  /**
   * Determine biome at world (x, z)
   */
  public getBiome(wx: number, wz: number): BiomeType {
    const temp = this.biomeNoise.fbm2D(wx * 0.003, wz * 0.003, 3, 0.5, 2.0);
    const rainfall = this.biomeNoise.fbm2D((wx + 500) * 0.003, (wz + 500) * 0.003, 3, 0.5, 2.0);

    if (temp < -0.3) {
      return BiomeType.SNOWY;
    } else if (temp > 0.35 && rainfall < -0.1) {
      return BiomeType.DESERT;
    } else if (rainfall > 0.3) {
      return BiomeType.FOREST;
    } else if (temp > 0.1 && rainfall > 0.0 && this.noise.noise2D(wx * 0.008, wz * 0.008) > 0.45) {
      return BiomeType.MOUNTAINS;
    } else if (this.noise.noise2D(wx * 0.004, wz * 0.004) < -0.42) {
      return BiomeType.OCEAN;
    }
    return BiomeType.PLAINS;
  }

  /**
   * Generate raw voxel column and terrain data for a 16x16 chunk
   */
  public generateChunkData(cx: number, cz: number, voxels: Uint8Array): {
    trees: { x: number; y: number; z: number; type: 'oak' | 'birch' | 'spruce' }[];
    plants: { x: number; y: number; z: number; type: BlockType }[];
  } {
    const trees: { x: number; y: number; z: number; type: 'oak' | 'birch' | 'spruce' }[] = [];
    const plants: { x: number; y: number; z: number; type: BlockType }[] = [];

    // Precalculate heightmap and biomes for 16x16 column
    const heightMap: number[] = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap: BiomeType[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const biome = this.getBiome(wx, wz);
        biomeMap[lz * CHUNK_SIZE + lx] = biome;

        let baseHeight = 44;
        let scale = 12;

        if (biome === BiomeType.MOUNTAINS) {
          baseHeight = 65;
          scale = 32;
        } else if (biome === BiomeType.OCEAN) {
          baseHeight = 26;
          scale = 8;
        } else if (biome === BiomeType.DESERT) {
          baseHeight = 42;
          scale = 8;
        } else if (biome === BiomeType.FOREST) {
          baseHeight = 46;
          scale = 14;
        }

        // Multiscale terrain noise
        const n1 = this.noise.fbm2D(wx * 0.006, wz * 0.006, 4, 0.5, 2.0);
        const n2 = this.noise.noise2D(wx * 0.02, wz * 0.02) * 0.25;
        let h = Math.floor(baseHeight + (n1 + n2) * scale);
        h = Math.max(2, Math.min(WORLD_HEIGHT - 10, h));
        heightMap[lz * CHUNK_SIZE + lx] = h;
      }
    }

    // Populate 3D Voxels
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const surfaceY = heightMap[lz * CHUNK_SIZE + lx];
        const biome = biomeMap[lz * CHUNK_SIZE + lx];

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const idx = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

          // 1. Bedrock floor (y = 0 indestructible, y = 1 patchy)
          if (y === 0) {
            voxels[idx] = BlockType.BEDROCK;
            continue;
          }
          if (y === 1 && this.noise.noise2D(wx * 0.8, wz * 0.8) > 0.0) {
            voxels[idx] = BlockType.BEDROCK;
            continue;
          }

          // 2. Above surface
          if (y > surfaceY) {
            // Fill water up to SEA_LEVEL
            if (y <= SEA_LEVEL) {
              voxels[idx] = BlockType.WATER;
            } else {
              voxels[idx] = BlockType.AIR;
            }
            continue;
          }

          // 3. 3D Cave Carving (swiss-cheese & worm tunnels)
          if (y >= 4 && y < surfaceY - 2) {
            const caveVal = this.caveNoise.fbm3D(wx * 0.04, y * 0.05, wz * 0.04, 3, 0.5, 2.0);
            if (caveVal > 0.52) {
              // Deep cave lava pools
              if (y <= 7) {
                voxels[idx] = BlockType.LAVA;
              } else {
                voxels[idx] = BlockType.AIR;
              }
              continue;
            }
          }

          // 4. Surface Layer
          if (y === surfaceY) {
            if (surfaceY < SEA_LEVEL - 1) {
              // Underwater floor
              const sandNoise = this.noise.noise2D(wx * 0.08, wz * 0.08);
              voxels[idx] = sandNoise > 0.2 ? BlockType.GRAVEL : sandNoise < -0.2 ? BlockType.CLAY : BlockType.SAND;
            } else if (biome === BiomeType.DESERT) {
              voxels[idx] = BlockType.SAND;
            } else if (biome === BiomeType.SNOWY) {
              voxels[idx] = BlockType.SNOW_BLOCK;
            } else if (biome === BiomeType.MOUNTAINS && surfaceY > 75) {
              voxels[idx] = BlockType.SNOW_BLOCK;
            } else if (biome === BiomeType.MOUNTAINS && surfaceY > 68) {
              voxels[idx] = BlockType.STONE;
            } else {
              voxels[idx] = BlockType.GRASS;
            }
            continue;
          }

          // 5. Subsurface Layer (2-4 blocks below surface)
          const depthBelowSurface = surfaceY - y;
          if (depthBelowSurface <= 3) {
            if (biome === BiomeType.DESERT) {
              voxels[idx] = depthBelowSurface === 3 ? BlockType.SANDSTONE : BlockType.SAND;
            } else if (biome === BiomeType.SNOWY) {
              voxels[idx] = BlockType.DIRT;
            } else {
              voxels[idx] = BlockType.DIRT;
            }
            continue;
          }

          // 6. Deep Stone & Ore Distribution
          let blockToPlace: BlockType = BlockType.STONE;

          // Occasional granite/diorite/andesite pockets
          const stoneVar = this.oreNoise.noise3D(wx * 0.06, y * 0.06, wz * 0.06);
          if (stoneVar > 0.58) blockToPlace = BlockType.GRANITE;
          else if (stoneVar < -0.58) blockToPlace = BlockType.DIORITE;
          else if (this.oreNoise.noise3D(wx * 0.05 + 100, y * 0.05, wz * 0.05) > 0.58) blockToPlace = BlockType.ANDESITE;

          // Ore Veins
          const oreVal = this.oreNoise.noise3D(wx * 0.25, y * 0.25, wz * 0.25);
          if (oreVal > 0.68) {
            if (y >= 10 && y <= 80 && oreVal > 0.70) {
              blockToPlace = BlockType.COAL_ORE;
            } else if (y >= 8 && y <= 55 && oreVal > 0.74) {
              blockToPlace = BlockType.IRON_ORE;
            } else if (y >= 4 && y <= 32 && oreVal > 0.81) {
              blockToPlace = BlockType.GOLD_ORE;
            } else if (y >= 2 && y <= 18 && oreVal > 0.82) {
              blockToPlace = BlockType.REDSTONE_ORE;
            } else if (y >= 10 && y <= 30 && oreVal > 0.83) {
              blockToPlace = BlockType.LAPIS_ORE;
            } else if (y >= 2 && y <= 16 && oreVal > 0.86) {
              blockToPlace = BlockType.DIAMOND_ORE;
            } else if (biome === BiomeType.MOUNTAINS && y >= 35 && y <= 80 && oreVal > 0.82) {
              blockToPlace = BlockType.EMERALD_ORE;
            }
          }

          voxels[idx] = blockToPlace;
        }

        // 7. Surface Decorations & Trees
        const topY = surfaceY;
        if (topY > SEA_LEVEL) {
          const treeNoise = Math.sin(wx * 12.9898 + wz * 78.233 + this.seed) * 43758.5453;
          const treeRand = treeNoise - Math.floor(treeNoise);

          // Tree density based on biome
          let treeThreshold = 0.985; // Plains
          let treeType: 'oak' | 'birch' | 'spruce' = 'oak';

          if (biome === BiomeType.FOREST) {
            treeThreshold = 0.94; // Dense forest
            treeType = treeRand > 0.6 ? 'birch' : 'oak';
          } else if (biome === BiomeType.SNOWY) {
            treeThreshold = 0.96;
            treeType = 'spruce';
          } else if (biome === BiomeType.DESERT) {
            treeThreshold = 1.0; // No trees in desert
          } else if (biome === BiomeType.MOUNTAINS) {
            treeThreshold = 0.988;
            treeType = 'spruce';
          }

          // Check if tree can plant (avoid borders of chunk to prevent cross-chunk cutoffs)
          if (lx >= 2 && lx <= CHUNK_SIZE - 3 && lz >= 2 && lz <= CHUNK_SIZE - 3) {
            if (treeRand > treeThreshold && voxels[(topY * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] === BlockType.GRASS) {
              trees.push({ x: lx, y: topY + 1, z: lz, type: treeType });
            } else {
              // Flowers and grass
              const plantRand = Math.sin(wx * 31.41 + wz * 17.13) * 1000;
              const pVal = plantRand - Math.floor(plantRand);
              if (pVal > 0.88 && voxels[(topY * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] === BlockType.GRASS) {
                const plantType = pVal > 0.96 ? BlockType.POPPY : pVal > 0.92 ? BlockType.DANDELION : BlockType.TALL_GRASS;
                plants.push({ x: lx, y: topY + 1, z: lz, type: plantType });
              }
            }
          }
        }
      }
    }

    // Place trees into voxel array
    for (const tree of trees) {
      this.generateTree(voxels, tree.x, tree.y, tree.z, tree.type);
    }

    // Place surface plants
    for (const p of plants) {
      if (p.y < WORLD_HEIGHT) {
        const pIdx = (p.y * CHUNK_SIZE + p.z) * CHUNK_SIZE + p.x;
        if (voxels[pIdx] === BlockType.AIR) {
          voxels[pIdx] = p.type;
        }
      }
    }

    return { trees, plants };
  }

  /**
   * Procedural Tree Generation (Oak, Birch, Spruce)
   */
  private generateTree(
    voxels: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
    type: 'oak' | 'birch' | 'spruce'
  ) {
    const logBlock = type === 'birch' ? BlockType.BIRCH_LOG : type === 'spruce' ? BlockType.SPRUCE_LOG : BlockType.OAK_LOG;
    const leavesBlock = type === 'birch' ? BlockType.BIRCH_LEAVES : type === 'spruce' ? BlockType.SPRUCE_LEAVES : BlockType.OAK_LEAVES;

    const trunkHeight = type === 'spruce' ? 6 : 5;

    // Oak / Birch Tree
    if (type !== 'spruce') {
      // Trunk
      for (let y = 0; y < trunkHeight; y++) {
        const curY = baseY + y;
        if (curY >= WORLD_HEIGHT) break;
        const idx = (curY * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
        voxels[idx] = logBlock;
      }

      // Leaves canopy (spherical blob around top)
      const topY = baseY + trunkHeight;
      for (let dy = -2; dy <= 2; dy++) {
        const curY = topY + dy;
        if (curY >= WORLD_HEIGHT) continue;
        const radius = dy >= 1 ? 1 : 2;

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            // Cut corners
            if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === 2 || Math.random() > 0.4)) continue;

            const targetX = lx + dx;
            const targetZ = lz + dz;
            if (targetX >= 0 && targetX < CHUNK_SIZE && targetZ >= 0 && targetZ < CHUNK_SIZE) {
              const idx = (curY * CHUNK_SIZE + targetZ) * CHUNK_SIZE + targetX;
              if (voxels[idx] === BlockType.AIR) {
                voxels[idx] = leavesBlock;
              }
            }
          }
        }
      }
    } else {
      // Spruce / Pine Tree (conical layers)
      for (let y = 0; y < trunkHeight + 2; y++) {
        const curY = baseY + y;
        if (curY >= WORLD_HEIGHT) break;
        const idx = (curY * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
        voxels[idx] = logBlock;
      }

      const topY = baseY + trunkHeight + 2;
      for (let dy = 0; dy <= 6; dy++) {
        const curY = topY - dy;
        if (curY >= WORLD_HEIGHT) continue;
        const radius = dy === 0 ? 0 : dy <= 2 ? 1 : 2;

        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy % 2 === 0) continue;
            const targetX = lx + dx;
            const targetZ = lz + dz;
            if (targetX >= 0 && targetX < CHUNK_SIZE && targetZ >= 0 && targetZ < CHUNK_SIZE) {
              const idx = (curY * CHUNK_SIZE + targetZ) * CHUNK_SIZE + targetX;
              if (voxels[idx] === BlockType.AIR) {
                voxels[idx] = leavesBlock;
              }
            }
          }
        }
      }
    }
  }
}
