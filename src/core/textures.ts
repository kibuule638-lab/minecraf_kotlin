/**
 * @file textures.ts
 * Procedural pixel-art texture generator and Minecraft Java Resource Pack (.zip) loader.
 * Uses JSZip to parse standard vanilla packs, builds an atlas with NearestFilter,
 * and falls back to authentic procedural 16x16 pixel-art textures if no pack is loaded.
 */

import * as THREE from 'three';
import JSZip from 'jszip';
import { BlockType } from '../types/voxel';

export interface TextureUV {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface ResourcePackInfo {
  name: string;
  description: string;
  iconDataUrl?: string;
  textureCount: number;
  resolution: number;
}

// Master map of texture name to UV coordinates
export class TextureManager {
  private static instance: TextureManager;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private atlasTexture: THREE.CanvasTexture;
  private textures: Map<string, HTMLCanvasElement | ImageBitmap | HTMLImageElement> = new Map();
  private uvMap: Map<string, TextureUV> = new Map();
  
  public currentPackInfo: ResourcePackInfo = {
    name: 'Procedural Vanilla (Built-in)',
    description: 'Crisp procedural 16x16 pixel-art textures matching vanilla palette.',
    textureCount: 0,
    resolution: 16,
  };

  private listeners: (() => void)[] = [];

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;

    this.atlasTexture = new THREE.CanvasTexture(this.canvas);
    this.atlasTexture.magFilter = THREE.NearestFilter;
    this.atlasTexture.minFilter = THREE.NearestFilter;
    this.atlasTexture.generateMipmaps = false;
    this.atlasTexture.colorSpace = THREE.SRGBColorSpace;

    // Generate full fallback procedural texture set
    this.generateProceduralTextures();
    this.rebuildAtlas();
  }

  public static getInstance(): TextureManager {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    return TextureManager.instance;
  }

  public getTexture(): THREE.CanvasTexture {
    return this.atlasTexture;
  }

  public onAtlasUpdated(cb: () => void) {
    this.listeners.push(cb);
  }

  private notifyUpdate() {
    this.listeners.forEach((cb) => cb());
  }

  /**
   * Returns UV coordinates [u0, v0, u1, v1] for a texture name
   */
  public getUV(name: string): TextureUV {
    const uv = this.uvMap.get(name);
    if (uv) return uv;
    // Fallback to missing/dirt texture
    const fallback = this.uvMap.get('dirt') || { u0: 0, v0: 0, u1: 0.0625, v1: 0.0625 };
    return fallback;
  }

  /**
   * Get UV for a specific block and face ('top', 'bottom', 'side', 'north', etc.)
   */
  public getBlockFaceUV(blockType: BlockType, face: 'top' | 'bottom' | 'side' | 'north' | 'south' | 'east' | 'west'): TextureUV {
    const texName = this.getBlockTextureName(blockType, face);
    return this.getUV(texName);
  }

  /**
   * Rebuild the 2D texture atlas grid from all stored textures
   */
  public rebuildAtlas() {
    const list = Array.from(this.textures.entries());
    const count = list.length;
    if (count === 0) return;

    // Choose grid size (e.g. 16x16 or 32x32 tiles)
    const gridSize = Math.ceil(Math.sqrt(count));
    const tileSize = 32; // Standard tile slot size on atlas canvas
    const atlasDim = Math.max(512, Math.min(2048, gridSize * tileSize));

    this.canvas.width = atlasDim;
    this.canvas.height = atlasDim;
    this.ctx.clearRect(0, 0, atlasDim, atlasDim);
    this.ctx.imageSmoothingEnabled = false;

    const actualTileW = atlasDim / gridSize;
    const actualTileH = atlasDim / gridSize;

    this.uvMap.clear();

    for (let i = 0; i < count; i++) {
      const [name, img] = list[i];
      const col = i % gridSize;
      const row = Math.floor(i / gridSize);

      const px = col * actualTileW;
      const py = row * actualTileH;

      this.ctx.drawImage(img, px, py, actualTileW, actualTileH);

      // In Three.js CanvasTexture UVs:
      // U goes 0 -> 1 left to right
      // V goes 0 -> 1 bottom to top, but CanvasTexture flips Y by default (flipY = true)
      // When flipY = true: v0 = 1 - (py + actualTileH)/atlasDim, v1 = 1 - py/atlasDim
      const u0 = px / atlasDim;
      const u1 = (px + actualTileW) / atlasDim;
      const v0 = 1.0 - (py + actualTileH) / atlasDim;
      const v1 = 1.0 - py / atlasDim;

      this.uvMap.set(name, { u0, v0, u1, v1 });
    }

    this.atlasTexture.needsUpdate = true;
    this.currentPackInfo.textureCount = count;
    this.notifyUpdate();
  }

  /**
   * Loads a standard Minecraft Java resource pack (.zip)
   */
  public async loadResourcePack(file: File | Blob): Promise<ResourcePackInfo> {
    try {
      const zip = await JSZip.loadAsync(file);

      let loadedCount = 0;
      let packName = file instanceof File ? file.name.replace(/\.zip$/i, '') : 'Resource Pack';
      let packDesc = 'Custom Minecraft Java Resource Pack';
      let packIconUrl: string | undefined = undefined;
      let detectedRes = 16;

      // Check for pack.mcmeta
      const mcmeta = zip.file('pack.mcmeta');
      if (mcmeta) {
        try {
          const text = await mcmeta.async('text');
          const json = JSON.parse(text);
          if (json.pack?.description) {
            packDesc = typeof json.pack.description === 'string'
              ? json.pack.description
              : JSON.stringify(json.pack.description);
          }
        } catch {
          // Ignore json parse error
        }
      }

      // Check for pack.png
      const packPng = zip.file('pack.png');
      if (packPng) {
        try {
          const blob = await packPng.async('blob');
          packIconUrl = URL.createObjectURL(blob);
        } catch {
          // Ignore
        }
      }

      // Scan all image entries in assets/minecraft/textures/block/ and textures/item/
      const imagePromises: Promise<void>[] = [];

      zip.forEach((relativePath, zipEntry) => {
        // Ignore OptiFine, mcpatcher, animated .mcmeta, .properties
        if (zipEntry.dir) return;
        if (relativePath.includes('optifine/') || relativePath.includes('mcpatcher/')) return;
        if (relativePath.endsWith('.mcmeta') || relativePath.endsWith('.properties') || relativePath.endsWith('.json')) return;

        // Standard 1.13+ paths: assets/minecraft/textures/block/*.png, item/*.png
        // Also support 1.12 legacy paths: assets/minecraft/textures/blocks/*.png, items/*.png
        const isBlockTex = relativePath.match(/assets\/minecraft\/textures\/blocks?\/([^/]+)\.png$/i);
        const isItemTex = relativePath.match(/assets\/minecraft\/textures\/items?\/([^/]+)\.png$/i);

        if (isBlockTex || isItemTex) {
          const rawName = (isBlockTex ? isBlockTex[1] : isItemTex![1]).toLowerCase();
          
          const p = zipEntry.async('blob').then(async (blob) => {
            const bmp = await createImageBitmap(blob);
            detectedRes = Math.max(detectedRes, bmp.width);

            // If animated texture strip (height > width), crop top still frame!
            let canvas = document.createElement('canvas');
            canvas.width = bmp.width;
            canvas.height = bmp.width;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bmp, 0, 0, bmp.width, bmp.width, 0, 0, bmp.width, bmp.width);

            this.textures.set(rawName, canvas);
            loadedCount++;
          }).catch(() => {
            // Gracefully ignore corrupt/unknown image
          });

          imagePromises.push(p);
        }
      });

      await Promise.all(imagePromises);

      if (loadedCount > 0) {
        this.currentPackInfo = {
          name: packName,
          description: packDesc,
          iconDataUrl: packIconUrl,
          textureCount: loadedCount,
          resolution: detectedRes,
        };
        this.rebuildAtlas();
      }

      return this.currentPackInfo;
    } catch (err) {
      console.error('Failed to load resource pack zip:', err);
      throw new Error('Could not parse resource pack .zip file. Check file integrity.');
    }
  }

  /**
   * Reset textures back to procedural fallback
   */
  public resetToProcedural() {
    this.textures.clear();
    this.generateProceduralTextures();
    this.currentPackInfo = {
      name: 'Procedural Vanilla (Built-in)',
      description: 'Crisp procedural 16x16 pixel-art textures matching vanilla palette.',
      textureCount: this.textures.size,
      resolution: 16,
    };
    this.rebuildAtlas();
  }

  /**
   * Helper to draw a 16x16 pixel art canvas
   */
  private createPixelCanvas(drawFn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx);
    return c;
  }

  /**
   * Procedural texture generator with vanilla-matching colors and noise
   */
  private generateProceduralTextures() {
    // Utility noise helper for mottled pixel art
    const noise = (x: number, y: number, seed: number = 0) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
      return n - Math.floor(n);
    };

    // Color adjust helper
    const varyColor = (baseHex: string, delta: number, rRand: number) => {
      const r = parseInt(baseHex.slice(1, 3), 16);
      const g = parseInt(baseHex.slice(3, 5), 16);
      const b = parseInt(baseHex.slice(5, 7), 16);
      const shift = Math.floor((rRand - 0.5) * delta);
      const clamp = (v: number) => Math.max(0, Math.min(255, v + shift));
      return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
    };

    // 1. Dirt
    this.textures.set('dirt', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 1);
          ctx.fillStyle = n > 0.6 ? '#6d4c28' : n > 0.3 ? '#866037' : '#573d20';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 2. Grass Top
    this.textures.set('grass_block_top', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 2);
          ctx.fillStyle = n > 0.65 ? '#5bb534' : n > 0.3 ? '#4c9b2b' : '#3d7d22';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 3. Grass Side (Dirt with grassy drip at top)
    this.textures.set('grass_block_side', this.createPixelCanvas((ctx) => {
      // Base dirt
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 1);
          ctx.fillStyle = n > 0.6 ? '#6d4c28' : n > 0.3 ? '#866037' : '#573d20';
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // Top grass overlay with hanging drips
      const drops = [3, 4, 3, 5, 4, 3, 3, 4, 5, 3, 4, 3, 4, 5, 4, 3];
      for (let x = 0; x < 16; x++) {
        const h = drops[x];
        for (let y = 0; y < h; y++) {
          const n = noise(x, y, 2);
          ctx.fillStyle = n > 0.5 ? '#5bb534' : '#4c9b2b';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 4. Stone
    this.textures.set('stone', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 4);
          ctx.fillStyle = n > 0.7 ? '#858585' : n > 0.3 ? '#737373' : '#616161';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 5. Cobblestone
    this.textures.set('cobblestone', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#4f4f4f';
      ctx.fillRect(0, 0, 16, 16);
      // Irregular stone bricks
      const stones = [
        { x: 0, y: 0, w: 5, h: 4 }, { x: 6, y: 0, w: 6, h: 3 }, { x: 13, y: 0, w: 3, h: 4 },
        { x: 0, y: 5, w: 7, h: 5 }, { x: 8, y: 4, w: 8, h: 5 },
        { x: 0, y: 11, w: 5, h: 5 }, { x: 6, y: 10, w: 6, h: 6 }, { x: 13, y: 10, w: 3, h: 6 },
      ];
      for (const s of stones) {
        for (let sy = 0; sy < s.h; sy++) {
          for (let sx = 0; sx < s.w; sx++) {
            const edge = sx === 0 || sy === 0;
            const darkEdge = sx === s.w - 1 || sy === s.h - 1;
            const n = noise(s.x + sx, s.y + sy, 5);
            ctx.fillStyle = edge ? '#9c9c9c' : darkEdge ? '#434343' : n > 0.5 ? '#7a7a7a' : '#6b6b6b';
            ctx.fillRect(s.x + sx, s.y + sy, 1, 1);
          }
        }
      }
    }));

    // 6. Bedrock
    this.textures.set('bedrock', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 6);
          ctx.fillStyle = n > 0.7 ? '#505050' : n > 0.4 ? '#333333' : '#141414';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 7. Sand
    this.textures.set('sand', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 7);
          ctx.fillStyle = n > 0.7 ? '#f7e9a8' : n > 0.35 ? '#ebd388' : '#d6bb6b';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 8. Gravel
    this.textures.set('gravel', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 8);
          ctx.fillStyle = n > 0.75 ? '#988c8a' : n > 0.45 ? '#7f7472' : n > 0.2 ? '#6c6260' : '#574e4c';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 9. Oak Log Side
    this.textures.set('oak_log', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const barkX = (x % 4 === 0) ? '#4a3319' : (x % 2 === 0) ? '#674a27' : '#5a3f20';
          const n = noise(x, y, 9);
          ctx.fillStyle = varyColor(barkX, 25, n);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 10. Oak Log Top
    this.textures.set('oak_log_top', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 6.5) {
            ctx.fillStyle = '#4a3319'; // Outer bark
          } else if (d > 4.5 && d <= 5.5) {
            ctx.fillStyle = '#8f6e40'; // Ring
          } else if (d > 2.0 && d <= 3.0) {
            ctx.fillStyle = '#8f6e40'; // Inner ring
          } else {
            ctx.fillStyle = '#ad8953'; // Heartwood
          }
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 11. Oak Leaves (cutout alpha)
    this.textures.set('oak_leaves', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 11);
          if (n > 0.22) { // Transparent holes
            ctx.fillStyle = n > 0.75 ? '#5db331' : n > 0.5 ? '#439420' : '#2f6d14';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }));

    // 12. Glass
    this.textures.set('glass', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      // Border frame
      ctx.fillStyle = '#d0e7f9';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Diagonal glint
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 2, 1);
      ctx.fillRect(3, 3, 2, 1);
      ctx.fillRect(11, 10, 2, 1);
      ctx.fillRect(12, 11, 2, 1);
    }));

    // 13. Water Still
    this.textures.set('water_still', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 13);
          ctx.fillStyle = n > 0.6 ? '#3f76e4' : n > 0.3 ? '#295bca' : '#1d48a8';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 14. Lava Still
    this.textures.set('lava_still', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 14);
          ctx.fillStyle = n > 0.7 ? '#ffe033' : n > 0.4 ? '#ff7700' : '#cf2d00';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 15. Oak Planks
    this.textures.set('oak_planks', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        const plankIdx = Math.floor(y / 4);
        const isPlankBorder = y % 4 === 0;
        for (let x = 0; x < 16; x++) {
          if (isPlankBorder) {
            ctx.fillStyle = '#6d4c22';
          } else {
            const n = noise(x, y + plankIdx * 10, 15);
            ctx.fillStyle = n > 0.6 ? '#be945d' : n > 0.3 ? '#b0844e' : '#9a703d';
          }
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // 16. Crafting Table Top
    this.textures.set('crafting_table_top', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#9a703d';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#6d4c22';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // 3x3 grid pattern in the middle
      ctx.fillStyle = '#be945d';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillStyle = '#573d1a';
      ctx.strokeRect(2.5, 2.5, 11, 11);
      ctx.beginPath();
      ctx.moveTo(6.5, 3); ctx.lineTo(6.5, 13);
      ctx.moveTo(9.5, 3); ctx.lineTo(9.5, 13);
      ctx.moveTo(3, 6.5); ctx.lineTo(13, 6.5);
      ctx.moveTo(3, 9.5); ctx.lineTo(13, 9.5);
      ctx.stroke();
    }));

    // Crafting Table Side & Front
    this.textures.set('crafting_table_side', this.createPixelCanvas((ctx) => {
      // Planks background
      const planks = this.textures.get('oak_planks') as HTMLCanvasElement;
      if (planks) ctx.drawImage(planks, 0, 0);
      // Draw saw / shears / tool carvings
      ctx.fillStyle = '#4a3319';
      ctx.fillRect(2, 4, 3, 8);
      ctx.fillRect(10, 5, 4, 6);
      ctx.fillStyle = '#a8a8a8';
      ctx.fillRect(3, 3, 1, 4);
      ctx.fillRect(11, 4, 2, 3);
    }));
    this.textures.set('crafting_table_front', this.textures.get('crafting_table_side')!);

    // 17. Furnace
    this.textures.set('furnace_front_off', this.createPixelCanvas((ctx) => {
      const cobble = this.textures.get('cobblestone') as HTMLCanvasElement;
      if (cobble) ctx.drawImage(cobble, 0, 0);
      // Black furnace opening
      ctx.fillStyle = '#222222';
      ctx.fillRect(3, 7, 10, 6);
      ctx.fillStyle = '#111111';
      ctx.fillRect(4, 8, 8, 4);
      ctx.fillStyle = '#888888';
      ctx.strokeRect(2.5, 6.5, 11, 7);
    }));

    this.textures.set('furnace_front_on', this.createPixelCanvas((ctx) => {
      const off = this.textures.get('furnace_front_off') as HTMLCanvasElement;
      if (off) ctx.drawImage(off, 0, 0);
      // Fire inside
      ctx.fillStyle = '#ff7700';
      ctx.fillRect(4, 8, 8, 4);
      ctx.fillStyle = '#ffea33';
      ctx.fillRect(5, 9, 6, 2);
    }));

    this.textures.set('furnace_side', this.textures.get('cobblestone')!);
    this.textures.set('furnace_top', this.textures.get('stone')!);

    // 18. Chest
    this.textures.set('chest_top', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#8f683a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#4a3319';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      ctx.fillStyle = '#302211';
      ctx.fillRect(7, 14, 2, 2);
    }));
    this.textures.set('chest_side', this.textures.get('chest_top')!);
    this.textures.set('chest_front', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#8f683a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#4a3319';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Latch
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(7, 6, 2, 4);
      ctx.fillStyle = '#333333';
      ctx.fillRect(7, 8, 2, 1);
    }));

    // 19. Ores (Coal, Iron, Gold, Diamond, Redstone, Lapis, Emerald)
    const makeOre = (gemColor1: string, gemColor2: string, seed: number) => {
      return this.createPixelCanvas((ctx) => {
        const stone = this.textures.get('stone') as HTMLCanvasElement;
        if (stone) ctx.drawImage(stone, 0, 0);
        const oreSpots = [
          { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 },
          { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 11, y: 6 },
          { x: 6, y: 10 }, { x: 7, y: 10 }, { x: 7, y: 11 }, { x: 8, y: 11 },
          { x: 12, y: 12 }, { x: 13, y: 12 },
        ];
        for (const spot of oreSpots) {
          const n = noise(spot.x, spot.y, seed);
          ctx.fillStyle = n > 0.4 ? gemColor1 : gemColor2;
          ctx.fillRect(spot.x, spot.y, 1, 1);
        }
      });
    };

    this.textures.set('coal_ore', makeOre('#1a1a1a', '#303030', 19));
    this.textures.set('iron_ore', makeOre('#e0bc9b', '#b38e6e', 20));
    this.textures.set('gold_ore', makeOre('#f9e54a', '#d6b328', 21));
    this.textures.set('diamond_ore', makeOre('#4dedf4', '#2bc2c9', 22));
    this.textures.set('redstone_ore', makeOre('#e01b1b', '#9e0d0d', 23));
    this.textures.set('lapis_ore', makeOre('#2244bb', '#152c80', 24));
    this.textures.set('emerald_ore', makeOre('#23d944', '#158c2b', 25));

    // Mineral Blocks
    const makeBlock = (c1: string, c2: string, c3: string) => {
      return this.createPixelCanvas((ctx) => {
        ctx.fillStyle = c2;
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = c1;
        ctx.strokeRect(0.5, 0.5, 15, 15);
        ctx.fillStyle = c3;
        ctx.fillRect(2, 2, 12, 12);
      });
    };
    this.textures.set('coal_block', makeBlock('#2b2b2b', '#1a1a1a', '#141414'));
    this.textures.set('iron_block', makeBlock('#ffffff', '#e8e8e8', '#d0d0d0'));
    this.textures.set('gold_block', makeBlock('#fff168', '#f6d332', '#dba81a'));
    this.textures.set('diamond_block', makeBlock('#a5fcff', '#62ecf0', '#32cdd2'));

    // Birch & Spruce Variants
    this.textures.set('birch_log', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 30);
          ctx.fillStyle = n > 0.85 ? '#242424' : n > 0.7 ? '#505050' : '#e6e6e6';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));
    this.textures.set('birch_log_top', this.textures.get('oak_log_top')!);
    this.textures.set('birch_leaves', this.textures.get('oak_leaves')!);
    this.textures.set('birch_planks', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        const isPlankBorder = y % 4 === 0;
        for (let x = 0; x < 16; x++) {
          ctx.fillStyle = isPlankBorder ? '#b59e72' : '#d7c79e';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    this.textures.set('spruce_log', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 32);
          ctx.fillStyle = n > 0.5 ? '#3b2816' : '#2b1d0f';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));
    this.textures.set('spruce_log_top', this.textures.get('oak_log_top')!);
    this.textures.set('spruce_leaves', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 33);
          if (n > 0.3) {
            ctx.fillStyle = n > 0.7 ? '#40633b' : '#2e492a';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }));
    this.textures.set('spruce_planks', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        const isBorder = y % 4 === 0;
        for (let x = 0; x < 16; x++) {
          ctx.fillStyle = isBorder ? '#432e18' : '#694a28';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // Sandstone
    this.textures.set('sandstone_top', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#ebd388';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d6bb6b';
      ctx.strokeRect(0.5, 0.5, 15, 15);
    }));
    this.textures.set('sandstone_normal', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#ebd388';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d6bb6b';
      ctx.fillRect(0, 12, 16, 4);
    }));
    this.textures.set('sandstone_bottom', this.textures.get('sandstone_top')!);

    // Granite, Diorite, Andesite
    this.textures.set('granite', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 37);
          ctx.fillStyle = n > 0.6 ? '#ad7764' : n > 0.3 ? '#95604f' : '#7d4a3b';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));
    this.textures.set('diorite', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 38);
          ctx.fillStyle = n > 0.6 ? '#e8e8e8' : n > 0.3 ? '#b8b8b8' : '#7d7d7d';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));
    this.textures.set('andesite', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 39);
          ctx.fillStyle = n > 0.6 ? '#8e8e8e' : n > 0.3 ? '#777777' : '#5e5e5e';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // Bookshelf
    this.textures.set('bookshelf', this.createPixelCanvas((ctx) => {
      const oak = this.textures.get('oak_planks') as HTMLCanvasElement;
      if (oak) ctx.drawImage(oak, 0, 0);
      // Draw books on shelves
      const bookColors = ['#9e2b25', '#2452a8', '#388e3c', '#d4af37', '#6a1b9a'];
      for (let row = 0; row < 2; row++) {
        const py = row === 0 ? 2 : 9;
        ctx.fillStyle = '#2b1d0f';
        ctx.fillRect(1, py, 14, 5);
        for (let b = 0; b < 6; b++) {
          ctx.fillStyle = bookColors[(row * 6 + b) % bookColors.length];
          ctx.fillRect(2 + b * 2, py + 1, 2, 4);
        }
      }
    }));

    // TNT
    this.textures.set('tnt_top', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#db3223';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#777777';
      ctx.fillRect(7, 7, 2, 2);
    }));
    this.textures.set('tnt_bottom', this.textures.get('tnt_top')!);
    this.textures.set('tnt_side', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#db3223';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 5, 16, 6);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 5px monospace';
      ctx.fillText('TNT', 2, 10);
    }));

    // Obsidian
    this.textures.set('obsidian', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 42);
          ctx.fillStyle = n > 0.7 ? '#302244' : n > 0.3 ? '#191124' : '#0c0712';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // Glowstone
    this.textures.set('glowstone', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 43);
          ctx.fillStyle = n > 0.7 ? '#fff59d' : n > 0.4 ? '#fbc02d' : '#e65100';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // Farmland
    this.textures.set('farmland', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#6d4c28';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#52371b';
      for (let i = 0; i < 16; i += 2) ctx.fillRect(0, i, 16, 1);
    }));
    this.textures.set('farmland_moist', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#402a14';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#2b1b0b';
      for (let i = 0; i < 16; i += 2) ctx.fillRect(0, i, 16, 1);
    }));

    // Dirt Path
    this.textures.set('dirt_path_top', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#9b7640';
      ctx.fillRect(0, 0, 16, 16);
    }));
    this.textures.set('dirt_path_side', this.textures.get('dirt')!);

    // Ladder
    this.textures.set('ladder', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#8f683a';
      // Side rails
      ctx.fillRect(2, 0, 2, 16);
      ctx.fillRect(12, 0, 2, 16);
      // Rungs
      for (let y = 2; y < 16; y += 4) {
        ctx.fillRect(4, y, 8, 2);
      }
    }));

    // Torch
    this.textures.set('torch', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      // Stick
      ctx.fillStyle = '#6d4c22';
      ctx.fillRect(7, 6, 2, 9);
      // Coal head
      ctx.fillStyle = '#222222';
      ctx.fillRect(7, 4, 2, 2);
      // Flame
      ctx.fillStyle = '#ff9800';
      ctx.fillRect(6, 2, 4, 3);
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(7, 1, 2, 2);
    }));

    // Redstone Torch
    this.textures.set('redstone_torch_on', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#6d4c22';
      ctx.fillRect(7, 6, 2, 9);
      ctx.fillStyle = '#ff1111';
      ctx.fillRect(6, 2, 4, 4);
      ctx.fillStyle = '#ff7777';
      ctx.fillRect(7, 3, 2, 2);
    }));

    // Redstone Dust
    this.textures.set('redstone_dust_dot', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#ff1111';
      ctx.fillRect(6, 6, 4, 4);
      ctx.fillRect(7, 5, 2, 6);
      ctx.fillRect(5, 7, 6, 2);
    }));

    // Lever
    this.textures.set('lever', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#616161';
      ctx.fillRect(5, 12, 6, 3);
      ctx.fillStyle = '#8f683a';
      ctx.fillRect(7, 4, 2, 8);
    }));

    // Redstone Lamp
    this.textures.set('redstone_lamp', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#59381e';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#362111';
      ctx.strokeRect(0.5, 0.5, 15, 15);
    }));
    this.textures.set('redstone_lamp_on', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#ffbb55';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#945826';
      ctx.strokeRect(0.5, 0.5, 15, 15);
    }));

    // Wheat stages (0 to 3 used for rendering)
    for (let s = 0; s < 4; s++) {
      this.textures.set(`wheat_stage${s}`, this.createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        const h = 4 + s * 3;
        const color = s === 3 ? '#d6b328' : '#5db331';
        ctx.fillStyle = color;
        for (let x = 2; x < 14; x += 3) {
          ctx.fillRect(x, 16 - h, 2, h);
        }
      }));
    }

    // Flowers & Tall Grass
    this.textures.set('poppy', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#3d7d22';
      ctx.fillRect(7, 7, 2, 9);
      ctx.fillStyle = '#e52521';
      ctx.fillRect(5, 3, 6, 5);
      ctx.fillStyle = '#111111';
      ctx.fillRect(7, 5, 2, 2);
    }));

    this.textures.set('dandelion', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#3d7d22';
      ctx.fillRect(7, 7, 2, 9);
      ctx.fillStyle = '#fed83d';
      ctx.fillRect(5, 3, 6, 5);
      ctx.fillStyle = '#e69d00';
      ctx.fillRect(7, 4, 2, 2);
    }));

    this.textures.set('tall_grass', this.createPixelCanvas((ctx) => {
      ctx.clearRect(0, 0, 16, 16);
      ctx.fillStyle = '#4c9b2b';
      const blades = [2, 5, 8, 11, 13];
      for (const b of blades) {
        ctx.fillRect(b, 5, 1, 11);
        ctx.fillRect(b + 1, 7, 1, 9);
      }
    }));

    // 16 Wool Colors
    const woolColors: [string, string][] = [
      ['white_wool', '#e9ecec'],
      ['orange_wool', '#f07613'],
      ['magenta_wool', '#bd44b3'],
      ['light_blue_wool', '#3aaad8'],
      ['yellow_wool', '#f8c527'],
      ['lime_wool', '#70b91a'],
      ['pink_wool', '#ed8dac'],
      ['gray_wool', '#3e4447'],
      ['light_gray_wool', '#8e8e86'],
      ['cyan_wool', '#158991'],
      ['purple_wool', '#792aac'],
      ['blue_wool', '#35399d'],
      ['brown_wool', '#724728'],
      ['green_wool', '#546d1b'],
      ['red_wool', '#a12722'],
      ['black_wool', '#141519'],
    ];

    for (const [wName, hex] of woolColors) {
      this.textures.set(wName, this.createPixelCanvas((ctx) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const n = noise(x, y, 60);
            ctx.fillStyle = varyColor(hex, 18, n);
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }));
    }

    // Snow, Snow Block, Ice, Clay, Bricks, Netherrack, Soul Sand
    this.textures.set('snow', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#e3edfa';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect((i * 3) % 16, (i * 5) % 16, 1, 1);
      }
    }));
    this.textures.set('snow_block', this.textures.get('snow')!);

    this.textures.set('ice', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#8db5e8';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#b7d4f7';
      ctx.fillRect(2, 2, 4, 1);
      ctx.fillRect(8, 10, 5, 1);
    }));

    this.textures.set('clay', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 79);
          ctx.fillStyle = n > 0.5 ? '#a0a6b5' : '#949ba8';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    this.textures.set('bricks', this.createPixelCanvas((ctx) => {
      ctx.fillStyle = '#d0d0d0'; // Mortar
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#943828'; // Brick
      for (let r = 0; r < 4; r++) {
        const offset = (r % 2) * 4;
        for (let b = -4; b < 16; b += 8) {
          ctx.fillRect(Math.max(0, b + offset), r * 4 + 1, 7, 3);
        }
      }
    }));

    this.textures.set('netherrack', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 81);
          ctx.fillStyle = n > 0.6 ? '#782323' : n > 0.3 ? '#601818' : '#450f0f';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    this.textures.set('soul_sand', this.createPixelCanvas((ctx) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = noise(x, y, 82);
          ctx.fillStyle = n > 0.6 ? '#544033' : '#3d2d22';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }));

    // Mining Crack Overlay textures (crack0 to crack9)
    for (let c = 0; c < 10; c++) {
      this.textures.set(`destroy_stage_${c}`, this.createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        const lineCount = (c + 1) * 2;
        for (let i = 0; i < lineCount; i++) {
          const x0 = (i * 7 + c * 3) % 16;
          const y0 = (i * 11 + c * 5) % 16;
          const x1 = (x0 + 5) % 16;
          const y1 = (y0 + 7) % 16;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }));
    }
  }

  /**
   * Helper to map block type and face to standard vanilla texture name
   */
  public getBlockTextureName(blockType: BlockType, face: string): string {
    switch (blockType) {
      case BlockType.GRASS:
        if (face === 'top') return 'grass_block_top';
        if (face === 'bottom') return 'dirt';
        return 'grass_block_side';
      case BlockType.DIRT:
        return 'dirt';
      case BlockType.STONE:
        return 'stone';
      case BlockType.COBBLESTONE:
        return 'cobblestone';
      case BlockType.BEDROCK:
        return 'bedrock';
      case BlockType.SAND:
        return 'sand';
      case BlockType.GRAVEL:
        return 'gravel';
      case BlockType.OAK_LOG:
        return (face === 'top' || face === 'bottom') ? 'oak_log_top' : 'oak_log';
      case BlockType.OAK_LEAVES:
        return 'oak_leaves';
      case BlockType.GLASS:
        return 'glass';
      case BlockType.WATER:
        return 'water_still';
      case BlockType.LAVA:
        return 'lava_still';
      case BlockType.OAK_PLANKS:
        return 'oak_planks';
      case BlockType.CRAFTING_TABLE:
        if (face === 'top') return 'crafting_table_top';
        if (face === 'bottom') return 'oak_planks';
        if (face === 'north' || face === 'front') return 'crafting_table_front';
        return 'crafting_table_side';
      case BlockType.FURNACE:
        if (face === 'top' || face === 'bottom') return 'furnace_top';
        if (face === 'north' || face === 'front') return 'furnace_front_off';
        return 'furnace_side';
      case BlockType.FURNACE_LIT:
        if (face === 'top' || face === 'bottom') return 'furnace_top';
        if (face === 'north' || face === 'front') return 'furnace_front_on';
        return 'furnace_side';
      case BlockType.CHEST:
        if (face === 'top' || face === 'bottom') return 'chest_top';
        if (face === 'north' || face === 'front') return 'chest_front';
        return 'chest_side';
      case BlockType.TORCH:
        return 'torch';
      case BlockType.COAL_ORE:
        return 'coal_ore';
      case BlockType.IRON_ORE:
        return 'iron_ore';
      case BlockType.GOLD_ORE:
        return 'gold_ore';
      case BlockType.DIAMOND_ORE:
        return 'diamond_ore';
      case BlockType.REDSTONE_ORE:
        return 'redstone_ore';
      case BlockType.LAPIS_ORE:
        return 'lapis_ore';
      case BlockType.EMERALD_ORE:
        return 'emerald_ore';
      case BlockType.COAL_BLOCK:
        return 'coal_block';
      case BlockType.IRON_BLOCK:
        return 'iron_block';
      case BlockType.GOLD_BLOCK:
        return 'gold_block';
      case BlockType.DIAMOND_BLOCK:
        return 'diamond_block';
      case BlockType.BIRCH_LOG:
        return (face === 'top' || face === 'bottom') ? 'birch_log_top' : 'birch_log';
      case BlockType.BIRCH_LEAVES:
        return 'birch_leaves';
      case BlockType.SPRUCE_LOG:
        return (face === 'top' || face === 'bottom') ? 'spruce_log_top' : 'spruce_log';
      case BlockType.SPRUCE_LEAVES:
        return 'spruce_leaves';
      case BlockType.BIRCH_PLANKS:
        return 'birch_planks';
      case BlockType.SPRUCE_PLANKS:
        return 'spruce_planks';
      case BlockType.SANDSTONE:
        if (face === 'top') return 'sandstone_top';
        if (face === 'bottom') return 'sandstone_bottom';
        return 'sandstone_normal';
      case BlockType.GRANITE:
        return 'granite';
      case BlockType.DIORITE:
        return 'diorite';
      case BlockType.ANDESITE:
        return 'andesite';
      case BlockType.BOOKSHELF:
        return (face === 'top' || face === 'bottom') ? 'oak_planks' : 'bookshelf';
      case BlockType.TNT:
        if (face === 'top') return 'tnt_top';
        if (face === 'bottom') return 'tnt_bottom';
        return 'tnt_side';
      case BlockType.OBSIDIAN:
        return 'obsidian';
      case BlockType.GLOWSTONE:
        return 'glowstone';
      case BlockType.FARMLAND:
        return (face === 'top') ? 'farmland' : 'dirt';
      case BlockType.FARMLAND_WET:
        return (face === 'top') ? 'farmland_moist' : 'dirt';
      case BlockType.DIRT_PATH:
        return (face === 'top') ? 'dirt_path_top' : 'dirt_path_side';
      case BlockType.LADDER:
        return 'ladder';
      case BlockType.WHEAT_0:
        return 'wheat_stage0';
      case BlockType.WHEAT_1:
        return 'wheat_stage1';
      case BlockType.WHEAT_2:
        return 'wheat_stage2';
      case BlockType.WHEAT_3:
        return 'wheat_stage3';
      case BlockType.POPPY:
        return 'poppy';
      case BlockType.DANDELION:
        return 'dandelion';
      case BlockType.TALL_GRASS:
        return 'tall_grass';
      case BlockType.REDSTONE_WIRE:
        return 'redstone_dust_dot';
      case BlockType.REDSTONE_TORCH:
        return 'redstone_torch_on';
      case BlockType.LEVER:
        return 'lever';
      case BlockType.REDSTONE_LAMP:
        return 'redstone_lamp';
      case BlockType.REDSTONE_LAMP_LIT:
        return 'redstone_lamp_on';
      case BlockType.SNOW:
      case BlockType.SNOW_BLOCK:
        return 'snow';
      case BlockType.ICE:
        return 'ice';
      case BlockType.CLAY:
        return 'clay';
      case BlockType.BRICKS:
        return 'bricks';
      case BlockType.NETHERRACK:
        return 'netherrack';
      case BlockType.SOUL_SAND:
        return 'soul_sand';
      default:
        // Wool colors
        if (blockType >= BlockType.WOOL_WHITE && blockType <= BlockType.WOOL_BLACK) {
          const woolNames = [
            'white_wool', 'orange_wool', 'magenta_wool', 'light_blue_wool',
            'yellow_wool', 'lime_wool', 'pink_wool', 'gray_wool',
            'light_gray_wool', 'cyan_wool', 'purple_wool', 'blue_wool',
            'brown_wool', 'green_wool', 'red_wool', 'black_wool'
          ];
          const idx = blockType - BlockType.WOOL_WHITE;
          return woolNames[idx] || 'white_wool';
        }
        return 'dirt';
    }
  }
}
