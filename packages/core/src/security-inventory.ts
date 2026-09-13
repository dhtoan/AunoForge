export type PackageJsonDependencyScope = "runtime" | "optional" | "peer" | "development";

export interface PackageJsonInventoryItem {
  ecosystem: "npm";
  name: string;
  declaredVersion: string;
  relationship: "direct";
  scope: PackageJsonDependencyScope;
  sourcePath: string;
}

export interface PackageLockInventoryItem {
  ecosystem: "npm";
  name: string;
  resolvedVersion: string;
  relationship: "direct" | "transitive";
  scope?: PackageJsonDependencyScope;
  sourcePath: string;
  packagePath: string;
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

function packageNameFromLockPath(packagePath: string): string | undefined {
  const marker = "node_modules/";
  const markerIndex = packagePath.lastIndexOf(marker);
  if (markerIndex < 0) return undefined;

  const tail = packagePath.slice(markerIndex + marker.length);
  if (!tail) return undefined;
  if (tail.startsWith("@")) {
    const parts = tail.split("/");
    return parts.length === 2 && parts.every(Boolean) ? tail : undefined;
  }
  return tail.includes("/") ? undefined : tail;
}

function directScopes(rootPackage: Record<string, unknown>): Map<string, PackageJsonDependencyScope> {
  const result = new Map<string, PackageJsonDependencyScope>();
  for (const { key, scope } of scopes) {
    for (const name of Object.keys(dependencyMap(rootPackage, key))) {
      if (!result.has(name)) result.set(name, scope);
    }
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

export function parsePackageLockInventory(
  source: string,
  sourcePath = "package-lock.json",
): PackageLockInventoryItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Invalid package-lock.json JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("package-lock.json must contain an object");
  }

  const lockfile = parsed as Record<string, unknown>;
  if (lockfile.lockfileVersion !== 2 && lockfile.lockfileVersion !== 3) {
    throw new Error("Unsupported package-lock lockfileVersion; expected 2 or 3");
  }

  const packagesValue = lockfile.packages;
  if (packagesValue === null || typeof packagesValue !== "object" || Array.isArray(packagesValue)) {
    throw new Error("package-lock packages must be an object");
  }

  const packages = packagesValue as Record<string, unknown>;
  const rootValue = packages[""];
  if (rootValue === null || typeof rootValue !== "object" || Array.isArray(rootValue)) {
    throw new Error("package-lock root package metadata is required");
  }

  const rootScopes = directScopes(rootValue as Record<string, unknown>);
  const inventory: PackageLockInventoryItem[] = [];

  for (const packagePath of Object.keys(packages).filter(Boolean).sort()) {
    const packageValue = packages[packagePath];
    if (packageValue === null || typeof packageValue !== "object" || Array.isArray(packageValue)) {
      throw new Error(`${packagePath} metadata must be an object`);
    }

    const packageEntry = packageValue as Record<string, unknown>;
    const name = packageNameFromLockPath(packagePath);
    if (!name) continue;

    if (packageEntry.version === undefined && packageEntry.link === true) continue;
    if (typeof packageEntry.version !== "string") {
      throw new Error(`${packagePath} version must be a string`);
    }

    const scope = packagePath === `node_modules/${name}` ? rootScopes.get(name) : undefined;
    inventory.push({
      ecosystem: "npm",
      name,
      resolvedVersion: packageEntry.version,
      relationship: scope ? "direct" : "transitive",
      ...(scope ? { scope } : {}),
      sourcePath,
      packagePath,
    });
  }

  return inventory;
}
