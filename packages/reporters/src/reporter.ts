import type { ReviewReport } from "@aunoforge/core";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderSarif } from "./sarif.js";
import { renderTerminal } from "./terminal.js";

export type ReportFormat = "terminal" | "markdown" | "json" | "sarif";

export function renderReport(report: ReviewReport, format: ReportFormat): string {
  if (format === "json") return renderJson(report);
  if (format === "markdown") return renderMarkdown(report);
  if (format === "sarif") return renderSarif(report);
  return renderTerminal(report);
}
