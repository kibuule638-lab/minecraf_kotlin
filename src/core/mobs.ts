/**
 * @file mobs.ts
 * Composite 3-12 part procedural 3D mobs (Pig, Cow, Sheep, Chicken, Zombie, Skeleton, Creeper)
 * with AI wandering, chasing, daylight burning, shearing, combat knockback, and drops.
 */

import * as THREE from 'three';
import { MobType, BlockType, ItemStack } from '../types/voxel';
import { VoxelWorld } from './world';
import { Player } from './player';
import { AudioManager } from './audio';

export class Mob {
  public id: string;
  public type: MobType;
  public group: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public yaw: number = 0;

  public health: number;
  public maxHealth: number;
  public isHostile: boolean;
  public isSheared: boolean = false;

  // Parts for animation
  private head: THREE.Mesh;
  private legParts: THREE.Mesh[] = [];
  private armParts: THREE.Mesh[] = [];
  private bodyParts: THREE.Mesh[] = [];
  private walkTime: number = 0;

  // AI
  private wanderTimer: number = 0;
  private wanderDir: THREE.Vector3 = new THREE.Vector3();
  private attackCooldown: number = 0;
  private hurtTimer: number = 0;
  private creeperFuse: number = 0;
  private materials: THREE.MeshLambertMaterial[] = [];

  constructor(type: MobType, pos: THREE.Vector3) {
    this.id = `mob_${Date.now()}_${Math.random()}`;
    this.type = type;
    this.position = pos.clone();
    this.group = new THREE.Group();

    this.isHostile = (type === MobType.ZOMBIE || type === MobType.SKELETON || type === MobType.CREEPER);
    this.maxHealth = this.isHostile ? 20 : (type === MobType.CHICKEN ? 4 : 10);
    this.health = this.maxHealth;

    const parts = this.buildVoxelMesh(type);
    this.head = parts.head;
    this.legParts = parts.legs;
    this.armParts = parts.arms;
    this.bodyParts = parts.body;

    this.group.position.copy(this.position);
  }

  /**
   * Constructs procedural 3-12 part voxel model
   */
  private buildVoxelMesh(type: MobType) {
    const legs: THREE.Mesh[] = [];
    const arms: THREE.Mesh[] = [];
    const bodyParts: THREE.Mesh[] = [];

    const makeMat = (color: number) => {
      const mat = new THREE.MeshLambertMaterial({ color });
      this.materials.push(mat);
      return mat;
    };

    let head: THREE.Mesh;

    if (type === MobType.PIG) {
      // Pig: Pink body, 4 stubby legs, box head with snout
      const pink = makeMat(0xf0a19c);
      const darkPink = makeMat(0xd47771);

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.9, 0.6, 1.2);
      const body = new THREE.Mesh(bodyGeo, pink);
      body.position.set(0, 0.6, 0);
      this.group.add(body);
      bodyParts.push(body);

      // Head + Snout
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      head = new THREE.Mesh(headGeo, pink);
      head.position.set(0, 0.8, 0.7);

      const snoutGeo = new THREE.BoxGeometry(0.25, 0.15, 0.1);
      const snout = new THREE.Mesh(snoutGeo, darkPink);
      snout.position.set(0, -0.08, 0.28);
      head.add(snout);
      this.group.add(head);

      // 4 Legs
      const legGeo = new THREE.BoxGeometry(0.24, 0.45, 0.24);
      const legPositions = [
        [-0.3, 0.22, 0.4], [0.3, 0.22, 0.4],
        [-0.3, 0.22, -0.4], [0.3, 0.22, -0.4]
      ];
      for (const lp of legPositions) {
        const leg = new THREE.Mesh(legGeo, pink);
        leg.position.set(lp[0], lp[1], lp[2]);
        this.group.add(leg);
        legs.push(leg);
      }
    } else if (type === MobType.COW) {
      // Cow: Brown-black and white patched body, head with horns, 4 legs
      const brown = makeMat(0x4a3425);
      const hornMat = makeMat(0xdedede);

      const bodyGeo = new THREE.BoxGeometry(0.9, 0.8, 1.3);
      const body = new THREE.Mesh(bodyGeo, brown);
      body.position.set(0, 0.8, 0);
      this.group.add(body);
      bodyParts.push(body);

      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      head = new THREE.Mesh(headGeo, brown);
      head.position.set(0, 1.1, 0.8);

      // Horns
      const hornGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.25, 0.3, 0);
      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.25, 0.3, 0);
      head.add(hornL, hornR);
      this.group.add(head);

      // 4 Legs
      const legGeo = new THREE.BoxGeometry(0.25, 0.65, 0.25);
      const legPositions = [
        [-0.3, 0.32, 0.45], [0.3, 0.32, 0.45],
        [-0.3, 0.32, -0.45], [0.3, 0.32, -0.45]
      ];
      for (const lp of legPositions) {
        const leg = new THREE.Mesh(legGeo, brown);
        leg.position.set(lp[0], lp[1], lp[2]);
        this.group.add(leg);
        legs.push(leg);
      }
    } else if (type === MobType.SHEEP) {
      // Sheep: White woolly body, pink skin face, 4 legs
      const wool = makeMat(0xeeeeee);
      const skin = makeMat(0xd8b59e);

      const bodyGeo = new THREE.BoxGeometry(1.0, 0.75, 1.3);
      const body = new THREE.Mesh(bodyGeo, wool);
      body.position.set(0, 0.75, 0);
      this.group.add(body);
      bodyParts.push(body);

      const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.55);
      head = new THREE.Mesh(headGeo, skin);
      head.position.set(0, 0.95, 0.75);
      this.group.add(head);

      const legGeo = new THREE.BoxGeometry(0.24, 0.55, 0.24);
      const legPositions = [
        [-0.3, 0.27, 0.4], [0.3, 0.27, 0.4],
        [-0.3, 0.27, -0.4], [0.3, 0.27, -0.4]
      ];
      for (const lp of legPositions) {
        const leg = new THREE.Mesh(legGeo, skin);
        leg.position.set(lp[0], lp[1], lp[2]);
        this.group.add(leg);
        legs.push(leg);
      }
    } else if (type === MobType.CHICKEN) {
      // Chicken: Small white body, wings, red wattle, yellow beak
      const white = makeMat(0xffffff);
      const red = makeMat(0xdd2222);
      const yellow = makeMat(0xffbb00);

      const bodyGeo = new THREE.BoxGeometry(0.4, 0.35, 0.5);
      const body = new THREE.Mesh(bodyGeo, white);
      body.position.set(0, 0.35, 0);
      this.group.add(body);
      bodyParts.push(body);

      const headGeo = new THREE.BoxGeometry(0.25, 0.3, 0.25);
      head = new THREE.Mesh(headGeo, white);
      head.position.set(0, 0.55, 0.25);

      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), yellow);
      beak.position.set(0, -0.05, 0.16);
      head.add(beak);

      const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), red);
      wattle.position.set(0, -0.15, 0.1);
      head.add(wattle);
      this.group.add(head);

      // 2 Legs
      const legGeo = new THREE.BoxGeometry(0.08, 0.25, 0.08);
      const legL = new THREE.Mesh(legGeo, yellow);
      legL.position.set(-0.1, 0.12, 0);
      const legR = new THREE.Mesh(legGeo, yellow);
      legR.position.set(0.1, 0.12, 0);
      this.group.add(legL, legR);
      legs.push(legL, legR);
    } else if (type === MobType.ZOMBIE) {
      // Zombie: Green skin, cyan shirt, purple pants, outstretched arms
      const skin = makeMat(0x437335);
      const shirt = makeMat(0x009a93);
      const pants = makeMat(0x2f357d);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.3), shirt);
      body.position.set(0, 1.1, 0);
      this.group.add(body);
      bodyParts.push(body);

      head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
      head.position.set(0, 1.7, 0);
      this.group.add(head);

      // Outstretched arms
      const armGeo = new THREE.BoxGeometry(0.22, 0.22, 0.65);
      const armL = new THREE.Mesh(armGeo, skin);
      armL.position.set(-0.4, 1.3, 0.35);
      const armR = new THREE.Mesh(armGeo, skin);
      armR.position.set(0.4, 1.3, 0.35);
      this.group.add(armL, armR);
      arms.push(armL, armR);

      // 2 Legs
      const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
      const legL = new THREE.Mesh(legGeo, pants);
      legL.position.set(-0.16, 0.38, 0);
      const legR = new THREE.Mesh(legGeo, pants);
      legR.position.set(0.16, 0.38, 0);
      this.group.add(legL, legR);
      legs.push(legL, legR);
    } else if (type === MobType.CREEPER) {
      // Creeper: Mottled green body, box head with sad face, 4 stubby feet
      const green = makeMat(0x3ea83b);
      const darkGreen = makeMat(0x194517);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), green);
      body.position.set(0, 0.85, 0);
      this.group.add(body);
      bodyParts.push(body);

      head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), green);
      head.position.set(0, 1.45, 0);

      // Face markings
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.02), darkGreen);
      mouth.position.set(0, -0.1, 0.26);
      head.add(mouth);
      this.group.add(head);

      // 4 Feet
      const legGeo = new THREE.BoxGeometry(0.2, 0.35, 0.2);
      const legPositions = [
        [-0.18, 0.17, 0.18], [0.18, 0.17, 0.18],
        [-0.18, 0.17, -0.18], [0.18, 0.17, -0.18]
      ];
      for (const lp of legPositions) {
        const leg = new THREE.Mesh(legGeo, green);
        leg.position.set(lp[0], lp[1], lp[2]);
        this.group.add(leg);
        legs.push(leg);
      }
    } else {
      // Skeleton
      const bone = makeMat(0xc7c7c7);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.25), bone);
      body.position.set(0, 1.1, 0);
      this.group.add(body);
      bodyParts.push(body);

      head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), bone);
      head.position.set(0, 1.7, 0);
      this.group.add(head);

      const armGeo = new THREE.BoxGeometry(0.18, 0.18, 0.65);
      const armL = new THREE.Mesh(armGeo, bone);
      armL.position.set(-0.35, 1.3, 0.3);
      const armR = new THREE.Mesh(armGeo, bone);
      armR.position.set(0.35, 1.3, 0.3);
      this.group.add(armL, armR);
      arms.push(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
      const legL = new THREE.Mesh(legGeo, bone);
      legL.position.set(-0.15, 0.38, 0);
      const legR = new THREE.Mesh(legGeo, bone);
      legR.position.set(0.15, 0.38, 0);
      this.group.add(legL, legR);
      legs.push(legL, legR);
    }

    return { head, legs, arms, body: bodyParts };
  }

  /**
   * Mob AI & Physics Tick
   */
  public update(dt: number, player: Player, world: VoxelWorld, isDayTime: boolean) {
    if (this.health <= 0) return;

    // Reset damage flash
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) {
        for (const mat of this.materials) {
          mat.color.set(mat.userData.origColor || mat.color);
        }
      }
    }

    // Hostile Sunlight Burning (Zombies & Skeletons)
    if (isDayTime && (this.type === MobType.ZOMBIE || this.type === MobType.SKELETON)) {
      const topBlock = world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 2), Math.floor(this.position.z));
      if (topBlock === BlockType.AIR) {
        this.takeDamage(dt * 3, new THREE.Vector3());
      }
    }

    const distToPlayer = this.position.distanceTo(player.position);

    // AI Decision: Hostile Chase vs Passive Wander
    if (this.isHostile && distToPlayer < 16.0 && player.gameMode === 'survival') {
      // Look at and move toward player
      const dirX = player.position.x - this.position.x;
      const dirZ = player.position.z - this.position.z;
      this.yaw = Math.atan2(dirX, dirZ);

      const chaseSpeed = this.type === MobType.CREEPER ? 2.8 : 3.2;
      this.velocity.x = Math.sin(this.yaw) * chaseSpeed;
      this.velocity.z = Math.cos(this.yaw) * chaseSpeed;

      // Creeper Hiss & Detonation
      if (this.type === MobType.CREEPER) {
        if (distToPlayer < 3.2) {
          if (this.creeperFuse === 0) {
            AudioManager.getInstance().playCreeperHiss();
          }
          this.creeperFuse += dt;
          // Scale creep pulse
          const scale = 1.0 + Math.sin(this.creeperFuse * 16) * 0.15;
          this.group.scale.set(scale, scale, scale);

          if (this.creeperFuse >= 1.5) {
            this.explode(world, player);
            return;
          }
        } else {
          this.creeperFuse = Math.max(0, this.creeperFuse - dt);
          this.group.scale.set(1, 1, 1);
        }
      }

      // Attack player on contact
      if (distToPlayer < 1.4) {
        this.attackCooldown += dt;
        if (this.attackCooldown >= 1.2) {
          player.takeDamage(3, 'mob');
          this.attackCooldown = 0;
        }
      }
    } else {
      // Passive wandering
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.0 + Math.random() * 4.0;
        const angle = Math.random() * Math.PI * 2;
        this.yaw = angle;
        const speed = 1.2;
        this.wanderDir.set(Math.sin(angle) * speed, 0, Math.cos(angle) * speed);
      }
      this.velocity.x = this.wanderDir.x;
      this.velocity.z = this.wanderDir.z;
    }

    // Gravity
    this.velocity.y -= 20.0 * dt;

    // Terrain Collision & 1-block auto jump
    const nextY = this.position.y + this.velocity.y * dt;
    const groundBlock = world.getBlock(Math.floor(this.position.x), Math.floor(nextY), Math.floor(this.position.z));
    if (groundBlock !== BlockType.AIR && groundBlock !== BlockType.WATER) {
      this.velocity.y = 0;
    } else {
      this.position.y = nextY;
    }

    // Horizontal stepping
    const targetX = this.position.x + this.velocity.x * dt;
    const targetZ = this.position.z + this.velocity.z * dt;
    const obstBlock = world.getBlock(Math.floor(targetX), Math.floor(this.position.y + 0.3), Math.floor(targetZ));
    if (obstBlock !== BlockType.AIR && obstBlock !== BlockType.WATER) {
      // Try step up
      const aboveBlock = world.getBlock(Math.floor(targetX), Math.floor(this.position.y + 1.2), Math.floor(targetZ));
      if (aboveBlock === BlockType.AIR) {
        this.position.y += 1.0;
        this.position.x = targetX;
        this.position.z = targetZ;
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    } else {
      this.position.x = targetX;
      this.position.z = targetZ;
    }

    // Leg swinging animation
    const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
    if (isMoving) {
      this.walkTime += dt * 8;
      const legAngle = Math.sin(this.walkTime) * 0.6;
      for (let i = 0; i < this.legParts.length; i++) {
        this.legParts[i].rotation.x = (i % 2 === 0) ? legAngle : -legAngle;
      }
    } else {
      for (const leg of this.legParts) leg.rotation.x = 0;
    }

    // Update group transform
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  /**
   * Take weapon damage and apply knockback
   */
  public takeDamage(amount: number, knockbackDir: THREE.Vector3) {
    this.health -= amount;
    this.hurtTimer = 0.2;

    // Red damage flash
    for (const mat of this.materials) {
      if (!mat.userData.origColor) mat.userData.origColor = mat.color.getHex();
      mat.color.setHex(0xff2222);
    }

    AudioManager.getInstance().playHit(false);

    // Apply knockback
    this.velocity.x += knockbackDir.x * 6;
    this.velocity.y += 4;
    this.velocity.z += knockbackDir.z * 6;
  }

  /**
   * Creeper explosion effect
   */
  private explode(world: VoxelWorld, player: Player) {
    AudioManager.getInstance().playExplosion();
    const bx = Math.floor(this.position.x);
    const by = Math.floor(this.position.y);
    const bz = Math.floor(this.position.z);

    // Crater radius 2
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dx * dx + dy * dy + dz * dz <= 5) {
            const blk = world.getBlock(bx + dx, by + dy, bz + dz);
            if (blk !== BlockType.BEDROCK) {
              world.setBlock(bx + dx, by + dy, bz + dz, BlockType.AIR);
            }
          }
        }
      }
    }

    // Player explosion damage
    const dist = this.position.distanceTo(player.position);
    if (dist < 5.0) {
      player.takeDamage(Math.floor((5.0 - dist) * 3), 'explosion');
    }

    this.health = 0;
  }

  /**
   * Drops items on death
   */
  public getDrops(): ItemStack[] {
    switch (this.type) {
      case MobType.PIG:
        return [{ id: 'raw_porkchop', count: 1 + Math.floor(Math.random() * 2) }];
      case MobType.COW:
        return [
          { id: 'raw_beef', count: 1 + Math.floor(Math.random() * 2) },
          { id: 'leather', count: Math.random() > 0.5 ? 1 : 0 }
        ];
      case MobType.SHEEP:
        return [
          { id: 'raw_beef', count: 1 },
          { id: 'white_wool', count: this.isSheared ? 0 : 1 }
        ];
      case MobType.CHICKEN:
        return [
          { id: 'feather', count: 1 + Math.floor(Math.random() * 2) }
        ];
      case MobType.ZOMBIE:
        return [{ id: 'dirt', count: 1 }]; // Rotten flesh / dirt
      case MobType.SKELETON:
        return [{ id: 'bone', count: 1 + Math.floor(Math.random() * 2) }];
      case MobType.CREEPER:
        return [{ id: 'gunpowder', count: 1 + Math.floor(Math.random() * 2) }];
      default:
        return [];
    }
  }

  public dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    for (const mat of this.materials) mat.dispose();
  }
}

export class MobManager {
  public mobs: Mob[] = [];
  public scene: THREE.Scene;
  public world: VoxelWorld;
  private spawnTimer: number = 0;

  constructor(scene: THREE.Scene, world: VoxelWorld) {
    this.scene = scene;
    this.world = world;
  }

  public spawnMob(type: MobType, pos: THREE.Vector3): Mob {
    const mob = new Mob(type, pos);
    this.scene.add(mob.group);
    this.mobs.push(mob);
    return mob;
  }

  public update(dt: number, player: Player, isDayTime: boolean) {
    // Mob spawning loop
    this.spawnTimer += dt;
    if (this.spawnTimer >= 8.0 && this.mobs.length < 16) {
      this.spawnTimer = 0;
      this.attemptSpawn(player, isDayTime);
    }

    // Update active mobs
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      mob.update(dt, player, this.world, isDayTime);

      if (mob.health <= 0) {
        // Drop items
        const drops = mob.getDrops();
        for (const drop of drops) {
          if (drop.count > 0) {
            this.world.spawnDroppedItem(drop, mob.position.x, mob.position.y, mob.position.z);
          }
        }
        mob.dispose(this.scene);
        this.mobs.splice(i, 1);
      }
    }
  }

  /**
   * Spawn mob in a ring around the player (between 18 and 36 blocks away)
   */
  private attemptSpawn(player: Player, isDayTime: boolean) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 18;
    const sx = Math.floor(player.position.x + Math.sin(angle) * dist);
    const sz = Math.floor(player.position.z + Math.cos(angle) * dist);

    // Find surface Y
    for (let y = 100; y >= 20; y--) {
      const b = this.world.getBlock(sx, y, sz);
      const above = this.world.getBlock(sx, y + 1, sz);
      if (b !== BlockType.AIR && b !== BlockType.WATER && above === BlockType.AIR) {
        let type = MobType.COW;
        if (isDayTime) {
          const r = Math.random();
          type = r > 0.75 ? MobType.PIG : r > 0.5 ? MobType.SHEEP : r > 0.25 ? MobType.COW : MobType.CHICKEN;
        } else {
          const r = Math.random();
          type = r > 0.6 ? MobType.ZOMBIE : r > 0.3 ? MobType.SKELETON : MobType.CREEPER;
        }
        this.spawnMob(type, new THREE.Vector3(sx + 0.5, y + 1, sz + 0.5));
        break;
      }
    }
  }

  /**
   * Check if player hits a mob with attack raycast
   */
  public hitTest(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3, attackRange = 3.8): Mob | null {
    for (const mob of this.mobs) {
      const toMob = new THREE.Vector3().subVectors(mob.position, rayOrigin);
      const proj = toMob.dot(rayDir);
      if (proj > 0 && proj < attackRange) {
        const perp = new THREE.Vector3().copy(rayDir).multiplyScalar(proj).sub(toMob);
        if (perp.length() < 0.75) {
          return mob;
        }
      }
    }
    return null;
  }
}
