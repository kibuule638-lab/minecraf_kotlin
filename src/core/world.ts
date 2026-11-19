/**
 * @file world.ts
 * Master Voxel World manager handling chunk lifecycle, DDA raycasting,
 * fluid spread, block modification, dropped entities, and world persistence.
 */

import * as THREE from 'three';
import { BlockType, DroppedItemEntity, ItemStack } from '../types/voxel';
import { Chunk } from './chunk';
import { WorldGenerator, CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from './worldGen';
import { TextureManager } from './textures';
import { AudioManager } from './audio';

export interface RaycastHit {
  hit: boolean;
  blockPos: { x: number; y: number; z: number };
  faceNormal: { x: number; y: number; z: number };
  blockType: BlockType;
  point: { x: number; y: number; z: number };
}

export class VoxelWorld {
  public chunks: Map<string, Chunk> = new Map();
  public generator: WorldGenerator;
  public scene: THREE.Scene;
  public renderDistance: number = 4;
  public seed: number;

  // Materials
  public opaqueMaterial: THREE.MeshLambertMaterial;
  public translucentMaterial: THREE.MeshLambertMaterial;
  public plantMaterial: THREE.MeshLambertMaterial;

  // Dropped item entities
  public droppedItems: DroppedItemEntity[] = [];
  public droppedItemMeshes: Map<string, THREE.Mesh> = new Map();

  // Chest storage map: key = `${x},${y},${z}`, value = 27 slots of ItemStack | null
  public chestStorage: Map<string, (ItemStack | null)[]> = new Map();

  // Furnace state map: key = `${x},${y},${z}`, value = furnace state
  public furnaceStorage: Map<string, {
    fuel: ItemStack | null;
    input: ItemStack | null;
    output: ItemStack | null;
    burnTime: number; // remaining ticks of fuel
    maxBurnTime: number;
    cookProgress: number; // 0 to 100
  }> = new Map();

  // Shared geometry for dropped item blocks
  private itemBlockGeo: THREE.BoxGeometry;
  private itemMat: THREE.MeshLambertMaterial;

  private lastPlayerChunk: { cx: number; cz: number } = { cx: 9999, cz: 9999 };

  constructor(scene: THREE.Scene, seed: number = 4242) {
    this.scene = scene;
    this.seed = seed;
    this.generator = new WorldGenerator(seed);

    const tm = TextureManager.getInstance();
    const atlas = tm.getTexture();

    // Opaque terrain material
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      alphaTest: 0.1,
    });

    // Translucent material (water, glass)
    this.translucentMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    // Plant material (flowers, grass, torches)
    this.plantMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });

    // Item entity visual
    this.itemBlockGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    this.itemMat = new THREE.MeshLambertMaterial({ map: atlas });

    // Update materials if texture atlas rebuilds
    tm.onAtlasUpdated(() => {
      this.opaqueMaterial.map = tm.getTexture();
      this.translucentMaterial.map = tm.getTexture();
      this.plantMaterial.map = tm.getTexture();
      this.itemMat.map = tm.getTexture();
      this.opaqueMaterial.needsUpdate = true;
      this.translucentMaterial.needsUpdate = true;
      this.plantMaterial.needsUpdate = true;
      this.itemMat.needsUpdate = true;

      // Re-mesh all chunks with new atlas UVs
      for (const chunk of this.chunks.values()) {
        chunk.isDirty = true;
      }
    });
  }

  public getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cz));
  }

  /**
   * Reads block at world coordinates
   */
  public getBlock(wx: number, wy: number, wz: number): BlockType {
    if (wy < 0 || wy >= WORLD_HEIGHT) return BlockType.AIR;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.AIR;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  /**
   * Sets block at world coordinates and marks affected chunks dirty
   */
  public setBlock(wx: number, wy: number, wz: number, block: BlockType): boolean {
    if (wy < 0 || wy >= WORLD_HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return false;

    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const changed = chunk.setBlock(lx, wy, lz, block);
    if (changed) {
      // Mark neighbor chunk dirty if block is on border
      if (lx === 0) this.getChunk(cx - 1, cz)?.setBlock(0, 0, 0, this.getChunk(cx - 1, cz)!.getBlock(0, 0, 0));
      if (lx === CHUNK_SIZE - 1) this.getChunk(cx + 1, cz)?.setBlock(0, 0, 0, this.getChunk(cx + 1, cz)!.getBlock(0, 0, 0));
      if (lz === 0) this.getChunk(cx, cz - 1)?.setBlock(0, 0, 0, this.getChunk(cx, cz - 1)!.getBlock(0, 0, 0));
      if (lz === CHUNK_SIZE - 1) this.getChunk(cx, cz + 1)?.setBlock(0, 0, 0, this.getChunk(cx, cz + 1)!.getBlock(0, 0, 0));
    }
    return changed;
  }

  /**
   * Update chunks surrounding the player
   */
  public updatePlayerPosition(px: number, pz: number) {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);

    if (pcx === this.lastPlayerChunk.cx && pcz === this.lastPlayerChunk.cz) {
      return;
    }
    this.lastPlayerChunk = { cx: pcx, cz: pcz };

    const neededKeys = new Set<string>();

    // Load or generate chunks in radius
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        if (dx * dx + dz * dz > (this.renderDistance + 0.5) * (this.renderDistance + 0.5)) continue;

        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = this.getChunkKey(cx, cz);
        neededKeys.add(key);

        if (!this.chunks.has(key)) {
          const chunk = new Chunk(cx, cz);
          this.generator.generateChunkData(cx, cz, chunk.voxels);
          this.chunks.set(key, chunk);
        }
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        if (chunk.mesh) this.scene.remove(chunk.mesh);
        if (chunk.waterMesh) this.scene.remove(chunk.waterMesh);
        if (chunk.plantMesh) this.scene.remove(chunk.plantMesh);
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Mesh dirty chunks each frame (up to 2 chunks per frame to keep 60fps)
   */
  public updateMeshes(maxMeshesPerFrame = 2) {
    let meshed = 0;
    const getter = (wx: number, wy: number, wz: number) => this.getBlock(wx, wy, wz);

    for (const chunk of this.chunks.values()) {
      if (chunk.isDirty) {
        // Remove old meshes from scene
        if (chunk.mesh) this.scene.remove(chunk.mesh);
        if (chunk.waterMesh) this.scene.remove(chunk.waterMesh);
        if (chunk.plantMesh) this.scene.remove(chunk.plantMesh);

        chunk.buildMesh(getter, this.opaqueMaterial, this.translucentMaterial, this.plantMaterial);

        if (chunk.mesh) this.scene.add(chunk.mesh);
        if (chunk.waterMesh) this.scene.add(chunk.waterMesh);
        if (chunk.plantMesh) this.scene.add(chunk.plantMesh);

        meshed++;
        if (meshed >= maxMeshesPerFrame) break;
      }
    }
  }

  /**
   * DDA Fast Voxel Raycasting
   */
  public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance = 6.0): RaycastHit {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;

    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const stepZ = Math.sign(dz);

    const tDeltaX = Math.abs(1 / dx);
    const tDeltaY = Math.abs(1 / dy);
    const tDeltaZ = Math.abs(1 / dz);

    let tMaxX = (stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX;
    let tMaxY = (stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY;
    let tMaxZ = (stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ;

    let normalX = 0, normalY = 0, normalZ = 0;
    let dist = 0;

    while (dist < maxDistance) {
      const block = this.getBlock(x, y, z);
      if (block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA) {
        return {
          hit: true,
          blockPos: { x, y, z },
          faceNormal: { x: normalX, y: normalY, z: normalZ },
          blockType: block,
          point: {
            x: origin.x + direction.x * dist,
            y: origin.y + direction.y * dist,
            z: origin.z + direction.z * dist,
          },
        };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          dist = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
          normalX = -stepX; normalY = 0; normalZ = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          normalX = 0; normalY = 0; normalZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          dist = tMaxY;
          y += stepY;
          tMaxY += tDeltaY;
          normalX = 0; normalY = -stepY; normalZ = 0;
        } else {
          dist = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          normalX = 0; normalY = 0; normalZ = -stepZ;
        }
      }
    }

    return {
      hit: false,
      blockPos: { x: 0, y: 0, z: 0 },
      faceNormal: { x: 0, y: 0, z: 0 },
      blockType: BlockType.AIR,
      point: { x: 0, y: 0, z: 0 },
    };
  }

  /**
   * Spawn a dropped item entity in the world
   */
  public spawnDroppedItem(item: ItemStack, x: number, y: number, z: number) {
    const id = `item_${Date.now()}_${Math.random()}`;
    const entity: DroppedItemEntity = {
      id,
      item,
      position: { x: x + 0.5, y: y + 0.3, z: z + 0.5 },
      velocity: {
        x: (Math.random() - 0.5) * 0.1,
        y: 0.15 + Math.random() * 0.05,
        z: (Math.random() - 0.5) * 0.1,
      },
      rotation: Math.random() * Math.PI * 2,
      lifetime: 0,
    };

    const mesh = new THREE.Mesh(this.itemBlockGeo, this.itemMat);
    mesh.position.set(entity.position.x, entity.position.y, entity.position.z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.droppedItems.push(entity);
    this.droppedItemMeshes.set(id, mesh);
  }

  /**
   * Tick dropped items (bobbing, spinning, gravity, pickup)
   */
  public updateDroppedItems(dt: number, playerPos: THREE.Vector3, onPickup: (stack: ItemStack) => boolean) {
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      item.lifetime += dt;

      // Gravity & Ground collision
      const checkBlock = this.getBlock(Math.floor(item.position.x), Math.floor(item.position.y - 0.2), Math.floor(item.position.z));
      if (checkBlock === BlockType.AIR || checkBlock === BlockType.WATER) {
        item.velocity.y -= 9.8 * dt * 0.4;
      } else {
        item.velocity.y = 0;
        item.velocity.x *= 0.8;
        item.velocity.z *= 0.8;
      }

      item.position.x += item.velocity.x;
      item.position.y += item.velocity.y;
      item.position.z += item.velocity.z;

      item.rotation += dt * 3;

      // Distance to player
      const dx = playerPos.x - item.position.x;
      const dy = playerPos.y - item.position.y;
      const dz = playerPos.z - item.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Magnet pull within 2.5 blocks
      if (distSq < 6.25 && item.lifetime > 0.6) {
        item.position.x += dx * dt * 4;
        item.position.y += dy * dt * 4;
        item.position.z += dz * dt * 4;

        // Pickup radius within 1.0 block
        if (distSq < 1.0) {
          const pickedUp = onPickup(item.item);
          if (pickedUp) {
            AudioManager.getInstance().playItemPop();
            const mesh = this.droppedItemMeshes.get(item.id);
            if (mesh) {
              this.scene.remove(mesh);
              this.droppedItemMeshes.delete(item.id);
            }
            this.droppedItems.splice(i, 1);
            continue;
          }
        }
      }

      // Update mesh transform
      const mesh = this.droppedItemMeshes.get(item.id);
      if (mesh) {
        mesh.position.set(item.position.x, item.position.y + Math.sin(item.rotation * 2) * 0.05, item.position.z);
        mesh.rotation.y = item.rotation;
      }
    }
  }

  /**
   * Simplified fluid flow and crop growth simulation
   */
  public tickSimulation() {
    // Check random blocks around active chunks for water spread / wheat growth
    const chunkArray = Array.from(this.chunks.values());
    if (chunkArray.length === 0) return;

    for (let sample = 0; sample < 15; sample++) {
      const chunk = chunkArray[Math.floor(Math.random() * chunkArray.length)];
      const rx = Math.floor(Math.random() * CHUNK_SIZE);
      const rz = Math.floor(Math.random() * CHUNK_SIZE);
      const ry = Math.floor(Math.random() * (WORLD_HEIGHT - 10)) + 2;

      const wx = chunk.cx * CHUNK_SIZE + rx;
      const wz = chunk.cz * CHUNK_SIZE + rz;
      const block = this.getBlock(wx, ry, wz);

      // 1. Water cellular flow: spread downward or horizontally into AIR
      if (block === BlockType.WATER) {
        const below = this.getBlock(wx, ry - 1, wz);
        if (below === BlockType.AIR) {
          this.setBlock(wx, ry - 1, wz, BlockType.WATER);
        } else if (below === BlockType.LAVA) {
          // Water touches lava -> Obsidian or Cobblestone
          this.setBlock(wx, ry - 1, wz, BlockType.OBSIDIAN);
        }
      }

      // 2. Wheat crop growth (WHEAT_0 to WHEAT_3)
      if (block >= BlockType.WHEAT_0 && block < BlockType.WHEAT_3) {
        const soil = this.getBlock(wx, ry - 1, wz);
        if (soil === BlockType.FARMLAND || soil === BlockType.FARMLAND_WET) {
          this.setBlock(wx, ry, wz, block + 1);
        }
      }

      // 3. Farmland hydrating if water is nearby
      if (block === BlockType.FARMLAND) {
        let hasWater = false;
        for (let ox = -3; ox <= 3; ox++) {
          for (let oz = -3; oz <= 3; oz++) {
            if (this.getBlock(wx + ox, ry, wz + oz) === BlockType.WATER) {
              hasWater = true;
              break;
            }
          }
        }
        if (hasWater) {
          this.setBlock(wx, ry, wz, BlockType.FARMLAND_WET);
        }
      }
    }
  }

  /**
   * Save world changes and seed to localStorage
   */
  public saveToStorage(): string {
    const data = {
      seed: this.seed,
      renderDistance: this.renderDistance,
      chestStorage: Array.from(this.chestStorage.entries()),
    };
    const json = JSON.stringify(data);
    localStorage.setItem('minecraft_web_world_save', json);
    return json;
  }

  /**
   * Load world from localStorage
   */
  public loadFromStorage(): boolean {
    const json = localStorage.getItem('minecraft_web_world_save');
    if (!json) return false;
    try {
      const data = JSON.parse(json);
      if (data.chestStorage) {
        this.chestStorage = new Map(data.chestStorage);
      }
      return true;
    } catch {
      return false;
    }
  }
}
