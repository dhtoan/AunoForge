import { readFile } from "node:fs/promises";
import { resolveRepositoryPath } from "./paths.js";
import { validateFinding, type Finding } from "./contracts.js";

export async function verifyFindingEvidence(root: string, input: Finding): Promise<Finding> {
  const finding = validateFinding(input);
  if (!finding.location) return finding;

  try {
    const path = await resolveRepositoryPath(root, finding.location.file);
    const source = await readFile(path, "utf8");
    const lines = source.split(/\r?\n/);
    const start = finding.location.startLine ?? 1;
    const end = finding.location.endLine ?? start;
    if (start < 1 || end < start || start > lines.length || end > lines.length) throw new Error("invalid line range");

    const window = lines.slice(start - 1, end).join("\n");
    const hasEvidence = finding.evidence.length === 0 || finding.evidence.some((e) => window.includes(e) || source.includes(e));
    if (!hasEvidence) {
      return { ...finding, location: { ...finding.location, verified: false }, confidence: Math.max(0, Number((finding.confidence * 0.75).toFixed(2))) };
    }
    return { ...finding, location: { ...finding.location, verified: true } };
  } catch {
    const { location: _ignored, ...rest } = finding;
    return { ...rest, confidence: Math.max(0, Number((finding.confidence * 0.6).toFixed(2))) };
  }
}
