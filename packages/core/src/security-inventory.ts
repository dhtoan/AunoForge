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

export interface PnpmLockInventoryItem {
  ecosystem: "npm";
  name: string;
  resolvedVersion: string;
  relationship: "direct" | "transitive";
  scope?: PackageJsonDependencyScope;
  sourcePath: string;
  importerPath?: string;
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

const pnpmScopeByKey = new Map<string, PackageJsonDependencyScope>(
  scopes.map(({ key, scope }) => [key, scope]),
);

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

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function pnpmPackageIdentity(packageKey: string): { name: string; version: string } | undefined {
  const key = unquoteYamlScalar(packageKey).replace(/\([^)]*\)$/, "");
  const separator = key.lastIndexOf("@");
  if (separator <= 0 || separator === key.length - 1) return undefined;

  const name = key.slice(0, separator);
  const version = key.slice(separator + 1);
  if (!name || !version || version.startsWith("link:") || version.startsWith("workspace:")) {
    return undefined;
  }
  return { name, version };
}

function scopeRank(scope: PackageJsonDependencyScope | undefined): number {
  switch (scope) {
    case "runtime":
      return 0;
    case "optional":
      return 1;
    case "peer":
      return 2;
    case "development":
      return 3;
    default:
      return 4;
  }
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

export function parsePnpmLockInventory(
  source: string,
  sourcePath = "pnpm-lock.yaml",
): PnpmLockInventoryItem[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines.some((line) => line.includes("\t"))) {
    throw new Error("pnpm lockfile tabs are not supported");
  }

  const versionLine = lines.find((line) => /^lockfileVersion:\s*/.test(line));
  const version = versionLine ? unquoteYamlScalar(versionLine.slice(versionLine.indexOf(":") + 1)) : undefined;
  if (version !== "9.0") {
    throw new Error("Unsupported pnpm lockfileVersion; expected 9.0");
  }

  const importersIndex = lines.findIndex((line) => /^importers:\s*(?:\{\})?\s*$/.test(line));
  if (importersIndex < 0) throw new Error("pnpm lock importers are required");
  const packagesIndex = lines.findIndex((line) => /^packages:\s*(?:\{\})?\s*$/.test(line));

  const direct: PnpmLockInventoryItem[] = [];
  const importerEnd = packagesIndex > importersIndex ? packagesIndex : lines.length;
  let importerPath: string | undefined;
  let scope: PackageJsonDependencyScope | undefined;
  let dependencyName: string | undefined;
  let dependencyVersion: string | undefined;

  const flushDependency = () => {
    if (!dependencyName || !scope || !importerPath) return;
    if (dependencyVersion === undefined) {
      throw new Error(`${dependencyName} version is required`);
    }
    const versionValue = unquoteYamlScalar(dependencyVersion);
    if (!versionValue.startsWith("link:") && !versionValue.startsWith("workspace:")) {
      direct.push({
        ecosystem: "npm",
        name: dependencyName,
        resolvedVersion: versionValue.replace(/\([^)]*\)$/, ""),
        relationship: "direct",
        scope,
        sourcePath,
        importerPath,
      });
    }
    dependencyName = undefined;
    dependencyVersion = undefined;
  };

  for (let index = importersIndex + 1; index < importerEnd; index += 1) {
    const line = lines[index]!;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const importerMatch = line.match(/^  (\S.*):\s*$/);
    if (importerMatch) {
      flushDependency();
      importerPath = unquoteYamlScalar(importerMatch[1]!);
      scope = undefined;
      continue;
    }

    const scopeMatch = line.match(/^    (dependencies|optionalDependencies|peerDependencies|devDependencies):\s*(?:\{\})?\s*$/);
    if (scopeMatch) {
      flushDependency();
      scope = pnpmScopeByKey.get(scopeMatch[1]!);
      continue;
    }

    const dependencyMatch = line.match(/^      (\S.*):\s*$/);
    if (dependencyMatch && scope && importerPath) {
      flushDependency();
      dependencyName = unquoteYamlScalar(dependencyMatch[1]!);
      continue;
    }

    const versionMatch = line.match(/^        version:\s*(.+)\s*$/);
    if (versionMatch && dependencyName) {
      dependencyVersion = versionMatch[1]!;
    }
  }
  flushDependency();

  direct.sort((a, b) =>
    scopeRank(a.scope) - scopeRank(b.scope) ||
    a.importerPath!.localeCompare(b.importerPath!) ||
    a.name.localeCompare(b.name) ||
    a.resolvedVersion.localeCompare(b.resolvedVersion),
  );

  const dedupedDirect = new Map<string, PnpmLockInventoryItem>();
  for (const item of direct) {
    const identity = `${item.name}\u0000${item.resolvedVersion}`;
    if (!dedupedDirect.has(identity)) dedupedDirect.set(identity, item);
  }

  const transitive: PnpmLockInventoryItem[] = [];
  if (packagesIndex >= 0) {
    for (let index = packagesIndex + 1; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (!line.trim() || line.trimStart().startsWith("#")) continue;
      if (/^[^\s]/.test(line)) break;

      const packageMatch = line.match(/^  (\S.*):\s*(?:\{.*\})?\s*$/);
      if (!packageMatch) continue;
      const identity = pnpmPackageIdentity(packageMatch[1]!);
      if (!identity) continue;
      const key = `${identity.name}\u0000${identity.version}`;
      if (dedupedDirect.has(key)) continue;
      transitive.push({
        ecosystem: "npm",
        name: identity.name,
        resolvedVersion: identity.version,
        relationship: "transitive",
        sourcePath,
      });
    }
  }

  const result = [...dedupedDirect.values(), ...transitive];
  result.sort((a, b) =>
    a.name.localeCompare(b.name) ||
    a.resolvedVersion.localeCompare(b.resolvedVersion) ||
    (a.relationship === b.relationship ? 0 : a.relationship === "direct" ? -1 : 1),
  );
  return result;
}
