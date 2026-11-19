/**
 * @file items.ts
 * Master item definitions, tool stats, mining speeds, durability, and food restoration.
 */

import { BlockType, ItemDef, ToolTier, ToolType } from '../types/voxel';

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  // Blocks as Items
  grass_block: { id: 'grass_block', name: 'Grass Block', isBlock: true, blockId: BlockType.GRASS, maxStack: 64, texture: 'grass_block_side' },
  dirt: { id: 'dirt', name: 'Dirt', isBlock: true, blockId: BlockType.DIRT, maxStack: 64, texture: 'dirt' },
  stone: { id: 'stone', name: 'Stone', isBlock: true, blockId: BlockType.STONE, maxStack: 64, texture: 'stone' },
  cobblestone: { id: 'cobblestone', name: 'Cobblestone', isBlock: true, blockId: BlockType.COBBLESTONE, maxStack: 64, texture: 'cobblestone' },
  bedrock: { id: 'bedrock', name: 'Bedrock', isBlock: true, blockId: BlockType.BEDROCK, maxStack: 64, texture: 'bedrock' },
  sand: { id: 'sand', name: 'Sand', isBlock: true, blockId: BlockType.SAND, maxStack: 64, texture: 'sand' },
  gravel: { id: 'gravel', name: 'Gravel', isBlock: true, blockId: BlockType.GRAVEL, maxStack: 64, texture: 'gravel' },
  oak_log: { id: 'oak_log', name: 'Oak Log', isBlock: true, blockId: BlockType.OAK_LOG, maxStack: 64, texture: 'oak_log' },
  birch_log: { id: 'birch_log', name: 'Birch Log', isBlock: true, blockId: BlockType.BIRCH_LOG, maxStack: 64, texture: 'birch_log' },
  spruce_log: { id: 'spruce_log', name: 'Spruce Log', isBlock: true, blockId: BlockType.SPRUCE_LOG, maxStack: 64, texture: 'spruce_log' },
  oak_leaves: { id: 'oak_leaves', name: 'Oak Leaves', isBlock: true, blockId: BlockType.OAK_LEAVES, maxStack: 64, texture: 'oak_leaves' },
  glass: { id: 'glass', name: 'Glass', isBlock: true, blockId: BlockType.GLASS, maxStack: 64, texture: 'glass' },
  oak_planks: { id: 'oak_planks', name: 'Oak Planks', isBlock: true, blockId: BlockType.OAK_PLANKS, maxStack: 64, texture: 'oak_planks' },
  birch_planks: { id: 'birch_planks', name: 'Birch Planks', isBlock: true, blockId: BlockType.BIRCH_PLANKS, maxStack: 64, texture: 'birch_planks' },
  spruce_planks: { id: 'spruce_planks', name: 'Spruce Planks', isBlock: true, blockId: BlockType.SPRUCE_PLANKS, maxStack: 64, texture: 'spruce_planks' },
  crafting_table: { id: 'crafting_table', name: 'Crafting Table', isBlock: true, blockId: BlockType.CRAFTING_TABLE, maxStack: 64, texture: 'crafting_table_front' },
  furnace: { id: 'furnace', name: 'Furnace', isBlock: true, blockId: BlockType.FURNACE, maxStack: 64, texture: 'furnace_front_off' },
  chest: { id: 'chest', name: 'Chest', isBlock: true, blockId: BlockType.CHEST, maxStack: 64, texture: 'chest_front' },
  torch: { id: 'torch', name: 'Torch', isBlock: true, blockId: BlockType.TORCH, maxStack: 64, texture: 'torch' },
  tnt: { id: 'tnt', name: 'TNT', isBlock: true, blockId: BlockType.TNT, maxStack: 64, texture: 'tnt_side' },
  obsidian: { id: 'obsidian', name: 'Obsidian', isBlock: true, blockId: BlockType.OBSIDIAN, maxStack: 64, texture: 'obsidian' },
  glowstone: { id: 'glowstone', name: 'Glowstone', isBlock: true, blockId: BlockType.GLOWSTONE, maxStack: 64, texture: 'glowstone' },
  bookshelf: { id: 'bookshelf', name: 'Bookshelf', isBlock: true, blockId: BlockType.BOOKSHELF, maxStack: 64, texture: 'bookshelf' },
  sandstone: { id: 'sandstone', name: 'Sandstone', isBlock: true, blockId: BlockType.SANDSTONE, maxStack: 64, texture: 'sandstone_normal' },
  granite: { id: 'granite', name: 'Granite', isBlock: true, blockId: BlockType.GRANITE, maxStack: 64, texture: 'granite' },
  diorite: { id: 'diorite', name: 'Diorite', isBlock: true, blockId: BlockType.DIORITE, maxStack: 64, texture: 'diorite' },
  andesite: { id: 'andesite', name: 'Andesite', isBlock: true, blockId: BlockType.ANDESITE, maxStack: 64, texture: 'andesite' },
  ladder: { id: 'ladder', name: 'Ladder', isBlock: true, blockId: BlockType.LADDER, maxStack: 64, texture: 'ladder' },
  dirt_path: { id: 'dirt_path', name: 'Dirt Path', isBlock: true, blockId: BlockType.DIRT_PATH, maxStack: 64, texture: 'dirt_path_top' },

  // Mineral Blocks
  coal_block: { id: 'coal_block', name: 'Block of Coal', isBlock: true, blockId: BlockType.COAL_BLOCK, maxStack: 64, texture: 'coal_block' },
  iron_block: { id: 'iron_block', name: 'Block of Iron', isBlock: true, blockId: BlockType.IRON_BLOCK, maxStack: 64, texture: 'iron_block' },
  gold_block: { id: 'gold_block', name: 'Block of Gold', isBlock: true, blockId: BlockType.GOLD_BLOCK, maxStack: 64, texture: 'gold_block' },
  diamond_block: { id: 'diamond_block', name: 'Block of Diamond', isBlock: true, blockId: BlockType.DIAMOND_BLOCK, maxStack: 64, texture: 'diamond_block' },

  // Ores
  coal_ore: { id: 'coal_ore', name: 'Coal Ore', isBlock: true, blockId: BlockType.COAL_ORE, maxStack: 64, texture: 'coal_ore' },
  iron_ore: { id: 'iron_ore', name: 'Iron Ore', isBlock: true, blockId: BlockType.IRON_ORE, maxStack: 64, texture: 'iron_ore' },
  gold_ore: { id: 'gold_ore', name: 'Gold Ore', isBlock: true, blockId: BlockType.GOLD_ORE, maxStack: 64, texture: 'gold_ore' },
  diamond_ore: { id: 'diamond_ore', name: 'Diamond Ore', isBlock: true, blockId: BlockType.DIAMOND_ORE, maxStack: 64, texture: 'diamond_ore' },
  redstone_ore: { id: 'redstone_ore', name: 'Redstone Ore', isBlock: true, blockId: BlockType.REDSTONE_ORE, maxStack: 64, texture: 'redstone_ore' },
  lapis_ore: { id: 'lapis_ore', name: 'Lapis Lazuli Ore', isBlock: true, blockId: BlockType.LAPIS_ORE, maxStack: 64, texture: 'lapis_ore' },
  emerald_ore: { id: 'emerald_ore', name: 'Emerald Ore', isBlock: true, blockId: BlockType.EMERALD_ORE, maxStack: 64, texture: 'emerald_ore' },

  // Redstone items
  redstone_dust: { id: 'redstone_dust', name: 'Redstone Dust', isBlock: true, blockId: BlockType.REDSTONE_WIRE, maxStack: 64, texture: 'redstone_dust_dot' },
  redstone_torch: { id: 'redstone_torch', name: 'Redstone Torch', isBlock: true, blockId: BlockType.REDSTONE_TORCH, maxStack: 64, texture: 'redstone_torch_on' },
  lever: { id: 'lever', name: 'Lever', isBlock: true, blockId: BlockType.LEVER, maxStack: 64, texture: 'lever' },
  redstone_lamp: { id: 'redstone_lamp', name: 'Redstone Lamp', isBlock: true, blockId: BlockType.REDSTONE_LAMP, maxStack: 64, texture: 'redstone_lamp' },

  // Flowers & Crops
  poppy: { id: 'poppy', name: 'Poppy', isBlock: true, blockId: BlockType.POPPY, maxStack: 64, texture: 'poppy' },
  dandelion: { id: 'dandelion', name: 'Dandelion', isBlock: true, blockId: BlockType.DANDELION, maxStack: 64, texture: 'dandelion' },
  tall_grass: { id: 'tall_grass', name: 'Grass', isBlock: true, blockId: BlockType.TALL_GRASS, maxStack: 64, texture: 'tall_grass' },
  wheat_seeds: { id: 'wheat_seeds', name: 'Wheat Seeds', isBlock: true, blockId: BlockType.WHEAT_0, maxStack: 64, texture: 'wheat_stage1' },
  wheat: { id: 'wheat', name: 'Wheat', isBlock: false, maxStack: 64, texture: 'wheat_stage3' },
  bread: { id: 'bread', name: 'Bread', isBlock: false, maxStack: 64, foodRestore: 5, saturation: 6, texture: 'oak_planks' },

  // Wool (16 colors)
  white_wool: { id: 'white_wool', name: 'White Wool', isBlock: true, blockId: BlockType.WOOL_WHITE, maxStack: 64, texture: 'white_wool' },
  red_wool: { id: 'red_wool', name: 'Red Wool', isBlock: true, blockId: BlockType.WOOL_RED, maxStack: 64, texture: 'red_wool' },
  blue_wool: { id: 'blue_wool', name: 'Blue Wool', isBlock: true, blockId: BlockType.WOOL_BLUE, maxStack: 64, texture: 'blue_wool' },
  yellow_wool: { id: 'yellow_wool', name: 'Yellow Wool', isBlock: true, blockId: BlockType.WOOL_YELLOW, maxStack: 64, texture: 'yellow_wool' },
  green_wool: { id: 'green_wool', name: 'Green Wool', isBlock: true, blockId: BlockType.WOOL_GREEN, maxStack: 64, texture: 'green_wool' },
  black_wool: { id: 'black_wool', name: 'Black Wool', isBlock: true, blockId: BlockType.WOOL_BLACK, maxStack: 64, texture: 'black_wool' },

  // Crafting Materials
  stick: { id: 'stick', name: 'Stick', isBlock: false, maxStack: 64, texture: 'oak_log' },
  coal: { id: 'coal', name: 'Coal', isBlock: false, maxStack: 64, texture: 'coal_ore' },
  iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', isBlock: false, maxStack: 64, texture: 'iron_block' },
  gold_ingot: { id: 'gold_ingot', name: 'Gold Ingot', isBlock: false, maxStack: 64, texture: 'gold_block' },
  diamond: { id: 'diamond', name: 'Diamond', isBlock: false, maxStack: 64, texture: 'diamond_ore' },
  emerald: { id: 'emerald', name: 'Emerald', isBlock: false, maxStack: 64, texture: 'emerald_ore' },
  raw_beef: { id: 'raw_beef', name: 'Raw Beef', isBlock: false, maxStack: 64, foodRestore: 3, texture: 'redstone_dust_dot' },
  cooked_beef: { id: 'cooked_beef', name: 'Steak', isBlock: false, maxStack: 64, foodRestore: 8, saturation: 12.8, texture: 'dirt' },
  raw_porkchop: { id: 'raw_porkchop', name: 'Raw Porkchop', isBlock: false, maxStack: 64, foodRestore: 3, texture: 'redstone_dust_dot' },
  cooked_porkchop: { id: 'cooked_porkchop', name: 'Cooked Porkchop', isBlock: false, maxStack: 64, foodRestore: 8, saturation: 12.8, texture: 'dirt' },
  feather: { id: 'feather', name: 'Feather', isBlock: false, maxStack: 64, texture: 'white_wool' },
  leather: { id: 'leather', name: 'Leather', isBlock: false, maxStack: 64, texture: 'dirt' },
  bone: { id: 'bone', name: 'Bone', isBlock: false, maxStack: 64, texture: 'diorite' },
  gunpowder: { id: 'gunpowder', name: 'Gunpowder', isBlock: false, maxStack: 64, texture: 'gravel' },

  // Tools: Wooden Tier (Durability: 59)
  wooden_pickaxe: { id: 'wooden_pickaxe', name: 'Wooden Pickaxe', isBlock: false, maxStack: 1, toolType: ToolType.PICKAXE, toolTier: ToolTier.WOOD, durability: 59, attackDamage: 2, texture: 'oak_planks' },
  wooden_axe: { id: 'wooden_axe', name: 'Wooden Axe', isBlock: false, maxStack: 1, toolType: ToolType.AXE, toolTier: ToolTier.WOOD, durability: 59, attackDamage: 3, texture: 'oak_planks' },
  wooden_shovel: { id: 'wooden_shovel', name: 'Wooden Shovel', isBlock: false, maxStack: 1, toolType: ToolType.SHOVEL, toolTier: ToolTier.WOOD, durability: 59, attackDamage: 1, texture: 'oak_planks' },
  wooden_sword: { id: 'wooden_sword', name: 'Wooden Sword', isBlock: false, maxStack: 1, toolType: ToolType.SWORD, toolTier: ToolTier.WOOD, durability: 59, attackDamage: 4, texture: 'oak_planks' },
  wooden_hoe: { id: 'wooden_hoe', name: 'Wooden Hoe', isBlock: false, maxStack: 1, toolType: ToolType.HOE, toolTier: ToolTier.WOOD, durability: 59, attackDamage: 1, texture: 'oak_planks' },

  // Tools: Stone Tier (Durability: 131)
  stone_pickaxe: { id: 'stone_pickaxe', name: 'Stone Pickaxe', isBlock: false, maxStack: 1, toolType: ToolType.PICKAXE, toolTier: ToolTier.STONE, durability: 131, attackDamage: 3, texture: 'cobblestone' },
  stone_axe: { id: 'stone_axe', name: 'Stone Axe', isBlock: false, maxStack: 1, toolType: ToolType.AXE, toolTier: ToolTier.STONE, durability: 131, attackDamage: 4, texture: 'cobblestone' },
  stone_shovel: { id: 'stone_shovel', name: 'Stone Shovel', isBlock: false, maxStack: 1, toolType: ToolType.SHOVEL, toolTier: ToolTier.STONE, durability: 131, attackDamage: 2, texture: 'cobblestone' },
  stone_sword: { id: 'stone_sword', name: 'Stone Sword', isBlock: false, maxStack: 1, toolType: ToolType.SWORD, toolTier: ToolTier.STONE, durability: 131, attackDamage: 5, texture: 'cobblestone' },
  stone_hoe: { id: 'stone_hoe', name: 'Stone Hoe', isBlock: false, maxStack: 1, toolType: ToolType.HOE, toolTier: ToolTier.STONE, durability: 131, attackDamage: 1, texture: 'cobblestone' },

  // Tools: Iron Tier (Durability: 250)
  iron_pickaxe: { id: 'iron_pickaxe', name: 'Iron Pickaxe', isBlock: false, maxStack: 1, toolType: ToolType.PICKAXE, toolTier: ToolTier.IRON, durability: 250, attackDamage: 4, texture: 'iron_block' },
  iron_axe: { id: 'iron_axe', name: 'Iron Axe', isBlock: false, maxStack: 1, toolType: ToolType.AXE, toolTier: ToolTier.IRON, durability: 250, attackDamage: 6, texture: 'iron_block' },
  iron_shovel: { id: 'iron_shovel', name: 'Iron Shovel', isBlock: false, maxStack: 1, toolType: ToolType.SHOVEL, toolTier: ToolTier.IRON, durability: 250, attackDamage: 3, texture: 'iron_block' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', isBlock: false, maxStack: 1, toolType: ToolType.SWORD, toolTier: ToolTier.IRON, durability: 250, attackDamage: 6, texture: 'iron_block' },
  iron_hoe: { id: 'iron_hoe', name: 'Iron Hoe', isBlock: false, maxStack: 1, toolType: ToolType.HOE, toolTier: ToolTier.IRON, durability: 250, attackDamage: 1, texture: 'iron_block' },
  shears: { id: 'shears', name: 'Shears', isBlock: false, maxStack: 1, toolType: ToolType.SHEARS, durability: 238, texture: 'iron_block' },

  // Tools: Diamond Tier (Durability: 1561)
  diamond_pickaxe: { id: 'diamond_pickaxe', name: 'Diamond Pickaxe', isBlock: false, maxStack: 1, toolType: ToolType.PICKAXE, toolTier: ToolTier.DIAMOND, durability: 1561, attackDamage: 5, texture: 'diamond_block' },
  diamond_axe: { id: 'diamond_axe', name: 'Diamond Axe', isBlock: false, maxStack: 1, toolType: ToolType.AXE, toolTier: ToolTier.DIAMOND, durability: 1561, attackDamage: 7, texture: 'diamond_block' },
  diamond_shovel: { id: 'diamond_shovel', name: 'Diamond Shovel', isBlock: false, maxStack: 1, toolType: ToolType.SHOVEL, toolTier: ToolTier.DIAMOND, durability: 1561, attackDamage: 4, texture: 'diamond_block' },
  diamond_sword: { id: 'diamond_sword', name: 'Diamond Sword', isBlock: false, maxStack: 1, toolType: ToolType.SWORD, toolTier: ToolTier.DIAMOND, durability: 1561, attackDamage: 7, texture: 'diamond_block' },
  diamond_hoe: { id: 'diamond_hoe', name: 'Diamond Hoe', isBlock: false, maxStack: 1, toolType: ToolType.HOE, toolTier: ToolTier.DIAMOND, durability: 1561, attackDamage: 1, texture: 'diamond_block' },
};

/**
 * Get dropped item ID and count when breaking a block
 */
export function getBlockDrops(block: BlockType, tool?: ItemDef): { id: string; count: number } {
  switch (block) {
    case BlockType.GRASS:
      return { id: 'dirt', count: 1 };
    case BlockType.STONE:
      // Stone drops cobblestone unless silk touch
      return { id: 'cobblestone', count: 1 };
    case BlockType.COAL_ORE:
      return { id: 'coal', count: 1 };
    case BlockType.DIAMOND_ORE:
      return { id: 'diamond', count: 1 };
    case BlockType.REDSTONE_ORE:
      return { id: 'redstone_dust', count: 4 };
    case BlockType.OAK_LEAVES:
    case BlockType.BIRCH_LEAVES:
    case BlockType.SPRUCE_LEAVES:
      return Math.random() > 0.8 ? { id: 'oak_leaves', count: 1 } : { id: 'stick', count: 1 };
    case BlockType.GLASS:
      return { id: 'glass', count: 0 }; // Breaks completely
    case BlockType.WHEAT_3:
      return { id: 'wheat', count: 1 };
    case BlockType.TALL_GRASS:
      return Math.random() > 0.6 ? { id: 'wheat_seeds', count: 1 } : { id: 'wheat_seeds', count: 0 };
    case BlockType.GLOWSTONE:
      return { id: 'glowstone', count: 1 };
    default:
      // By default find matching block item
      for (const item of Object.values(ITEM_REGISTRY)) {
        if (item.blockId === block) {
          return { id: item.id, count: 1 };
        }
      }
      return { id: 'dirt', count: 1 };
  }
}

/**
 * Calculate breaking time in seconds for a block with currently held item
 */
export function getMiningTime(block: BlockType, heldItem?: ItemDef): number {
  let baseHardness = 1.5;

  switch (block) {
    case BlockType.BEDROCK:
      return 999999; // Unbreakable
    case BlockType.DIRT:
    case BlockType.GRASS:
    case BlockType.SAND:
    case BlockType.GRAVEL:
      baseHardness = 0.5;
      break;
    case BlockType.OAK_LEAVES:
    case BlockType.BIRCH_LEAVES:
    case BlockType.SPRUCE_LEAVES:
    case BlockType.TALL_GRASS:
    case BlockType.POPPY:
    case BlockType.DANDELION:
    case BlockType.TORCH:
      return 0.1; // Instant break
    case BlockType.OAK_LOG:
    case BlockType.BIRCH_LOG:
    case BlockType.SPRUCE_LOG:
    case BlockType.OAK_PLANKS:
    case BlockType.CRAFTING_TABLE:
    case BlockType.CHEST:
      baseHardness = 2.0;
      break;
    case BlockType.STONE:
    case BlockType.COBBLESTONE:
    case BlockType.COAL_ORE:
    case BlockType.IRON_ORE:
      baseHardness = 2.5;
      break;
    case BlockType.GOLD_ORE:
    case BlockType.REDSTONE_ORE:
    case BlockType.DIAMOND_ORE:
      baseHardness = 3.5;
      break;
    case BlockType.OBSIDIAN:
      baseHardness = 9.0;
      break;
    default:
      baseHardness = 1.0;
  }

  // Tool speed multiplier
  let speedMultiplier = 1.0;
  if (heldItem) {
    const isPickaxeBlock = (
      block === BlockType.STONE || block === BlockType.COBBLESTONE ||
      block === BlockType.COAL_ORE || block === BlockType.IRON_ORE ||
      block === BlockType.GOLD_ORE || block === BlockType.DIAMOND_ORE ||
      block === BlockType.OBSIDIAN || block === BlockType.FURNACE
    );
    const isAxeBlock = (
      block === BlockType.OAK_LOG || block === BlockType.BIRCH_LOG ||
      block === BlockType.SPRUCE_LOG || block === BlockType.OAK_PLANKS ||
      block === BlockType.CRAFTING_TABLE || block === BlockType.CHEST
    );
    const isShovelBlock = (
      block === BlockType.DIRT || block === BlockType.GRASS ||
      block === BlockType.SAND || block === BlockType.GRAVEL
    );

    if (heldItem.toolType === ToolType.PICKAXE && isPickaxeBlock) {
      speedMultiplier = heldItem.toolTier ? heldItem.toolTier * 2.5 : 2.0;
    } else if (heldItem.toolType === ToolType.AXE && isAxeBlock) {
      speedMultiplier = heldItem.toolTier ? heldItem.toolTier * 2.5 : 2.0;
    } else if (heldItem.toolType === ToolType.SHOVEL && isShovelBlock) {
      speedMultiplier = heldItem.toolTier ? heldItem.toolTier * 2.5 : 2.0;
    }
  }

  return Math.max(0.12, baseHardness / speedMultiplier);
}
