import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  parsePackageJsonInventory,
  parsePackageLockInventory,
  parsePnpmLockInventory,
  type PackageJsonInventoryItem,
  type PackageLockInventoryItem,
  type PnpmLockInventoryItem,
  type SecurityAdvisoryAdapter,
  type SecurityAdvisoryPackage,
  type SecurityAdvisoryResult,
} from "@aunoforge/core";

type InventoryItem = PackageJsonInventoryItem | PackageLockInventoryItem | PnpmLockInventoryItem;
type SourceFormat = "package-json" | "package-lock" | "pnpm-lock";

export interface SecuritySupportedSource {
  path: string;
  format: SourceFormat;
  status: "supported";
  inventory: InventoryItem[];
}

export interface SecurityUnsupportedSource {
  path: string;
  format: SourceFormat;
  status: "unsupported";
  error: string;
}

export interface SecurityReport {
  schemaVersion: "1";
  mode: "offline" | "advisory";
  sources: Array<SecuritySupportedSource | SecurityUnsupportedSource>;
  advisories?: SecurityAdvisoryResult[];
}

export interface RunSecurityOptions {
  advisoryAdapter?: SecurityAdvisoryAdapter;
}

const supportedFiles = new Map<string, SourceFormat>([
  ["package.json", "package-json"],
  ["package-lock.json", "package-lock"],
  ["pnpm-lock.yaml", "pnpm-lock"],
]);

const ignoredDirectories = new Set([".git", "node_modules", ".aunoforge"]);

function normalizePath(path: string): string {
  return path.split("\\").join("/");
}

async function discoverSupportedFiles(root: string): Promise<Array<{ absolutePath: string; relativePath: string; format: SourceFormat }>> {
  const found: Array<{ absolutePath: string; relativePath: string; format: SourceFormat }> = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const format = supportedFiles.get(entry.name);
      if (!format) continue;
      found.push({
        absolutePath,
        relativePath: normalizePath(relative(root, absolutePath)),
        format,
      });
    }
  }

  await visit(root);
  found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return found;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseSource(format: SourceFormat, source: string, sourcePath: string): InventoryItem[] {
  if (format === "package-json") return parsePackageJsonInventory(source, sourcePath);
  if (format === "package-lock") return parsePackageLockInventory(source, sourcePath);
  return parsePnpmLockInventory(source, sourcePath);
}

function advisoryPackages(sources: SecurityReport["sources"]): SecurityAdvisoryPackage[] {
  const packages = new Map<string, SecurityAdvisoryPackage>();
  for (const source of sources) {
    if (source.status !== "supported") continue;
    for (const item of source.inventory) {
      if (!("resolvedVersion" in item)) continue;
      const candidate: SecurityAdvisoryPackage = {
        ecosystem: item.ecosystem,
        name: item.name,
        version: item.resolvedVersion,
      };
      const key = `${candidate.ecosystem}\u0000${candidate.name}\u0000${candidate.version}`;
      if (!packages.has(key)) packages.set(key, candidate);
    }
  }
  return [...packages.values()].sort((a, b) =>
    a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}

export async function runSecurity(root: string, options: RunSecurityOptions = {}): Promise<SecurityReport> {
  const files = await discoverSupportedFiles(root);
  const sources: SecurityReport["sources"] = [];

  for (const file of files) {
    const source = await readFile(file.absolutePath, "utf8");
    try {
      sources.push({
        path: file.relativePath,
        format: file.format,
        status: "supported",
        inventory: parseSource(file.format, source, file.relativePath),
      });
    } catch (error) {
      sources.push({
        path: file.relativePath,
        format: file.format,
        status: "unsupported",
        error: errorMessage(error),
      });
    }
  }

  if (!options.advisoryAdapter) return { schemaVersion: "1", mode: "offline", sources };
  const advisories = await options.advisoryAdapter.lookup(advisoryPackages(sources));
  return { schemaVersion: "1", mode: "advisory", sources, advisories };
}

export function renderSecurity(report: SecurityReport, format: "terminal" | "json"): string {
  if (format === "json") return JSON.stringify(report, null, 2);

  const lines = [`AunoForge security (${report.mode})`];
  if (report.sources.length === 0) lines.push("No supported dependency evidence found.");

  for (const source of report.sources) {
    lines.push(`\n${source.path} [${source.status}]`);
    if (source.status === "unsupported") {
      lines.push(`  ${source.error}`);
      continue;
    }
    for (const item of source.inventory) {
      const version = "resolvedVersion" in item ? item.resolvedVersion : item.declaredVersion;
      const scope = item.scope ? ` ${item.scope}` : "";
      lines.push(`  ${item.name} ${version} ${item.relationship}${scope}`);
    }
  }

  if (report.advisories) {
    lines.push("\nAdvisories");
    for (const result of report.advisories) {
      if (result.advisories.length === 0) {
        lines.push(`  ${result.package.name} ${result.package.version}: none`);
        continue;
      }
      for (const advisory of result.advisories) {
        const severity = advisory.severity ? ` ${advisory.severity}` : "";
        const fixed = advisory.fixedVersions.length ? ` fixed ${advisory.fixedVersions.join(",")}` : "";
        lines.push(`  ${result.package.name} ${result.package.version}: ${advisory.id}${severity}${fixed}`);
      }
    }
  }

  return lines.join("\n");
}
