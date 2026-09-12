import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PermissionMode, ProviderCapabilities } from "@aunoforge/core";
import { BuiltinRecipeRegistry, validateRecipeForExecution, type RecipeValidationResult } from "@aunoforge/recipes";

const validationCapabilities: ProviderCapabilities = {
  structuredOutput: true,
  toolCalling: true,
  largeContext: true,
  streaming: true,
  patchGeneration: true
};

export type RecipeCommandOptions = { mode: PermissionMode };
export type RecipeTestResult = RecipeValidationResult & {
  shellExecutions: number;
  networkRequests: number;
  fixturesPassed: number;
};

export async function listRecipes(root: string): Promise<string[]> {
  return (await BuiltinRecipeRegistry.fromRoot(root)).list();
}

export async function validateRecipePath(path: string, options: RecipeCommandOptions): Promise<RecipeValidationResult> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
    return validateRecipeForExecution(raw, {
      mode: options.mode,
      knownChecks: [],
      providerCapabilities: validationCapabilities
    });
  } catch (error) {
    return { valid: false, errors: [(error as Error).message] };
  }
}

export async function testRecipePath(path: string, options: RecipeCommandOptions): Promise<RecipeTestResult> {
  const validation = await validateRecipePath(path, options);
  return {
    ...validation,
    shellExecutions: 0,
    networkRequests: 0,
    fixturesPassed: 0
  };
}

export function resolveRecipePath(root: string, value: string): string {
  return resolve(root, value);
}
