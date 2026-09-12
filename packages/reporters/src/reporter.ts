import type { ReviewReport } from "@aunoforge/core";
import type { IncrementalReviewReport } from "@aunoforge/comparison";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderSarif } from "./sarif.js";
import { renderTerminal } from "./terminal.js";
import { renderIncrementalJson, renderIncrementalMarkdown, renderIncrementalTerminal } from "./incremental.js";

export type ReportFormat = "terminal" | "markdown" | "json" | "sarif";

export function renderReport(report: ReviewReport, format: ReportFormat, incremental?: IncrementalReviewReport): string {
  if (!incremental) {
    if (format === "json") return renderJson(report);
    if (format === "markdown") return renderMarkdown(report);
    if (format === "sarif") return renderSarif(report);
    return renderTerminal(report);
  }
  if (format === "json") return renderIncrementalJson(incremental);
  if (format === "markdown") return renderIncrementalMarkdown(incremental);
  if (format === "sarif") return renderSarif(report, incremental);
  return renderIncrementalTerminal(incremental);
}
