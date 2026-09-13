import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  parsePackageJsonInventory,
  parsePackageLockInventory,
  parsePnpmLockInventory,
  type PackageJsonInventoryItem,
  type PackageLockInventoryItem,
  type PnpmLockInventoryItem,
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
  mode: "offline";
  sources: Array<SecuritySupportedSource | SecurityUnsupportedSource>;
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

export async function runSecurity(root: string): Promise<SecurityReport> {
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

  return { schemaVersion: "1", mode: "offline", sources };
}

export function renderSecurity(report: SecurityReport, format: "terminal" | "json"): string {
  if (format === "json") return JSON.stringify(report, null, 2);

  const lines = ["AunoForge security (offline)"];
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

  return lines.join("\n");
}
