import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { redactObject } from "./secrets.js";

export type AuditEvent = {
  time?: string;
  command: string;
  provider?: string;
  recipe?: string;
  permissions?: string[];
  writes?: unknown[];
  shell?: unknown[];
  details?: Record<string, unknown>;
};

export class AuditLogger {
  constructor(readonly path: string) {}
  async write(event: AuditEvent): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const safe = redactObject({ ...event, time: event.time ?? new Date().toISOString() });
    await appendFile(this.path, `${JSON.stringify(safe)}\n`, "utf8");
  }
}
