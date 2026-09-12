export type IssueRef = { owner: string; repo: string; number: number };
export type RepoRef = { owner: string; repo: string };
export type Issue = { number: number; title: string; body: string; url?: string; labels: string[]; author?: string };
export type DuplicateCandidate = { number: number; title: string; url?: string };

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((label) => {
    if (typeof label === "string") return [label];
    if (label && typeof label === "object" && typeof (label as any).name === "string") return [(label as any).name];
    return [];
  });
}

export function normalizeIssue(raw: unknown): Issue {
  if (!raw || typeof raw !== "object") throw new Error("GitHub issue response must be an object");
  const r = raw as any;
  if (!Number.isInteger(r.number) || typeof r.title !== "string") throw new Error("GitHub issue response missing number/title");
  return { number:r.number, title:r.title, body:typeof r.body === "string" ? r.body : "", ...(typeof r.html_url === "string" ? {url:r.html_url}:{}), labels:labels(r.labels), ...(typeof r.user?.login === "string" ? {author:r.user.login}: {}) };
}

export function normalizeDuplicates(raw: unknown): DuplicateCandidate[] {
  const items = raw && typeof raw === "object" && Array.isArray((raw as any).items) ? (raw as any).items : [];
  return items.flatMap((item:any) => Number.isInteger(item?.number) && typeof item?.title === "string"
    ? [{number:item.number,title:item.title,...(typeof item.html_url === "string" ? {url:item.html_url}:{})}]
    : []);
}
