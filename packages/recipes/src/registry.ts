import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadRecipe } from "./load.js";
import type { RecipeV1 } from "./schema.js";

async function recipeFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await recipeFiles(full));
    else if (/\.ya?ml$/i.test(entry.name)) out.push(full);
  }
  return out;
}

export class BuiltinRecipeRegistry {
  private readonly recipes = new Map<string, RecipeV1>();
  static async fromRoot(root: string): Promise<BuiltinRecipeRegistry> {
    const registry = new BuiltinRecipeRegistry();
    const dir = join(root, "recipes");
    for (const file of await recipeFiles(dir)) {
      const recipe = await loadRecipe(file);
      if (recipe.trust.level !== "builtin") throw new Error(`Builtin recipe ${recipe.id} must declare trust.level=builtin`);
      if (registry.recipes.has(recipe.id)) throw new Error(`Duplicate recipe id: ${recipe.id}`);
      registry.recipes.set(recipe.id, recipe);
    }
    return registry;
  }
  list(): string[] { return [...this.recipes.keys()].sort(); }
  get(id: string): RecipeV1 | undefined { return this.recipes.get(id); }
}
