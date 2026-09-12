import { createHash } from "node:crypto";
import type { Finding } from "@aunoforge/core";

export function normalizeFindingPath(value: string | undefined): string {
  if (!value) return "<repository>";
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").trim();
  return normalized || "<repository>";
}

function normalizeEvidenceValue(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[\t ]+/g, " "))
    .filter(Boolean)
    .join("\n");
}

export function normalizeEvidenceAnchor(finding: Finding): string {
  const evidence = [...new Set(finding.evidence.map(normalizeEvidenceValue).filter(Boolean))].sort();
  if (evidence.length > 0) return `evidence:${evidence.join("\n")}`;
  const start = finding.location?.startLine;
  if (Number.isInteger(start) && (start ?? 0) > 0) {
    const end = Math.max(start as number, finding.location?.endLine ?? (start as number));
    return `line:${start}-${end}`;
  }
  return "global";
}

export function fingerprintFinding(finding: Finding): string {
  const semantic = [
    normalizeFindingPath(finding.location?.file),
    finding.category.trim().toLowerCase(),
    normalizeEvidenceAnchor(finding),
  ].join("\0");
  return `af1:${createHash("sha256").update(semantic, "utf8").digest("hex")}`;
}
