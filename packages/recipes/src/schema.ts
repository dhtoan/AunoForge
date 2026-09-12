import type { Capability, PermissionMode, ProviderCapabilities } from "@aunoforge/core";

export type RecipeTrust = "builtin" | "community" | "local";
export type RecipePermission = "deny" | "ask" | "allow";

export type RecipeV1 = {
  schema: "aunoforge.dev/recipe/v1";
  id: string;
  name: string;
  version: number;
  trust: { level: RecipeTrust };
  applies_to: string[];
  inputs: string[];
  passes: string[];
  checks: string[];
  tools: Capability[];
  permissions: { shell: RecipePermission; network: RecipePermission };
  requires?: { provider?: Partial<ProviderCapabilities> };
  output: { contract: string };
};

const allowedFields = new Set(["schema","id","name","version","trust","applies_to","inputs","passes","checks","tools","permissions","requires","output"]);
const tools = new Set<Capability>([
  "filesystem.read","filesystem.write","git.diff","git.history","git.commit",
  "github.issue.read","github.issue.write","github.pr.read","github.pr.comment","shell.execute","network.fetch"
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function str(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}
function strArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) throw new Error(`${label} must be a string array`);
  return [...value] as string[];
}
function permission(value: unknown, label: string): RecipePermission {
  if (value !== "deny" && value !== "ask" && value !== "allow") throw new Error(`${label} must be deny, ask, or allow`);
  return value;
}

export function validateRecipe(input: unknown): RecipeV1 {
  const r = record(input, "recipe");
  for (const key of Object.keys(r)) if (!allowedFields.has(key)) throw new Error(`unknown recipe field: ${key}`);
  if (r.schema !== "aunoforge.dev/recipe/v1") throw new Error("schema must be aunoforge.dev/recipe/v1");
  const id = str(r.id, "id");
  const name = str(r.name, "name");
  if (!Number.isInteger(r.version) || (r.version as number) < 1) throw new Error("version must be a positive integer");
  const trust = record(r.trust, "trust");
  if (!["builtin","community","local"].includes(String(trust.level))) throw new Error("trust.level must be builtin, community, or local");
  const permissions = record(r.permissions, "permissions");
  const output = record(r.output, "output");
  const rawTools = strArray(r.tools, "tools");
  for (const tool of rawTools) if (!tools.has(tool as Capability)) throw new Error(`unknown tool capability: ${tool}`);

  let requires: RecipeV1["requires"];
  if (r.requires !== undefined) {
    const req = record(r.requires, "requires");
    let provider: Partial<ProviderCapabilities> | undefined;
    if (req.provider !== undefined) {
      const p = record(req.provider, "requires.provider");
      provider = {};
      for (const key of ["structuredOutput","toolCalling","largeContext","streaming","patchGeneration"] as const) {
        if (p[key] !== undefined) {
          if (typeof p[key] !== "boolean") throw new Error(`requires.provider.${key} must be boolean`);
          provider[key] = p[key] as boolean;
        }
      }
    }
    requires = provider ? { provider } : {};
  }

  return {
    schema: "aunoforge.dev/recipe/v1",
    id, name, version: r.version as number,
    trust: { level: trust.level as RecipeTrust },
    applies_to: strArray(r.applies_to, "applies_to"),
    inputs: strArray(r.inputs, "inputs"),
    passes: strArray(r.passes, "passes"),
    checks: strArray(r.checks, "checks"),
    tools: rawTools as Capability[],
    permissions: { shell: permission(permissions.shell, "permissions.shell"), network: permission(permissions.network, "permissions.network") },
    ...(requires ? { requires } : {}),
    output: { contract: str(output.contract, "output.contract") }
  };
}

export type RecipeValidationContext = {
  mode: PermissionMode;
  knownChecks: string[];
  providerCapabilities?: ProviderCapabilities;
};
