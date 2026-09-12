import { readFile } from "node:fs/promises";
import type { DuplicateCandidate, Issue } from "@aunoforge/github";

export type IssueFixture = { issue: Issue; duplicates?: DuplicateCandidate[] };

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}
function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return string(value, label);
}
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${label} must be a string array`);
  return value as string[];
}
function parseIssue(value: unknown): Issue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("fixture.issue must be an object");
  const raw = value as Record<string, unknown>;
  if (!Number.isInteger(raw.number) || (raw.number as number) < 1) throw new Error("fixture.issue.number must be a positive integer");
  const url = optionalString(raw.url, "fixture.issue.url");
  const author = optionalString(raw.author, "fixture.issue.author");
  return {
    number: raw.number as number,
    title: string(raw.title, "fixture.issue.title"),
    body: string(raw.body ?? "", "fixture.issue.body"),
    labels: strings(raw.labels ?? [], "fixture.issue.labels"),
    ...(url ? { url } : {}),
    ...(author ? { author } : {})
  };
}
function parseDuplicates(value: unknown): DuplicateCandidate[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("fixture.duplicates must be an array");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`fixture.duplicates[${index}] must be an object`);
    const raw = item as Record<string, unknown>;
    if (!Number.isInteger(raw.number) || (raw.number as number) < 1) throw new Error(`fixture.duplicates[${index}].number must be a positive integer`);
    const url = optionalString(raw.url, `fixture.duplicates[${index}].url`);
    return { number:raw.number as number, title:string(raw.title, `fixture.duplicates[${index}].title`), ...(url ? {url}:{}) };
  });
}

export class IssueFixtureReader {
  constructor(private readonly fixture: IssueFixture) {}
  async getIssue(_ref: { owner:string; repo:string; number:number }): Promise<Issue> { return this.fixture.issue; }
  async findDuplicateCandidates(_input: { owner:string; repo:string; query:string }): Promise<DuplicateCandidate[]> { return this.fixture.duplicates ?? []; }
}

export async function loadIssueFixtureReader(path: string): Promise<IssueFixtureReader> {
  const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Issue fixture must be an object");
  const record = raw as Record<string, unknown>;
  return new IssueFixtureReader({ issue:parseIssue(record.issue), duplicates:parseDuplicates(record.duplicates) });
}
