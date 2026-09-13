export interface SecurityAdvisoryPackage {
  ecosystem: "npm";
  name: string;
  version: string;
}

export type SecurityAdvisorySeverity = "critical" | "high" | "medium" | "low";

export interface SecurityAdvisory {
  id: string;
  severity?: SecurityAdvisorySeverity;
  fixedVersions: string[];
  provenance: "osv";
  confidence: 1;
}

export interface SecurityAdvisoryResult {
  package: SecurityAdvisoryPackage;
  advisories: SecurityAdvisory[];
}

export interface SecurityAdvisoryAdapter {
  readonly id: string;
  lookup(packages: SecurityAdvisoryPackage[], signal?: AbortSignal): Promise<SecurityAdvisoryResult[]>;
}

export interface OsvTransportRequest {
  url: string;
  body: {
    queries: Array<{
      package: { ecosystem: "npm"; name: string };
      version: string;
    }>;
  };
}

export type OsvTransport = (request: OsvTransportRequest, signal?: AbortSignal) => Promise<unknown>;

export interface OsvAdvisoryAdapterOptions {
  endpoint?: string;
  transport?: OsvTransport;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function severity(value: unknown): SecurityAdvisorySeverity | undefined {
  if (typeof value !== "string") return undefined;
  switch (value.toLowerCase()) {
    case "critical": return "critical";
    case "high": return "high";
    case "moderate":
    case "medium": return "medium";
    case "low": return "low";
    default: return undefined;
  }
}

function fixedVersions(vulnerability: Record<string, unknown>): string[] {
  const fixed = new Set<string>();
  if (!Array.isArray(vulnerability.affected)) return [];
  for (const affectedValue of vulnerability.affected) {
    const affected = record(affectedValue);
    if (!affected || !Array.isArray(affected.ranges)) continue;
    for (const rangeValue of affected.ranges) {
      const range = record(rangeValue);
      if (!range || !Array.isArray(range.events)) continue;
      for (const eventValue of range.events) {
        const event = record(eventValue);
        if (event && typeof event.fixed === "string" && event.fixed) fixed.add(event.fixed);
      }
    }
  }
  return [...fixed].sort();
}

function parseAdvisory(value: unknown): SecurityAdvisory | undefined {
  const vulnerability = record(value);
  if (!vulnerability || typeof vulnerability.id !== "string" || !vulnerability.id) return undefined;
  const databaseSpecific = record(vulnerability.database_specific);
  const normalizedSeverity = severity(databaseSpecific?.severity);
  return {
    id: vulnerability.id,
    ...(normalizedSeverity ? { severity: normalizedSeverity } : {}),
    fixedVersions: fixedVersions(vulnerability),
    provenance: "osv",
    confidence: 1,
  };
}

export class OsvAdvisoryAdapter implements SecurityAdvisoryAdapter {
  readonly id = "osv";
  private readonly endpoint: string;
  private readonly transport: OsvTransport;

  constructor(options: OsvAdvisoryAdapterOptions = {}) {
    this.endpoint = options.endpoint ?? "https://api.osv.dev/v1/querybatch";
    this.transport = options.transport ?? this.defaultTransport.bind(this);
  }

  private async defaultTransport(request: OsvTransportRequest, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(request.url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) throw new Error(`OSV querybatch returned ${response.status}`);
    return response.json();
  }

  async lookup(packages: SecurityAdvisoryPackage[], signal?: AbortSignal): Promise<SecurityAdvisoryResult[]> {
    const ordered = [...packages].sort((a, b) =>
      a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
    );
    if (ordered.length === 0) return [];

    const body: OsvTransportRequest["body"] = {
      queries: ordered.map((item) => ({
        package: { ecosystem: item.ecosystem, name: item.name },
        version: item.version,
      })),
    };
    const raw = record(await this.transport({ url: this.endpoint, body }, signal));
    if (!raw || !Array.isArray(raw.results) || raw.results.length !== ordered.length) {
      throw new Error("Invalid OSV querybatch response");
    }

    return ordered.map((item, index) => {
      const result = record(raw.results[index]);
      const advisories = Array.isArray(result?.vulns)
        ? result.vulns.map(parseAdvisory).filter((entry): entry is SecurityAdvisory => entry !== undefined)
        : [];
      advisories.sort((a, b) => a.id.localeCompare(b.id));
      return { package: item, advisories };
    });
  }
}
