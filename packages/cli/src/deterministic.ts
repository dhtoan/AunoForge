import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { Finding } from "@aunoforge/core";

const ignoredDirectories = new Set([".git", "node_modules", "dist", ".worktrees"]);
const supportedExtensions = new Set([".php", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".py"]);

type Rule = {
  category: string;
  title: string;
  extensions: Set<string>;
  pattern: RegExp;
  explanation: string;
  evidence: string;
};

const rules: Rule[] = [
  {
    category: "wordpress-output-escaping",
    title: "Raw request data is echoed directly",
    extensions: new Set([".php"]),
    pattern: /\becho\s+\$_(?:GET|POST|REQUEST)\b/,
    explanation: "Directly echoing request superglobals can expose unescaped attacker-controlled data.",
    evidence: "Matched direct echo of a request superglobal."
  },
  {
    category: "javascript-eval",
    title: "Dynamic JavaScript evaluation detected",
    extensions: new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"]),
    pattern: /\beval\s*\(/,
    explanation: "eval executes dynamically constructed JavaScript and creates a high-risk code execution boundary.",
    evidence: "Matched a direct eval call."
  },
  {
    category: "python-shell-execution",
    title: "Python subprocess enables shell execution",
    extensions: new Set([".py"]),
    pattern: /\bshell\s*=\s*True\b/,
    explanation: "shell=True can execute shell metacharacters when command input is not fully controlled.",
    evidence: "Matched shell=True in Python source."
  }
];

function finding(rule: Rule, file: string, line: number): Finding {
  const stableFile = file.split(sep).join("/");
  return {
    id: `deterministic:${rule.category}:${stableFile}:${line}`,
    severity: "high",
    category: rule.category,
    title: rule.title,
    evidence: [rule.evidence],
    location: { file: stableFile, startLine: line, endLine: line, verified: true },
    explanation: rule.explanation,
    verification: ["Inspect the matched line and confirm the risky primitive is necessary and safely constrained."],
    confidence: 0.99,
    source: "deterministic"
  };
}

function scanLines(file: string, source: string): Finding[] {
  const extension = extname(file).toLowerCase();
  if (!supportedExtensions.has(extension)) return [];
  const out: Finding[] = [];
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of rules) {
      if (rule.extensions.has(extension) && rule.pattern.test(lines[index] ?? "")) out.push(finding(rule, file, index + 1));
    }
  }
  return out;
}

async function sourceFiles(root: string, dir = root): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await sourceFiles(root, path));
    else if (entry.isFile() && supportedExtensions.has(extname(entry.name).toLowerCase())) out.push(path);
  }
  return out;
}

export async function scanRepositoryDeterministically(root: string): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const path of await sourceFiles(root)) {
    const file = relative(root, path).split(sep).join("/");
    out.push(...scanLines(file, await readFile(path, "utf8")));
  }
  return out;
}

export function scanDiffDeterministically(diff: string): Finding[] {
  const out: Finding[] = [];
  let file = "unknown";
  let newLine = 0;
  for (const raw of diff.split(/\r?\n/)) {
    const fileMatch = raw.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) { file = fileMatch[1] ?? "unknown"; continue; }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { newLine = Number(hunk[1]); continue; }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      const text = raw.slice(1);
      const matches = scanLines(file, `${"\n".repeat(Math.max(0, newLine - 1))}${text}`);
      out.push(...matches.map((item) => ({ ...item, location: item.location ? { ...item.location, startLine:newLine, endLine:newLine, verified:true } : undefined })));
      newLine += 1;
    } else if (!raw.startsWith("-") && !raw.startsWith("\\")) {
      newLine += 1;
    }
  }
  return out;
}
