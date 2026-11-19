/**
 * @file chunk.ts
 * Chunk voxel container with high-performance Greedy Meshing, per-face culling,
 * directional shading, and ambient occlusion.
 */

import * as THREE from 'three';
import { BlockType } from '../types/voxel';
import { TextureManager } from './textures';
import { CHUNK_SIZE, WORLD_HEIGHT } from './worldGen';

// Direction vectors: [x, y, z]
const FACE_DIRECTIONS = [
  { dir: [1, 0, 0], face: 'east', normal: [1, 0, 0], light: 0.7 },
  { dir: [-1, 0, 0], face: 'west', normal: [-1, 0, 0], light: 0.7 },
  { dir: [0, 1, 0], face: 'top', normal: [0, 1, 0], light: 1.0 },
  { dir: [0, -1, 0], face: 'bottom', normal: [0, -1, 0], light: 0.5 },
  { dir: [0, 0, 1], face: 'south', normal: [0, 0, 1], light: 0.85 },
  { dir: [0, 0, -1], face: 'north', normal: [0, 0, -1], light: 0.85 },
];

export class Chunk {
  public cx: number;
  public cz: number;
  public voxels: Uint8Array;
  public mesh: THREE.Mesh | null = null;
  public plantMesh: THREE.Mesh | null = null;
  public waterMesh: THREE.Mesh | null = null;
  public isDirty: boolean = true;
  public isLoaded: boolean = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.voxels = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  }

  public getIndex(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  public getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.AIR;
    }
    return this.voxels[this.getIndex(x, y, z)];
  }

  public setBlock(x: number, y: number, z: number, block: BlockType): boolean {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return false;
    }
    const idx = this.getIndex(x, y, z);
    if (this.voxels[idx] !== block) {
      this.voxels[idx] = block;
      this.isDirty = true;
      return true;
    }
    return false;
  }

  /**
   * Helper to determine block transparency
   */
  public static isTransparent(block: BlockType): boolean {
    if (block === BlockType.AIR) return true;
    if (block === BlockType.WATER) return true;
    if (block === BlockType.GLASS) return true;
    if (block === BlockType.OAK_LEAVES || block === BlockType.BIRCH_LEAVES || block === BlockType.SPRUCE_LEAVES) return true;
    if (block === BlockType.TORCH || block === BlockType.REDSTONE_TORCH || block === BlockType.LADDER) return true;
    if (block >= BlockType.WHEAT_0 && block <= BlockType.TALL_GRASS) return true;
    return false;
  }

  /**
   * Is this block rendered as a plant (cross billboard)?
   */
  public static isCrossMesh(block: BlockType): boolean {
    return (
      (block >= BlockType.WHEAT_0 && block <= BlockType.WHEAT_3) ||
      block === BlockType.POPPY ||
      block === BlockType.DANDELION ||
      block === BlockType.TALL_GRASS
    );
  }

  /**
   * Builds chunk geometries using Greedy Meshing and Per-Face Culling
   */
  public buildMesh(
    worldGetBlock: (wx: number, wy: number, wz: number) => BlockType,
    opaqueMat: THREE.Material,
    translucentMat: THREE.Material,
    plantMat: THREE.Material
  ) {
    const tm = TextureManager.getInstance();

    // Buffers for opaque/solid geometry
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];

    // Buffers for water/glass (semi-translucent)
    const waterPositions: number[] = [];
    const waterNormals: number[] = [];
    const waterUvs: number[] = [];
    const waterColors: number[] = [];

    // Buffers for plant crosses & attached items (flowers, grass, torches)
    const plantPositions: number[] = [];
    const plantNormals: number[] = [];
    const plantUvs: number[] = [];
    const plantColors: number[] = [];

    const getBlockGlobal = (lx: number, ly: number, lz: number): BlockType => {
      if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < WORLD_HEIGHT && lz >= 0 && lz < CHUNK_SIZE) {
        return this.voxels[this.getIndex(lx, ly, lz)];
      }
      return worldGetBlock(this.cx * CHUNK_SIZE + lx, ly, this.cz * CHUNK_SIZE + lz);
    };

    // Helper for vertex AO (Ambient Occlusion)
    const computeAO = (side1: boolean, side2: boolean, corner: boolean): number => {
      if (side1 && side2) return 0.55;
      return 1.0 - (Number(side1) + Number(side2) + Number(corner)) * 0.15;
    };

    // ─────────────────────────────────────────────────────────────────
    // 1. GREEDY MESHING FOR SOLID & WATER BLOCKS
    // ─────────────────────────────────────────────────────────────────
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;

      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[d] = 1;

      const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];
      const uLimit = dims[u];
      const vLimit = dims[v];
      const dLimit = dims[d];

      // Mask stores { block, dir: +1 / -1 }
      const mask: { block: BlockType; dir: number }[] = new Array(uLimit * vLimit);

      // Sweep through slices along dimension d
      for (x[d] = -1; x[d] < dLimit; ) {
        let n = 0;

        for (x[v] = 0; x[v] < vLimit; x[v]++) {
          for (x[u] = 0; x[u] < uLimit; x[u]++) {
            const bA = (x[d] >= 0) ? getBlockGlobal(x[0], x[1], x[2]) : BlockType.AIR;
            const bB = (x[d] < dLimit - 1) ? getBlockGlobal(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : BlockType.AIR;

            const solidA = bA !== BlockType.AIR && !Chunk.isCrossMesh(bA);
            const solidB = bB !== BlockType.AIR && !Chunk.isCrossMesh(bB);

            const transA = Chunk.isTransparent(bA);
            const transB = Chunk.isTransparent(bB);

            // Determine if a face should be rendered between A and B
            if (solidA && (transB || (bA !== bB && (transA || transB)))) {
              mask[n++] = { block: bA, dir: 1 }; // Face pointing towards B
            } else if (solidB && (transA || (bA !== bB && (transA || transB)))) {
              mask[n++] = { block: bB, dir: -1 }; // Face pointing towards A
            } else {
              mask[n++] = { block: BlockType.AIR, dir: 0 };
            }
          }
        }

        x[d]++;
        n = 0;

        // Greedy scan across the slice mask
        for (let j = 0; j < vLimit; j++) {
          for (let i = 0; i < uLimit; ) {
            const current = mask[n];
            if (current && current.block !== BlockType.AIR && current.dir !== 0) {
              const currentBlock = current.block;
              const currentDir = current.dir;

              // Compute width of run
              let w = 1;
              while (
                i + w < uLimit &&
                mask[n + w]?.block === currentBlock &&
                mask[n + w]?.dir === currentDir
              ) {
                w++;
              }

              // Compute height of run
              let h = 1;
              let canExtend = true;
              while (j + h < vLimit && canExtend) {
                for (let k = 0; k < w; k++) {
                  const nextCell = mask[n + k + h * uLimit];
                  if (!nextCell || nextCell.block !== currentBlock || nextCell.dir !== currentDir) {
                    canExtend = false;
                    break;
                  }
                }
                if (canExtend) h++;
              }

              // Define quad corners
              x[u] = i;
              x[v] = j;

              const du = [0, 0, 0];
              du[u] = w;
              const dv = [0, 0, 0];
              dv[v] = h;

              // Determine face normal and face identifier
              let faceKey: 'top' | 'bottom' | 'side' | 'north' | 'south' | 'east' | 'west' = 'side';
              let norm = [0, 0, 0];
              let lightVal = 0.8;

              if (d === 1) {
                faceKey = currentDir > 0 ? 'top' : 'bottom';
                norm = currentDir > 0 ? [0, 1, 0] : [0, -1, 0];
                lightVal = currentDir > 0 ? 1.0 : 0.55;
              } else if (d === 0) {
                faceKey = currentDir > 0 ? 'east' : 'west';
                norm = currentDir > 0 ? [1, 0, 0] : [-1, 0, 0];
                lightVal = 0.75;
              } else {
                faceKey = currentDir > 0 ? 'south' : 'north';
                norm = currentDir > 0 ? [0, 0, 1] : [0, 0, -1];
                lightVal = 0.85;
              }

              const texUv = tm.getBlockFaceUV(currentBlock, faceKey);

              // Target buffers (water vs opaque)
              const isWater = currentBlock === BlockType.WATER || currentBlock === BlockType.LAVA || currentBlock === BlockType.GLASS;
              const targetPos = isWater ? waterPositions : positions;
              const targetNorm = isWater ? waterNormals : normals;
              const targetUv = isWater ? waterUvs : uvs;
              const targetCol = isWater ? waterColors : colors;

              // 4 Quad Vertices
              const p0 = [x[0], x[1], x[2]];
              const p1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
              const p2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
              const p3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];

              // Emit two triangles (winding depending on direction)
              if (currentDir > 0) {
                // p0 -> p1 -> p2, p0 -> p2 -> p3
                this.addQuad(
                  targetPos, targetNorm, targetUv, targetCol,
                  p0, p1, p2, p3,
                  norm, texUv, lightVal, w, h
                );
              } else {
                // Reversed winding for opposite face
                this.addQuad(
                  targetPos, targetNorm, targetUv, targetCol,
                  p0, p3, p2, p1,
                  norm, texUv, lightVal, w, h
                );
              }

              // Clear visited area in mask
              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[n + k + l * uLimit] = { block: BlockType.AIR, dir: 0 };
                }
              }

              i += w;
              n += w;
            } else {
              i++;
              n++;
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. CROSS-MESH GEOMETRY (Flowers, Tall Grass, Crops, Torches)
    // ─────────────────────────────────────────────────────────────────
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const b = this.voxels[this.getIndex(x, y, z)];

          if (Chunk.isCrossMesh(b)) {
            const uv = tm.getBlockFaceUV(b, 'top');
            this.addCrossMesh(plantPositions, plantNormals, plantUvs, plantColors, x, y, z, uv);
          } else if (b === BlockType.TORCH || b === BlockType.REDSTONE_TORCH) {
            const uv = tm.getUV(b === BlockType.REDSTONE_TORCH ? 'redstone_torch_on' : 'torch');
            this.addTorchMesh(plantPositions, plantNormals, plantUvs, plantColors, x, y, z, uv);
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. CREATE OR UPDATE THREE.JS MESHES
    // ─────────────────────────────────────────────────────────────────
    this.mesh = this.createOrUpdateMesh(this.mesh, positions, normals, uvs, colors, opaqueMat);
    this.waterMesh = this.createOrUpdateMesh(this.waterMesh, waterPositions, waterNormals, waterUvs, waterColors, translucentMat);
    this.plantMesh = this.createOrUpdateMesh(this.plantMesh, plantPositions, plantNormals, plantUvs, plantColors, plantMat);

    this.isDirty = false;
  }

  /**
   * Helper to append a quad into attribute arrays
   */
  private addQuad(
    pos: number[], norm: number[], uvs: number[], cols: number[],
    p0: number[], p1: number[], p2: number[], p3: number[],
    n: number[], uv: { u0: number; v0: number; u1: number; v1: number },
    light: number, w: number, h: number
  ) {
    // Triangle 1: p0, p1, p2
    pos.push(p0[0], p0[1], p0[2]);
    pos.push(p1[0], p1[1], p1[2]);
    pos.push(p2[0], p2[1], p2[2]);

    // Triangle 2: p0, p2, p3
    pos.push(p0[0], p0[1], p0[2]);
    pos.push(p2[0], p2[1], p2[2]);
    pos.push(p3[0], p3[1], p3[2]);

    for (let i = 0; i < 6; i++) {
      norm.push(n[0], n[1], n[2]);
      cols.push(light, light, light);
    }

    // UVs mapped to texture atlas
    uvs.push(uv.u0, uv.v0);
    uvs.push(uv.u1, uv.v0);
    uvs.push(uv.u1, uv.v1);

    uvs.push(uv.u0, uv.v0);
    uvs.push(uv.u1, uv.v1);
    uvs.push(uv.u0, uv.v1);
  }

  /**
   * Cross billboard mesh for flowers, tall grass, crops
   */
  private addCrossMesh(
    pos: number[], norm: number[], uvs: number[], cols: number[],
    x: number, y: number, z: number,
    uv: { u0: number; v0: number; u1: number; v1: number }
  ) {
    // Diagonal 1: (0,0) to (1,1)
    const d1_0 = [x + 0.1, y, z + 0.1];
    const d1_1 = [x + 0.9, y, z + 0.9];
    const d1_2 = [x + 0.9, y + 1, z + 0.9];
    const d1_3 = [x + 0.1, y + 1, z + 0.1];

    // Diagonal 2: (0,1) to (1,0)
    const d2_0 = [x + 0.1, y, z + 0.9];
    const d2_1 = [x + 0.9, y, z + 0.1];
    const d2_2 = [x + 0.9, y + 1, z + 0.1];
    const d2_3 = [x + 0.1, y + 1, z + 0.9];

    const addDoubleSidedQuad = (p0: number[], p1: number[], p2: number[], p3: number[]) => {
      // Front
      this.addQuad(pos, norm, uvs, cols, p0, p1, p2, p3, [0, 1, 0], uv, 0.9, 1, 1);
      // Back
      this.addQuad(pos, norm, uvs, cols, p0, p3, p2, p1, [0, 1, 0], uv, 0.9, 1, 1);
    };

    addDoubleSidedQuad(d1_0, d1_1, d1_2, d1_3);
    addDoubleSidedQuad(d2_0, d2_1, d2_2, d2_3);
  }

  /**
   * Torch 3D Mesh
   */
  private addTorchMesh(
    pos: number[], norm: number[], uvs: number[], cols: number[],
    x: number, y: number, z: number,
    uv: { u0: number; v0: number; u1: number; v1: number }
  ) {
    // 2 small crossed quads in the center of the block
    const d1_0 = [x + 0.4, y, z + 0.5];
    const d1_1 = [x + 0.6, y, z + 0.5];
    const d1_2 = [x + 0.6, y + 0.65, z + 0.5];
    const d1_3 = [x + 0.4, y + 0.65, z + 0.5];

    const d2_0 = [x + 0.5, y, z + 0.4];
    const d2_1 = [x + 0.5, y, z + 0.6];
    const d2_2 = [x + 0.5, y + 0.65, z + 0.6];
    const d2_3 = [x + 0.5, y + 0.65, z + 0.4];

    this.addQuad(pos, norm, uvs, cols, d1_0, d1_1, d1_2, d1_3, [0, 0, 1], uv, 1.0, 1, 1);
    this.addQuad(pos, norm, uvs, cols, d1_0, d1_3, d1_2, d1_1, [0, 0, -1], uv, 1.0, 1, 1);
    this.addQuad(pos, norm, uvs, cols, d2_0, d2_1, d2_2, d2_3, [1, 0, 0], uv, 1.0, 1, 1);
    this.addQuad(pos, norm, uvs, cols, d2_0, d2_3, d2_2, d2_1, [-1, 0, 0], uv, 1.0, 1, 1);
  }

  private createOrUpdateMesh(
    existing: THREE.Mesh | null,
    pos: number[],
    norm: number[],
    uvs: number[],
    cols: number[],
    mat: THREE.Material
  ): THREE.Mesh | null {
    if (pos.length === 0) {
      if (existing) {
        existing.geometry.dispose();
        return null;
      }
      return null;
    }

    const geo = existing ? existing.geometry : new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeBoundingSphere();

    if (!existing) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
    return existing;
  }

  public dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    if (this.plantMesh) {
      this.plantMesh.geometry.dispose();
      this.plantMesh = null;
    }
    this.isLoaded = false;
  }
}
