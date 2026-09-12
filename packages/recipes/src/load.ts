import { readFile } from "node:fs/promises";
import { validateRecipe, type RecipeV1 } from "./schema.js";

export async function loadRecipe(path: string): Promise<RecipeV1> {
  const source = await readFile(path, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`Recipe must use JSON-compatible YAML in v0.1.0: ${(error as Error).message}`);
  }
  return validateRecipe(value);
}
