import type { ReviewReport } from "@aunoforge/core";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderTerminal } from "./terminal.js";

export type ReportFormat = "terminal" | "markdown" | "json";

export function renderReport(report: ReviewReport, format: ReportFormat): string {
  if (format === "json") return renderJson(report);
  if (format === "markdown") return renderMarkdown(report);
  return renderTerminal(report);
}
