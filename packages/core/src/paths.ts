import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const protectedWrite = [
  /^\.git(?:\/|$)/,
  /^\.env(?:\.|$)/,
  /\.pem$/i,
  /\.key$/i
];

function normalizedRelative(root: string, target: string): string {
  const rel = relative(root, target).split(sep).join("/");
  if (rel === "" || rel === ".") return "";
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) throw new Error("Path is outside repository root");
  return rel;
}

async function nearestExistingRealPath(path: string): Promise<{ real: string; suffix: string[] }> {
  const suffix: string[] = [];
  let cursor = path;
  while (true) {
    try {
      return { real: await realpath(cursor), suffix };
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) throw new Error("Unable to resolve path ancestry");
      suffix.unshift(cursor.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
      cursor = parent;
    }
  }
}

export async function resolveRepositoryPath(root: string, requested: string, options: { forWrite?: boolean } = {}): Promise<string> {
  if (isAbsolute(requested)) throw new Error("Absolute paths are outside repository root");
  const rootReal = await realpath(root);
  const candidate = resolve(rootReal, requested);
  const rel = normalizedRelative(rootReal, candidate);
  if (options.forWrite && protectedWrite.some((pattern) => pattern.test(rel))) throw new Error(`Protected path cannot be written: ${rel}`);

  const existing = await nearestExistingRealPath(candidate);
  normalizedRelative(rootReal, existing.real);
  const finalPath = resolve(existing.real, ...existing.suffix);
  normalizedRelative(rootReal, finalPath);

  try {
    const stat = await lstat(candidate);
    if (stat.isSymbolicLink()) {
      const linked = await realpath(candidate);
      normalizedRelative(rootReal, linked);
    }
  } catch {
    // Non-existent final files are allowed after validating their nearest existing ancestor.
  }
  return finalPath;
}
