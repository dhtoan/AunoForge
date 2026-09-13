import { getGitLog } from "./git.js";

export type ReleasePullRequest = {
  number: number;
  title: string;
  body: string;
  url?: string;
  labels: string[];
  mergedAt: string;
  author?: string;
  breaking: boolean;
};

export type ReleaseReader = {
  listMergedPullRequestsSince(ref: { owner: string; repo: string }, since: string): Promise<ReleasePullRequest[]>;
};

export type GenerateReleaseNotesOptions = {
  root: string;
  from?: string;
  github?: {
    reader: ReleaseReader;
    owner: string;
    repo: string;
    since: string;
  };
};

export type ReleaseCategory = "Features" | "Fixes" | "Security" | "Breaking" | "Maintenance";
export type RecommendedBump = "major" | "minor" | "patch" | "none";
export type ReleaseChange = {
  category: ReleaseCategory;
  title: string;
  source: "commit" | "pull-request";
  commit?: string;
  pullRequest?: number;
  author?: string;
  evidence: string;
};
export type ReleaseDataset = {
  categories: Record<ReleaseCategory, ReleaseChange[]>;
  recommendedBump: RecommendedBump;
  contributors: string[];
};

export type ReleaseNotesResult = {
  markdown: string;
  commitCount: number;
  breakingChanges: string[];
  contributors: string[];
  dataset: ReleaseDataset;
};

type Commit = { hash: string; subject: string; author: string; date: string };
type SectionName = "Added" | "Fixed" | "Security" | "Improved" | "Changed";
type PullRequestClassification = { category: ReleaseCategory; evidence: string };

function parseLog(raw: string): Commit[] {
  return raw.split("\n").filter(Boolean).map((line) => {
    const [hash = "", subject = "", author = "", date = ""] = line.split("\t");
    return { hash, subject, author, date };
  });
}

function stripConventionalPrefix(subject: string): string {
  return subject.replace(/^[a-z]+(?:\([^)]*\))?!?:\s*/i, "").trim();
}

function sectionFor(subject: string): SectionName {
  if (/^feat(?:\([^)]*\))?!?:/i.test(subject)) return "Added";
  if (/^fix(?:\([^)]*\))?!?:/i.test(subject)) return "Fixed";
  if (/^security(?:\([^)]*\))?!?:/i.test(subject)) return "Security";
  if (/^(?:perf|refactor)(?:\([^)]*\))?!?:/i.test(subject)) return "Improved";
  return "Changed";
}

function isBreaking(subject: string): boolean {
  return /^\w+(?:\([^)]*\))?!:/i.test(subject) || /BREAKING CHANGE:/i.test(subject);
}

function categoryForCommit(subject: string): ReleaseCategory {
  if (isBreaking(subject)) return "Breaking";
  if (/^feat(?:\([^)]*\))?:/i.test(subject)) return "Features";
  if (/^fix(?:\([^)]*\))?:/i.test(subject)) return "Fixes";
  if (/^security(?:\([^)]*\))?:/i.test(subject)) return "Security";
  return "Maintenance";
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function classifyPullRequest(pr: ReleasePullRequest): PullRequestClassification {
  const labels = new Set(pr.labels.map(normalizeLabel));
  const labelRules: Array<[string, ReleaseCategory]> = [
    ["breaking", "Breaking"],
    ["feature", "Features"],
    ["fix", "Fixes"],
    ["security", "Security"],
    ["maintenance", "Maintenance"]
  ];
  for (const [label, category] of labelRules) {
    if (labels.has(label)) return { category, evidence: `label:${label}` };
  }

  if (pr.breaking) return { category: "Breaking", evidence: "metadata:breaking" };
  if (isBreaking(pr.title)) return { category: "Breaking", evidence: "title:breaking" };
  if (/^feat(?:\([^)]*\))?:/i.test(pr.title)) return { category: "Features", evidence: "title:feat" };
  if (/^fix(?:\([^)]*\))?:/i.test(pr.title)) return { category: "Fixes", evidence: "title:fix" };
  if (/^security(?:\([^)]*\))?:/i.test(pr.title)) return { category: "Security", evidence: "title:security" };
  return { category: "Maintenance", evidence: "fallback:maintenance" };
}

function recommendedBump(categories: Record<ReleaseCategory, ReleaseChange[]>): RecommendedBump {
  if (categories.Breaking.length) return "major";
  if (categories.Features.length) return "minor";
  if (categories.Fixes.length || categories.Security.length || categories.Maintenance.length) return "patch";
  return "none";
}

function emptyCategories(): Record<ReleaseCategory, ReleaseChange[]> {
  return {
    Features: [],
    Fixes: [],
    Security: [],
    Breaking: [],
    Maintenance: []
  };
}

function renderSection(name: string, lines: string[]): string {
  if (!lines.length) return "";
  return `### ${name}\n${lines.map((line) => `- ${line}`).join("\n")}\n`;
}

export async function generateReleaseNotes(options: GenerateReleaseNotesOptions): Promise<ReleaseNotesResult> {
  const commits = parseLog(await getGitLog(options.root, options.from));
  const sections = new Map<SectionName, string[]>([
    ["Added", []], ["Fixed", []], ["Security", []], ["Improved", []], ["Changed", []]
  ]);
  const categories = emptyCategories();
  const breakingChanges: string[] = [];
  const contributors = new Set<string>();

  for (const commit of commits) {
    const text = stripConventionalPrefix(commit.subject);
    sections.get(sectionFor(commit.subject))!.push(text);
    if (isBreaking(commit.subject)) breakingChanges.push(text);
    const category = categoryForCommit(commit.subject);
    categories[category].push({
      category,
      title: text,
      source: "commit",
      commit: commit.hash,
      evidence: `commit:${commit.hash}`
    });
  }

  const pullRequestLines: string[] = [];
  if (options.github) {
    const prs = await options.github.reader.listMergedPullRequestsSince(
      { owner: options.github.owner, repo: options.github.repo },
      options.github.since
    );
    for (const pr of prs) {
      const text = stripConventionalPrefix(pr.title);
      const author = pr.author ? ` by @${pr.author}` : "";
      pullRequestLines.push(`#${pr.number} ${text}${author}`);
      if (pr.author) contributors.add(pr.author);
      if (pr.breaking) breakingChanges.push(`#${pr.number} ${text}`);
      const classification = classifyPullRequest(pr);
      categories[classification.category].push({
        category: classification.category,
        title: text,
        source: "pull-request",
        pullRequest: pr.number,
        ...(pr.author ? { author: pr.author } : {}),
        evidence: classification.evidence
      });
    }
  }

  const parts = ["## Release notes", ""];
  for (const name of ["Added", "Fixed", "Security", "Improved", "Changed"] as const) {
    const rendered = renderSection(name, sections.get(name)!);
    if (rendered) parts.push(rendered.trimEnd(), "");
  }
  if (pullRequestLines.length) parts.push(renderSection("Merged pull requests", pullRequestLines).trimEnd(), "");

  parts.push("### Compatibility");
  if (breakingChanges.length) {
    parts.push("Breaking changes detected:", ...breakingChanges.map((item) => `- ${item}`));
  } else {
    parts.push("No explicit breaking changes were detected in commit or pull request metadata.");
  }
  if (contributors.size) {
    parts.push("", "### Contributors", ...[...contributors].sort().map((name) => `- @${name}`));
  }

  const dataset: ReleaseDataset = {
    categories,
    recommendedBump: recommendedBump(categories),
    contributors: [...contributors].sort()
  };

  return {
    markdown: `${parts.join("\n").trimEnd()}\n`,
    commitCount: commits.length,
    breakingChanges,
    contributors: dataset.contributors,
    dataset
  };
}
