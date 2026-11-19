/**
 * @file player.ts
 * Complete Player Physics Controller with AABB sweep collision, 1-block auto step-up,
 * swimming, flying toggle, survival health/hunger/air systems, block mining/placing,
 * and inventory management.
 */

import * as THREE from 'three';
import { BlockType, ItemStack } from '../types/voxel';
import { VoxelWorld, RaycastHit } from './world';
import { ITEM_REGISTRY, getBlockDrops, getMiningTime } from './items';
import { AudioManager } from './audio';

export class Player {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public camera: THREE.Camera;
  public world: VoxelWorld;

  // Rotation angles (radians)
  public pitch: number = 0;
  public yaw: number = 0;

  // Dimensions
  public width: number = 0.6;
  public height: number = 1.8;
  public eyeHeight: number = 1.62;

  // States
  public onGround: boolean = false;
  public inWater: boolean = false;
  public inLava: boolean = false;
  public isSneaking: boolean = false;
  public isSprinting: boolean = false;
  public isFlying: boolean = false;
  public gameMode: 'survival' | 'creative' = 'survival';

  // Survival Stats
  public health: number = 20;
  public maxHealth: number = 20;
  public hunger: number = 20;
  public saturation: number = 5.0;
  public air: number = 300; // 10 bubbles
  public fireTicks: number = 0;
  public isDead: boolean = false;

  // Fall damage tracking
  private highestY: number = 0;

  // Double-tap space for flying
  private lastSpaceTime: number = 0;

  // Inventory: 9 hotbar slots, 27 main inventory slots
  public hotbar: (ItemStack | null)[] = new Array(9).fill(null);
  public inventory: (ItemStack | null)[] = new Array(27).fill(null);
  public activeSlot: number = 0;

  // Block Targeting & Mining
  public targetHit: RaycastHit | null = null;
  public isMining: boolean = false;
  public miningProgress: number = 0; // 0.0 to 1.0
  public currentMiningPos: { x: number; y: number; z: number } | null = null;

  // Input states
  public keys: Record<string, boolean> = {};

  // Timers
  private regenTimer: number = 0;
  private starveTimer: number = 0;
  private drownTimer: number = 0;
  private footstepTimer: number = 0;

  constructor(camera: THREE.Camera, world: VoxelWorld, spawnPos = new THREE.Vector3(8, 50, 8)) {
    this.camera = camera;
    this.world = world;
    this.position = spawnPos.clone();
    this.highestY = this.position.y;

    // Default starter hotbar items
    this.hotbar[0] = { id: 'iron_pickaxe', count: 1 };
    this.hotbar[1] = { id: 'iron_axe', count: 1 };
    this.hotbar[2] = { id: 'iron_shovel', count: 1 };
    this.hotbar[3] = { id: 'iron_sword', count: 1 };
    this.hotbar[4] = { id: 'torch', count: 32 };
    this.hotbar[5] = { id: 'oak_planks', count: 64 };
    this.hotbar[6] = { id: 'cobblestone', count: 64 };
    this.hotbar[7] = { id: 'bread', count: 16 };
    this.hotbar[8] = { id: 'crafting_table', count: 1 };
  }

  public getActiveItem(): ItemStack | null {
    return this.hotbar[this.activeSlot];
  }

  public setActiveSlot(slot: number) {
    if (slot >= 0 && slot < 9) {
      this.activeSlot = slot;
      this.resetMining();
    }
  }

  public resetMining() {
    this.isMining = false;
    this.miningProgress = 0;
    this.currentMiningPos = null;
  }

  /**
   * Handle mouse look
   */
  public handleMouseMove(movementX: number, movementY: number) {
    const sensitivity = 0.0022;
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;

    // Clamp pitch between -89 and +89 degrees
    const maxPitch = (Math.PI / 2) - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  /**
   * Double-tap Space handler for creative flight
   */
  public handleSpacePress() {
    const now = performance.now();
    if (this.gameMode === 'creative' && now - this.lastSpaceTime < 300) {
      this.isFlying = !this.isFlying;
      this.velocity.y = 0;
    }
    this.lastSpaceTime = now;
  }

  /**
   * Main Physics Tick
   */
  public update(dt: number) {
    if (this.isDead) return;

    // Clamp delta time to avoid large physics steps
    dt = Math.min(dt, 0.05);

    // Check fluid immersion
    const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
    const headBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + this.eyeHeight), Math.floor(this.position.z));

    this.inWater = (feetBlock === BlockType.WATER || headBlock === BlockType.WATER);
    this.inLava = (feetBlock === BlockType.LAVA || headBlock === BlockType.LAVA);

    if (this.inLava) {
      this.fireTicks = 200;
      this.takeDamage(dt * 4, 'lava');
    }

    // Fire damage
    if (this.fireTicks > 0) {
      this.fireTicks -= dt * 20;
      if (this.inWater) {
        this.fireTicks = 0; // Water extinguishes fire
      } else if (Math.floor(this.fireTicks) % 20 === 0) {
        this.takeDamage(1, 'fire');
      }
    }

    // Oxygen & Drowning
    if (headBlock === BlockType.WATER) {
      this.air = Math.max(0, this.air - dt * 20);
      if (this.air <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1.0) {
          this.takeDamage(2, 'drown');
          this.drownTimer = 0;
        }
      }
    } else {
      this.air = 300;
      this.drownTimer = 0;
    }

    // Movement Input directions
    const forward = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const jump = this.keys['Space'];
    const sneak = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

    this.isSneaking = sneak && this.onGround && !this.isFlying;
    this.isSprinting = !!this.keys['ControlLeft'] || (forward > 0 && !!this.keys['KeyW']);

    // Speeds
    let speed = 4.3; // Base walking speed m/s
    if (this.isSprinting) speed = 5.6;
    if (this.isSneaking) speed = 1.3;
    if (this.inWater) speed = 2.4;
    if (this.isFlying) speed = 10.0;

    // Horizontal Movement
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    const moveX = (strafe * cosY - forward * sinY);
    const moveZ = (strafe * sinY + forward * cosY);

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      this.velocity.x = (moveX / len) * speed;
      this.velocity.z = (moveZ / len) * speed;

      // Footstep sound
      if (this.onGround || this.inWater) {
        this.footstepTimer += dt;
        const stepInterval = this.isSprinting ? 0.3 : 0.45;
        if (this.footstepTimer >= stepInterval) {
          const soundType = this.inWater ? 'water' : feetBlock === BlockType.SAND ? 'sand' : 'grass';
          AudioManager.getInstance().playFootstep(soundType);
          this.footstepTimer = 0;
        }
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      this.footstepTimer = 0;
    }

    // Vertical Movement (Gravity & Jump / Fly)
    if (this.isFlying) {
      this.velocity.y = (jump ? speed * 0.8 : 0) - (sneak ? speed * 0.8 : 0);
    } else if (this.inWater) {
      // Swimming buoyancy
      this.velocity.y = jump ? 2.5 : -1.2;
    } else {
      // Gravity
      this.velocity.y -= 26.0 * dt; // Minecraft gravity ~26 m/s²
      this.velocity.y = Math.max(-40, this.velocity.y);

      // Jump
      if (jump && this.onGround) {
        this.velocity.y = 8.5; // Jumps ~1.2 blocks
        this.onGround = false;
      }
    }

    // Track highest Y for fall damage
    if (this.velocity.y < 0) {
      this.highestY = Math.max(this.highestY, this.position.y);
    }

    // AABB Collision Resolution
    this.moveAndCollide(dt);

    // Natural Regen & Hunger in Survival
    if (this.gameMode === 'survival') {
      this.updateSurvivalStats(dt);
    }

    // Update Camera position & rotation
    const curEyeY = this.position.y + (this.isSneaking ? 1.4 : this.eyeHeight);
    this.camera.position.set(this.position.x, curEyeY, this.position.z);

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.pitch;
    euler.y = this.yaw;
    this.camera.quaternion.setFromEuler(euler);

    // Update raycast from screen center
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.targetHit = this.world.raycast(this.camera.position, dir, 5.2);

    // Tick active block mining
    if (this.isMining && this.targetHit && this.targetHit.hit) {
      this.tickMining(dt);
    } else {
      this.resetMining();
    }
  }

  /**
   * Swept AABB Physics & Step-Up Movement
   */
  private moveAndCollide(dt: number) {
    const halfW = this.width / 2;

    // Try Horizontal Move on X
    let targetX = this.position.x + this.velocity.x * dt;
    if (!this.checkAABBCollision(targetX, this.position.y, this.position.z)) {
      this.position.x = targetX;
    } else {
      // Try Auto Step-Up 1 block
      if (this.onGround && !this.checkAABBCollision(targetX, this.position.y + 1.05, this.position.z)) {
        this.position.y += 1.05;
        this.position.x = targetX;
      } else {
        this.velocity.x = 0;
      }
    }

    // Try Horizontal Move on Z
    let targetZ = this.position.z + this.velocity.z * dt;
    if (!this.checkAABBCollision(this.position.x, this.position.y, targetZ)) {
      this.position.z = targetZ;
    } else {
      // Try Auto Step-Up 1 block
      if (this.onGround && !this.checkAABBCollision(this.position.x, this.position.y + 1.05, targetZ)) {
        this.position.y += 1.05;
        this.position.z = targetZ;
      } else {
        this.velocity.z = 0;
      }
    }

    // Vertical Move on Y
    const targetY = this.position.y + this.velocity.y * dt;
    if (!this.checkAABBCollision(this.position.x, targetY, this.position.z)) {
      this.position.y = targetY;
      this.onGround = false;
    } else {
      if (this.velocity.y < 0) {
        // Landed on ground
        this.onGround = true;

        // Fall Damage check
        if (this.gameMode === 'survival') {
          const fallDist = this.highestY - this.position.y;
          if (fallDist > 3.5) {
            const damage = Math.floor(fallDist - 3);
            this.takeDamage(damage, 'fall');
          }
        }
        this.highestY = this.position.y;
      }
      this.velocity.y = 0;
    }
  }

  /**
   * Checks if an AABB at test position collides with any solid voxel
   */
  private checkAABBCollision(px: number, py: number, pz: number): boolean {
    const halfW = this.width / 2;
    const minX = Math.floor(px - halfW);
    const maxX = Math.floor(px + halfW);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + this.height);
    const minZ = Math.floor(pz - halfW);
    const maxZ = Math.floor(pz + halfW);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const block = this.world.getBlock(x, y, z);
          if (block !== BlockType.AIR && block !== BlockType.WATER && block !== BlockType.LAVA) {
            // Check non-solid blocks (flowers, torches, tall grass)
            if (
              block === BlockType.TORCH || block === BlockType.REDSTONE_TORCH ||
              block === BlockType.POPPY || block === BlockType.DANDELION ||
              block === BlockType.TALL_GRASS || (block >= BlockType.WHEAT_0 && block <= BlockType.WHEAT_3)
            ) {
              continue;
            }
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Survival Hunger, Health Regen & Starvation
   */
  private updateSurvivalStats(dt: number) {
    // Hunger depletion
    const depletionRate = this.isSprinting ? 0.04 : 0.008;
    this.hunger = Math.max(0, this.hunger - dt * depletionRate);

    // Natural Regen when hunger >= 18
    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4.0) {
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.hunger = Math.max(0, this.hunger - 0.5);
        this.regenTimer = 0;
      }
    }

    // Starvation damage when hunger == 0
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4.0) {
        this.takeDamage(1, 'starve');
        this.starveTimer = 0;
      }
    }
  }

  /**
   * Take damage
   */
  public takeDamage(amount: number, source: string) {
    if (this.gameMode === 'creative' || this.isDead) return;

    this.health = Math.max(0, this.health - amount);
    AudioManager.getInstance().playHit(true);

    if (this.health <= 0) {
      this.isDead = true;
    }
  }

  /**
   * Respawn after death
   */
  public respawn(spawnPos = new THREE.Vector3(8, 55, 8)) {
    this.position = spawnPos.clone();
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = 20;
    this.air = 300;
    this.fireTicks = 0;
    this.isDead = false;
  }

  /**
   * Mine block tick
   */
  private tickMining(dt: number) {
    if (!this.targetHit) return;
    const hitPos = this.targetHit.blockPos;

    // If target block changed, reset progress
    if (
      !this.currentMiningPos ||
      this.currentMiningPos.x !== hitPos.x ||
      this.currentMiningPos.y !== hitPos.y ||
      this.currentMiningPos.z !== hitPos.z
    ) {
      this.currentMiningPos = { ...hitPos };
      this.miningProgress = 0;
    }

    const block = this.targetHit.blockType;
    if (block === BlockType.BEDROCK && this.gameMode === 'survival') return;

    if (this.gameMode === 'creative') {
      // Instant break in creative mode
      this.breakCurrentBlock();
      return;
    }

    const activeItemDef = this.getActiveItem() ? ITEM_REGISTRY[this.getActiveItem()!.id] : undefined;
    const miningTime = getMiningTime(block, activeItemDef);

    this.miningProgress += dt / miningTime;

    if (this.miningProgress >= 1.0) {
      this.breakCurrentBlock();
    }
  }

  /**
   * Break the targeted block
   */
  public breakCurrentBlock() {
    if (!this.targetHit) return;
    const { x, y, z } = this.targetHit.blockPos;
    const block = this.world.getBlock(x, y, z);
    if (block === BlockType.AIR) return;

    // Play break sound
    const soundType = (block === BlockType.GRASS || block === BlockType.DIRT) ? 'grass' :
      (block === BlockType.OAK_LOG || block === BlockType.OAK_PLANKS) ? 'wood' :
      (block === BlockType.SAND) ? 'sand' :
      (block === BlockType.GLASS) ? 'glass' : 'stone';
    AudioManager.getInstance().playBlockBreak(soundType);

    // Remove block from world
    this.world.setBlock(x, y, z, BlockType.AIR);

    // In survival mode, spawn dropped item entity
    if (this.gameMode === 'survival') {
      const activeItem = this.getActiveItem();
      const toolDef = activeItem ? ITEM_REGISTRY[activeItem.id] : undefined;
      const drop = getBlockDrops(block, toolDef);
      if (drop.count > 0) {
        this.world.spawnDroppedItem({ id: drop.id, count: drop.count }, x, y, z);
      }

      // Reduce tool durability
      if (activeItem && toolDef && toolDef.durability) {
        activeItem.durability = (activeItem.durability ?? toolDef.durability) - 1;
        if (activeItem.durability <= 0) {
          this.hotbar[this.activeSlot] = null; // Tool broke!
        }
      }
    }

    this.resetMining();
  }

  /**
   * Right Click: Place block, use tool, or eat food
   */
  public handleRightClick(
    onOpenCrafting: () => void,
    onOpenFurnace: (pos: { x: number; y: number; z: number }) => void,
    onOpenChest: (pos: { x: number; y: number; z: number }) => void
  ) {
    if (!this.targetHit || !this.targetHit.hit) return;

    const hitBlock = this.targetHit.blockType;
    const hitPos = this.targetHit.blockPos;

    // 1. Check container/interactive blocks
    if (hitBlock === BlockType.CRAFTING_TABLE) {
      onOpenCrafting();
      return;
    }
    if (hitBlock === BlockType.FURNACE || hitBlock === BlockType.FURNACE_LIT) {
      onOpenFurnace(hitPos);
      return;
    }
    if (hitBlock === BlockType.CHEST) {
      onOpenChest(hitPos);
      return;
    }

    const activeItem = this.getActiveItem();
    if (!activeItem) return;
    const itemDef = ITEM_REGISTRY[activeItem.id];
    if (!itemDef) return;

    // 2. Eat food
    if (itemDef.foodRestore && this.hunger < 20) {
      this.hunger = Math.min(20, this.hunger + itemDef.foodRestore);
      this.saturation += itemDef.saturation ?? 2;
      this.consumeActiveItem();
      AudioManager.getInstance().playBlockBreak('grass');
      return;
    }

    // 3. Hoe tilling Grass / Dirt -> Farmland
    if (itemDef.toolType === 'hoe' && (hitBlock === BlockType.GRASS || hitBlock === BlockType.DIRT)) {
      this.world.setBlock(hitPos.x, hitPos.y, hitPos.z, BlockType.FARMLAND);
      AudioManager.getInstance().playBlockPlace('grass');
      return;
    }

    // 4. Planting seeds on Farmland
    if (activeItem.id === 'wheat_seeds' && (hitBlock === BlockType.FARMLAND || hitBlock === BlockType.FARMLAND_WET)) {
      const placePos = { x: hitPos.x, y: hitPos.y + 1, z: hitPos.z };
      if (this.world.getBlock(placePos.x, placePos.y, placePos.z) === BlockType.AIR) {
        this.world.setBlock(placePos.x, placePos.y, placePos.z, BlockType.WHEAT_0);
        this.consumeActiveItem();
        AudioManager.getInstance().playBlockPlace('grass');
        return;
      }
    }

    // 5. Placing Blocks against hit face
    if (itemDef.isBlock && itemDef.blockId !== undefined) {
      const norm = this.targetHit.faceNormal;
      const placeX = hitPos.x + norm.x;
      const placeY = hitPos.y + norm.y;
      const placeZ = hitPos.z + norm.z;

      // Ensure target position is AIR
      const targetExisting = this.world.getBlock(placeX, placeY, placeZ);
      if (targetExisting !== BlockType.AIR && targetExisting !== BlockType.WATER) return;

      // Check collision with player AABB
      const playerMinX = this.position.x - this.width / 2;
      const playerMaxX = this.position.x + this.width / 2;
      const playerMinY = this.position.y;
      const playerMaxY = this.position.y + this.height;
      const playerMinZ = this.position.z - this.width / 2;
      const playerMaxZ = this.position.z + this.width / 2;

      const collidesWithPlayer = (
        placeX + 1 > playerMinX && placeX < playerMaxX &&
        placeY + 1 > playerMinY && placeY < playerMaxY &&
        placeZ + 1 > playerMinZ && placeZ < playerMaxZ
      );

      // Disallow placing solid block inside player
      if (collidesWithPlayer && itemDef.blockId !== BlockType.TORCH && itemDef.blockId !== BlockType.LADDER) {
        return;
      }

      this.world.setBlock(placeX, placeY, placeZ, itemDef.blockId);

      const placeSound = (itemDef.blockId === BlockType.OAK_PLANKS || itemDef.blockId === BlockType.OAK_LOG) ? 'wood' :
        (itemDef.blockId === BlockType.DIRT || itemDef.blockId === BlockType.GRASS) ? 'grass' : 'stone';
      AudioManager.getInstance().playBlockPlace(placeSound);

      if (this.gameMode === 'survival') {
        this.consumeActiveItem();
      }
    }
  }

  public consumeActiveItem() {
    const item = this.getActiveItem();
    if (!item) return;
    item.count--;
    if (item.count <= 0) {
      this.hotbar[this.activeSlot] = null;
    }
  }

  /**
   * Add item stack to hotbar or main inventory
   */
  public addItem(stack: ItemStack): boolean {
    const itemDef = ITEM_REGISTRY[stack.id];
    const maxStack = itemDef?.maxStack ?? 64;

    // 1. Try stacking onto existing matching slots in hotbar
    for (let i = 0; i < 9; i++) {
      const slot = this.hotbar[i];
      if (slot && slot.id === stack.id && slot.count < maxStack) {
        const canAdd = Math.min(stack.count, maxStack - slot.count);
        slot.count += canAdd;
        stack.count -= canAdd;
        if (stack.count <= 0) return true;
      }
    }

    // 2. Try stacking onto existing matching slots in main inventory
    for (let i = 0; i < 27; i++) {
      const slot = this.inventory[i];
      if (slot && slot.id === stack.id && slot.count < maxStack) {
        const canAdd = Math.min(stack.count, maxStack - slot.count);
        slot.count += canAdd;
        stack.count -= canAdd;
        if (stack.count <= 0) return true;
      }
    }

    // 3. Find first empty slot in hotbar
    for (let i = 0; i < 9; i++) {
      if (!this.hotbar[i]) {
        this.hotbar[i] = { ...stack };
        return true;
      }
    }

    // 4. Find first empty slot in main inventory
    for (let i = 0; i < 27; i++) {
      if (!this.inventory[i]) {
        this.inventory[i] = { ...stack };
        return true;
      }
    }

    return false; // Inventory full
  }
}
