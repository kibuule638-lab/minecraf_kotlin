/**
 * @file voxel.ts
 * Core definitions for blocks, items, recipes, biomes, and entities.
 */

export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  COBBLESTONE = 4,
  BEDROCK = 5,
  SAND = 6,
  GRAVEL = 7,
  OAK_LOG = 8,
  OAK_LEAVES = 9,
  GLASS = 10,
  WATER = 11,
  LAVA = 12,
  OAK_PLANKS = 13,
  CRAFTING_TABLE = 14,
  FURNACE = 15,
  FURNACE_LIT = 16,
  CHEST = 17,
  TORCH = 18,
  COAL_ORE = 19,
  IRON_ORE = 20,
  GOLD_ORE = 21,
  DIAMOND_ORE = 22,
  REDSTONE_ORE = 23,
  LAPIS_ORE = 24,
  EMERALD_ORE = 25,
  COAL_BLOCK = 26,
  IRON_BLOCK = 27,
  GOLD_BLOCK = 28,
  DIAMOND_BLOCK = 29,
  BIRCH_LOG = 30,
  BIRCH_LEAVES = 31,
  SPRUCE_LOG = 32,
  SPRUCE_LEAVES = 33,
  BIRCH_PLANKS = 34,
  SPRUCE_PLANKS = 35,
  SANDSTONE = 36,
  GRANITE = 37,
  DIORITE = 38,
  ANDESITE = 39,
  BOOKSHELF = 40,
  TNT = 41,
  OBSIDIAN = 42,
  GLOWSTONE = 43,
  FARMLAND = 44,
  FARMLAND_WET = 45,
  DIRT_PATH = 46,
  LADDER = 47,
  WHEAT_0 = 48,
  WHEAT_1 = 49,
  WHEAT_2 = 50,
  WHEAT_3 = 51,
  POPPY = 52,
  DANDELION = 53,
  TALL_GRASS = 54,
  REDSTONE_WIRE = 55,
  REDSTONE_TORCH = 56,
  LEVER = 57,
  REDSTONE_LAMP = 58,
  REDSTONE_LAMP_LIT = 59,
  WOOL_WHITE = 60,
  WOOL_ORANGE = 61,
  WOOL_MAGENTA = 62,
  WOOL_LIGHT_BLUE = 63,
  WOOL_YELLOW = 64,
  WOOL_LIME = 65,
  WOOL_PINK = 66,
  WOOL_GRAY = 67,
  WOOL_LIGHT_GRAY = 68,
  WOOL_CYAN = 69,
  WOOL_PURPLE = 70,
  WOOL_BLUE = 71,
  WOOL_BROWN = 72,
  WOOL_GREEN = 73,
  WOOL_RED = 74,
  WOOL_BLACK = 75,
  SNOW = 76,
  SNOW_BLOCK = 77,
  ICE = 78,
  CLAY = 79,
  BRICKS = 80,
  NETHERRACK = 81,
  SOUL_SAND = 82,
}

export enum ToolType {
  NONE = 'none',
  PICKAXE = 'pickaxe',
  AXE = 'axe',
  SHOVEL = 'shovel',
  SWORD = 'sword',
  HOE = 'hoe',
  SHEARS = 'shears',
}

export enum ToolTier {
  WOOD = 1,
  STONE = 2,
  IRON = 3,
  GOLD = 4,
  DIAMOND = 5,
}

export interface BlockDef {
  id: BlockType;
  name: string;
  hardness: number; // Break time base in seconds
  resistance: number;
  transparent: boolean; // Does it occlude adjacent faces?
  translucent?: boolean; // Glass / Water alpha sorting
  solid: boolean; // Player physics collision
  lightEmit?: number; // 0 to 15
  toolType?: ToolType;
  minTier?: ToolTier;
  dropId?: string; // Item dropped on break
  dropCount?: number;
  isPlant?: boolean; // Cross mesh geometry
  isAttachable?: boolean; // Torch / ladder
  soundType: 'grass' | 'stone' | 'wood' | 'sand' | 'gravel' | 'glass' | 'wool';
  // Texture mappings: can provide individual face keys or general fallback
  textures: {
    top?: string;
    bottom?: string;
    side?: string;
    north?: string;
    south?: string;
    east?: string;
    west?: string;
    all?: string;
  };
}

export interface ItemDef {
  id: string;
  name: string;
  isBlock: boolean;
  blockId?: BlockType;
  maxStack: number;
  toolType?: ToolType;
  toolTier?: ToolTier;
  attackDamage?: number;
  durability?: number;
  foodRestore?: number; // Hunger restored
  saturation?: number;
  texture: string;
}

export interface ItemStack {
  id: string;
  count: number;
  durability?: number; // Current remaining durability
}

export interface CraftingRecipe {
  pattern?: string[]; // E.g. ["PP", "PP"] or ["S", "S"]
  key?: Record<string, string>; // 'P': 'oak_planks'
  ingredients?: string[]; // Shapeless recipes
  result: ItemStack;
}

export interface SmeltingRecipe {
  input: string;
  result: ItemStack;
  cookTime: number; // Ticks or seconds
}

export enum BiomeType {
  PLAINS = 'Plains',
  FOREST = 'Forest',
  DESERT = 'Desert',
  MOUNTAINS = 'Mountains',
  SNOWY = 'Snowy Plains',
  OCEAN = 'Ocean',
  TAIGA = 'Taiga',
}

export interface BiomeParams {
  type: BiomeType;
  baseHeight: number;
  heightVariation: number;
  surfaceBlock: BlockType;
  subsurfaceBlock: BlockType;
  treeDensity: number;
  treeType: 'oak' | 'birch' | 'spruce' | 'none';
  foliageColor: number;
  skyColor: number;
  fogColor: number;
}

export enum MobType {
  PIG = 'pig',
  COW = 'cow',
  SHEEP = 'sheep',
  CHICKEN = 'chicken',
  ZOMBIE = 'zombie',
  SKELETON = 'skeleton',
  CREEPER = 'creeper',
}

export interface DroppedItemEntity {
  id: string;
  item: ItemStack;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: number;
  lifetime: number;
}
