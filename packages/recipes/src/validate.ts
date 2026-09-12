import type { ProviderCapabilities } from "@aunoforge/core";
import { validateRecipe, type RecipeV1, type RecipeValidationContext } from "./schema.js";

const knownTools = new Set([
  "filesystem.read","filesystem.write","git.diff","git.history","git.commit",
  "github.issue.read","github.issue.write","github.pr.read","github.pr.comment","shell.execute","network.fetch"
]);

export type RecipeValidationResult = { valid: boolean; errors: string[]; recipe?: RecipeV1 };

export function validateRecipeForExecution(input: unknown, context: RecipeValidationContext): RecipeValidationResult {
  let recipe: RecipeV1;
  try { recipe = validateRecipe(input); } catch (error) { return { valid: false, errors: [(error as Error).message] }; }
  const errors: string[] = [];
  for (const tool of recipe.tools) if (!knownTools.has(tool)) errors.push(`Unknown tool: ${tool}`);
  for (const check of recipe.checks) if (context.knownChecks.length && !context.knownChecks.includes(check)) errors.push(`Unknown check: ${check}`);
  if (context.mode === "safe" && recipe.tools.includes("shell.execute")) errors.push("Shell execution is denied in safe mode");
  if (context.mode === "safe" && recipe.tools.includes("network.fetch")) errors.push("Recipe network access is denied in safe mode");
  if (recipe.permissions.shell !== "deny" && context.mode === "safe") errors.push("Shell permission must be deny in safe mode");
  if (recipe.permissions.network !== "deny" && context.mode === "safe") errors.push("Network permission must be deny in safe mode");

  const required = recipe.requires?.provider;
  const actual = context.providerCapabilities;
  if (required && actual) {
    for (const [key, value] of Object.entries(required) as Array<[keyof ProviderCapabilities, boolean]>) {
      if (value === true && actual[key] !== true) errors.push(`Provider lacks required capability: ${key}`);
    }
  } else if (required && !actual) {
    errors.push("Provider capabilities are required for this recipe");
  }
  return errors.length ? { valid: false, errors, recipe } : { valid: true, errors: [], recipe };
}
