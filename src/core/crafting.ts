/**
 * @file crafting.ts
 * 2x2 and 3x3 Minecraft crafting recipes and furnace smelting recipes.
 */

import { CraftingRecipe, ItemStack, SmeltingRecipe } from '../types/voxel';

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // 1. Logs to Planks
  { ingredients: ['oak_log'], result: { id: 'oak_planks', count: 4 } },
  { ingredients: ['birch_log'], result: { id: 'birch_planks', count: 4 } },
  { ingredients: ['spruce_log'], result: { id: 'spruce_planks', count: 4 } },

  // 2. Planks to Sticks
  {
    pattern: ['P', 'P'],
    key: { P: 'oak_planks' },
    result: { id: 'stick', count: 4 },
  },
  {
    pattern: ['P', 'P'],
    key: { P: 'birch_planks' },
    result: { id: 'stick', count: 4 },
  },
  {
    pattern: ['P', 'P'],
    key: { P: 'spruce_planks' },
    result: { id: 'stick', count: 4 },
  },

  // 3. Crafting Table (4 planks)
  {
    pattern: ['PP', 'PP'],
    key: { P: 'oak_planks' },
    result: { id: 'crafting_table', count: 1 },
  },
  {
    pattern: ['PP', 'PP'],
    key: { P: 'birch_planks' },
    result: { id: 'crafting_table', count: 1 },
  },

  // 4. Chest (8 planks)
  {
    pattern: ['PPP', 'P P', 'PPP'],
    key: { P: 'oak_planks' },
    result: { id: 'chest', count: 1 },
  },

  // 5. Furnace (8 cobblestone)
  {
    pattern: ['CCC', 'C C', 'CCC'],
    key: { C: 'cobblestone' },
    result: { id: 'furnace', count: 1 },
  },

  // 6. Torches (Coal + Stick)
  {
    pattern: ['C', 'S'],
    key: { C: 'coal', S: 'stick' },
    result: { id: 'torch', count: 4 },
  },

  // 7. Redstone Torch
  {
    pattern: ['R', 'S'],
    key: { R: 'redstone_dust', S: 'stick' },
    result: { id: 'redstone_torch', count: 1 },
  },

  // 8. Lever
  {
    pattern: ['S', 'C'],
    key: { S: 'stick', C: 'cobblestone' },
    result: { id: 'lever', count: 1 },
  },

  // 9. Ladders
  {
    pattern: ['S S', 'SSS', 'S S'],
    key: { S: 'stick' },
    result: { id: 'ladder', count: 3 },
  },

  // 10. TNT
  {
    pattern: ['GSG', 'SGS', 'GSG'],
    key: { G: 'gunpowder', S: 'sand' },
    result: { id: 'tnt', count: 1 },
  },

  // 11. Bread
  {
    pattern: ['WWW'],
    key: { W: 'wheat' },
    result: { id: 'bread', count: 1 },
  },

  // 12. Shears
  {
    pattern: [' I', 'I '],
    key: { I: 'iron_ingot' },
    result: { id: 'shears', count: 1 },
  },

  // 13. Wooden Tools
  {
    pattern: ['PPP', ' S ', ' S '],
    key: { P: 'oak_planks', S: 'stick' },
    result: { id: 'wooden_pickaxe', count: 1 },
  },
  {
    pattern: ['PP', 'PS', ' S'],
    key: { P: 'oak_planks', S: 'stick' },
    result: { id: 'wooden_axe', count: 1 },
  },
  {
    pattern: ['P', 'S', 'S'],
    key: { P: 'oak_planks', S: 'stick' },
    result: { id: 'wooden_shovel', count: 1 },
  },
  {
    pattern: ['P', 'P', 'S'],
    key: { P: 'oak_planks', S: 'stick' },
    result: { id: 'wooden_sword', count: 1 },
  },
  {
    pattern: ['PP', ' S', ' S'],
    key: { P: 'oak_planks', S: 'stick' },
    result: { id: 'wooden_hoe', count: 1 },
  },

  // 14. Stone Tools
  {
    pattern: ['CCC', ' S ', ' S '],
    key: { C: 'cobblestone', S: 'stick' },
    result: { id: 'stone_pickaxe', count: 1 },
  },
  {
    pattern: ['CC', 'CS', ' S'],
    key: { C: 'cobblestone', S: 'stick' },
    result: { id: 'stone_axe', count: 1 },
  },
  {
    pattern: ['C', 'S', 'S'],
    key: { C: 'cobblestone', S: 'stick' },
    result: { id: 'stone_shovel', count: 1 },
  },
  {
    pattern: ['C', 'C', 'S'],
    key: { C: 'cobblestone', S: 'stick' },
    result: { id: 'stone_sword', count: 1 },
  },
  {
    pattern: ['CC', ' S', ' S'],
    key: { C: 'cobblestone', S: 'stick' },
    result: { id: 'stone_hoe', count: 1 },
  },

  // 15. Iron Tools
  {
    pattern: ['III', ' S ', ' S '],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_pickaxe', count: 1 },
  },
  {
    pattern: ['II', 'IS', ' S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_axe', count: 1 },
  },
  {
    pattern: ['I', 'S', 'S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_shovel', count: 1 },
  },
  {
    pattern: ['I', 'I', 'S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_sword', count: 1 },
  },
  {
    pattern: ['II', ' S', ' S'],
    key: { I: 'iron_ingot', S: 'stick' },
    result: { id: 'iron_hoe', count: 1 },
  },

  // 16. Diamond Tools
  {
    pattern: ['DDD', ' S ', ' S '],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_pickaxe', count: 1 },
  },
  {
    pattern: ['DD', 'DS', ' S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_axe', count: 1 },
  },
  {
    pattern: ['D', 'S', 'S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_shovel', count: 1 },
  },
  {
    pattern: ['D', 'D', 'S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_sword', count: 1 },
  },
  {
    pattern: ['DD', ' S', ' S'],
    key: { D: 'diamond', S: 'stick' },
    result: { id: 'diamond_hoe', count: 1 },
  },

  // 17. Mineral Block Compression & Decompression
  {
    pattern: ['III', 'III', 'III'],
    key: { I: 'iron_ingot' },
    result: { id: 'iron_block', count: 1 },
  },
  { ingredients: ['iron_block'], result: { id: 'iron_ingot', count: 9 } },

  {
    pattern: ['DDD', 'DDD', 'DDD'],
    key: { D: 'diamond' },
    result: { id: 'diamond_block', count: 1 },
  },
  { ingredients: ['diamond_block'], result: { id: 'diamond', count: 9 } },

  {
    pattern: ['CCC', 'CCC', 'CCC'],
    key: { C: 'coal' },
    result: { id: 'coal_block', count: 1 },
  },
  { ingredients: ['coal_block'], result: { id: 'coal', count: 9 } },
];

export const SMELTING_RECIPES: SmeltingRecipe[] = [
  { input: 'iron_ore', result: { id: 'iron_ingot', count: 1 }, cookTime: 10 },
  { input: 'gold_ore', result: { id: 'gold_ingot', count: 1 }, cookTime: 10 },
  { input: 'sand', result: { id: 'glass', count: 1 }, cookTime: 8 },
  { input: 'cobblestone', result: { id: 'stone', count: 1 }, cookTime: 8 },
  { input: 'raw_beef', result: { id: 'cooked_beef', count: 1 }, cookTime: 8 },
  { input: 'raw_porkchop', result: { id: 'cooked_porkchop', count: 1 }, cookTime: 8 },
];

export const FUEL_VALUES: Record<string, number> = {
  coal: 80, // Smelts 8 items
  coal_block: 800,
  oak_log: 15,
  birch_log: 15,
  spruce_log: 15,
  oak_planks: 15,
  birch_planks: 15,
  spruce_planks: 15,
  stick: 5,
};

/**
 * Match a grid of items (size 2x2 or 3x3) against recipes
 */
export function findMatchingRecipe(grid: (ItemStack | null)[], gridSize: 2 | 3): ItemStack | null {
  // Normalize grid into trimmed bounding box
  let minRow: number = gridSize, maxRow: number = -1, minCol: number = gridSize, maxCol: number = -1;
  const nonNullItems: string[] = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const item = grid[r * gridSize + c];
      if (item && item.count > 0) {
        nonNullItems.push(item.id);
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
  }

  if (nonNullItems.length === 0) return null;

  // 1. Check shapeless recipes
  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.ingredients) {
      if (recipe.ingredients.length === nonNullItems.length) {
        const sortedGrid = [...nonNullItems].sort();
        const sortedIngs = [...recipe.ingredients].sort();
        let match = true;
        for (let i = 0; i < sortedGrid.length; i++) {
          if (sortedGrid[i] !== sortedIngs[i]) { match = false; break; }
        }
        if (match) return { ...recipe.result };
      }
    }
  }

  // 2. Check shaped recipes
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;

  for (const recipe of CRAFTING_RECIPES) {
    if (!recipe.pattern || !recipe.key) continue;

    const patH = recipe.pattern.length;
    const patW = Math.max(...recipe.pattern.map((p) => p.length));

    if (patH !== height || patW !== width) continue;

    let match = true;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const gridItem = grid[(minRow + r) * gridSize + (minCol + c)];
        const patChar = recipe.pattern[r][c] || ' ';
        const expectedId = patChar === ' ' ? null : recipe.key[patChar];

        if (expectedId === null) {
          if (gridItem && gridItem.count > 0) { match = false; break; }
        } else {
          if (!gridItem || gridItem.id !== expectedId) { match = false; break; }
        }
      }
      if (!match) break;
    }

    if (match) {
      return { ...recipe.result };
    }
  }

  return null;
}
