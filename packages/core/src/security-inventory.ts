export type PackageJsonDependencyScope = "runtime" | "optional" | "peer" | "development";

export interface PackageJsonInventoryItem {
  ecosystem: "npm";
  name: string;
  declaredVersion: string;
  relationship: "direct";
  scope: PackageJsonDependencyScope;
  sourcePath: string;
}

type DependencyMap = Record<string, string>;

const scopes: ReadonlyArray<{
  key: "dependencies" | "optionalDependencies" | "peerDependencies" | "devDependencies";
  scope: PackageJsonDependencyScope;
}> = [
  { key: "dependencies", scope: "runtime" },
  { key: "optionalDependencies", scope: "optional" },
  { key: "peerDependencies", scope: "peer" },
  { key: "devDependencies", scope: "development" },
];

function dependencyMap(manifest: Record<string, unknown>, key: string): DependencyMap {
  const value = manifest[key];
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${key} must be an object`);
  }

  const result: DependencyMap = {};
  for (const [name, declaredVersion] of Object.entries(value)) {
    if (typeof declaredVersion !== "string") {
      throw new Error(`${key}.${name} must be a string`);
    }
    result[name] = declaredVersion;
  }
  return result;
}

export function parsePackageJsonInventory(
  source: string,
  sourcePath = "package.json",
): PackageJsonInventoryItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Invalid package.json JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("package.json must contain an object");
  }

  const manifest = parsed as Record<string, unknown>;
  const maps = scopes.map(({ key, scope }) => ({ key, scope, values: dependencyMap(manifest, key) }));
  const seen = new Set<string>();
  const inventory: PackageJsonInventoryItem[] = [];

  for (const { scope, values } of maps) {
    for (const name of Object.keys(values).sort()) {
      if (seen.has(name)) continue;
      seen.add(name);
      inventory.push({
        ecosystem: "npm",
        name,
        declaredVersion: values[name]!,
        relationship: "direct",
        scope,
        sourcePath,
      });
    }
  }

  return inventory;
}
