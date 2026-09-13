import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const builtinPresetIds = [
  "recommended",
  "minimal",
  "strict",
  "security",
  "node",
  "python",
  "wordpress"
] as const;

export type BuiltinPresetId = typeof builtinPresetIds[number];
export type ConfigFormat = "terminal" | "markdown" | "json";

export type AunoForgeProjectConfig = {
  schemaVersion: 1;
  extends?: BuiltinPresetId;
  format?: ConfigFormat;
};

export type ResolvedAunoForgeConfig = {
  preset?: BuiltinPresetId;
  format: ConfigFormat;
};

type ConfigDefaults = Partial<Pick<ResolvedAunoForgeConfig, "format">>;

const allowedKeys = new Set(["schemaVersion", "extends", "format"]);
const builtinPresetSet = new Set<string>(builtinPresetIds);
const presetDefaults: Record<BuiltinPresetId, ResolvedAunoForgeConfig> = {
  recommended: { preset: "recommended", format: "terminal" },
  minimal: { preset: "minimal", format: "terminal" },
  strict: { preset: "strict", format: "terminal" },
  security: { preset: "security", format: "json" },
  node: { preset: "node", format: "terminal" },
  python: { preset: "python", format: "terminal" },
  wordpress: { preset: "wordpress", format: "terminal" }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function securitySensitiveError(key: string): Error | undefined {
  if (/allow[-_]?write|allowWrite/i.test(key)) {
    return new Error(`${key} cannot be set in project configuration; write permission requires an explicit runtime flag`);
  }
  if (/token|api[-_]?key|apiKey|credential|secret/i.test(key)) {
    return new Error(`${key} cannot be set in project configuration; credentials must be supplied at runtime`);
  }
  return undefined;
}

export function validateProjectConfig(value: unknown): AunoForgeProjectConfig {
  if (!isRecord(value)) throw new Error("Configuration must be a JSON object");

  for (const key of Object.keys(value)) {
    const sensitive = securitySensitiveError(key);
    if (sensitive) throw sensitive;
    if (!allowedKeys.has(key)) throw new Error(`Unknown configuration key: ${key}`);
  }

  if (value.schemaVersion === undefined) throw new Error("schemaVersion is required");
  if (value.schemaVersion !== 1) throw new Error("schemaVersion must be 1");

  if (value.extends !== undefined && (typeof value.extends !== "string" || !builtinPresetSet.has(value.extends))) {
    throw new Error("extends must be a built-in preset");
  }

  if (value.format !== undefined && value.format !== "terminal" && value.format !== "markdown" && value.format !== "json") {
    throw new Error("format must be terminal, markdown, or json");
  }

  const config: AunoForgeProjectConfig = { schemaVersion: 1 };
  if (value.extends !== undefined) config.extends = value.extends as BuiltinPresetId;
  if (value.format !== undefined) config.format = value.format as ConfigFormat;
  return config;
}

export function resolveProjectConfig(
  config: AunoForgeProjectConfig,
  overrides: Partial<Pick<ResolvedAunoForgeConfig, "format">> = {},
  defaults: ConfigDefaults = {}
): ResolvedAunoForgeConfig {
  const preset = config.extends ? presetDefaults[config.extends] : undefined;
  return {
    ...(preset?.preset ? { preset: preset.preset } : {}),
    format: overrides.format ?? config.format ?? preset?.format ?? defaults.format ?? "terminal"
  };
}

async function readProjectConfig(root: string): Promise<string | undefined> {
  const path = join(root, ".aunoforge", "config.json");
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    throw error;
  }
}

function parseProjectConfig(raw: string, path: string): AunoForgeProjectConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Configuration file is not valid JSON: ${path}`);
  }
  return validateProjectConfig(parsed);
}

export async function loadProjectConfig(root: string): Promise<AunoForgeProjectConfig> {
  const path = join(root, ".aunoforge", "config.json");
  const raw = await readProjectConfig(root);
  if (raw === undefined) throw new Error(`Configuration file not found: ${path}`);
  return parseProjectConfig(raw, path);
}

export async function loadProjectConfigIfPresent(root: string): Promise<AunoForgeProjectConfig | undefined> {
  const path = join(root, ".aunoforge", "config.json");
  const raw = await readProjectConfig(root);
  return raw === undefined ? undefined : parseProjectConfig(raw, path);
}

export async function resolveRuntimeConfig(
  root: string,
  overrides: Partial<Pick<ResolvedAunoForgeConfig, "format">> = {},
  defaults: ConfigDefaults = {}
): Promise<ResolvedAunoForgeConfig> {
  const config = await loadProjectConfigIfPresent(root) ?? { schemaVersion: 1 as const };
  return resolveProjectConfig(config, overrides, defaults);
}
