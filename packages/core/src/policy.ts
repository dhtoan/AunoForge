export type PermissionMode = "safe" | "ask" | "trusted";
export type Capability =
  | "filesystem.read" | "filesystem.write"
  | "git.diff" | "git.history" | "git.commit"
  | "github.issue.read" | "github.issue.write"
  | "github.pr.read" | "github.pr.comment"
  | "shell.execute" | "network.fetch";

export type PolicyDecision = { allowed: boolean; requiresApproval: boolean; reason: string };
export type PolicyContext = { source?: "core" | "recipe" | "provider" | "user"; requestedBy?: string };

const SAFE_READS = new Set<Capability>([
  "filesystem.read", "git.diff", "git.history", "github.issue.read", "github.pr.read"
]);
const WRITE_CAPS = new Set<Capability>([
  "filesystem.write", "git.commit", "github.issue.write", "github.pr.comment"
]);

export class PolicyEngine {
  readonly mode: PermissionMode;
  constructor(options: { mode?: PermissionMode } = {}) {
    this.mode = options.mode ?? "safe";
  }

  decide(capability: Capability, context: PolicyContext = {}): PolicyDecision {
    if (SAFE_READS.has(capability)) return { allowed: true, requiresApproval: false, reason: "read-only capability" };

    if (capability === "network.fetch") {
      if (context.source === "recipe") return { allowed: false, requiresApproval: false, reason: "recipe network access is disabled in v0.1.0" };
      if (this.mode === "safe") return { allowed: false, requiresApproval: false, reason: "safe mode denies arbitrary network access" };
      return this.mode === "ask"
        ? { allowed: false, requiresApproval: true, reason: "network access requires approval" }
        : { allowed: true, requiresApproval: false, reason: "trusted mode network access" };
    }

    if (capability === "shell.execute") {
      if (this.mode === "ask" && context.source === "user") return { allowed: false, requiresApproval: true, reason: "shell execution requires explicit user approval" };
      return { allowed: false, requiresApproval: this.mode === "ask", reason: "shell execution is denied unless explicitly approved from a trusted user boundary" };
    }

    if (WRITE_CAPS.has(capability)) {
      if (this.mode === "safe") return { allowed: false, requiresApproval: false, reason: "safe mode is read-only" };
      if (this.mode === "ask") return { allowed: false, requiresApproval: true, reason: "write capability requires approval" };
      if (context.requestedBy === "recipe" || context.source === "recipe" || context.requestedBy === "provider" || context.source === "provider") {
        return { allowed: false, requiresApproval: true, reason: "recipes and providers cannot self-authorize writes" };
      }
      return { allowed: true, requiresApproval: false, reason: "trusted maintainer-controlled write" };
    }

    return { allowed: false, requiresApproval: false, reason: "capability denied by default" };
  }
}
