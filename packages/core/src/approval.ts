export type ApprovalSource = "interactive" | "trusted-ci";
export type ApprovalToken = Readonly<{ source: ApprovalSource; createdAt: number }>;
const issuedTokens = new WeakSet<object>();

export function createApprovalToken(source: ApprovalSource): ApprovalToken {
  const token = Object.freeze({ source, createdAt: Date.now() });
  issuedTokens.add(token);
  return token;
}

export function isApprovalToken(value: unknown): value is ApprovalToken {
  return typeof value === "object" && value !== null && issuedTokens.has(value as object);
}

export type ProposedAction = {
  type: "write-file" | "github-comment" | "apply-label" | "create-branch" | "create-pr";
  reason: string;
  preview: unknown;
  requiresApproval: true;
};
