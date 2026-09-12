import { validateReviewReport, type ReviewReport } from "@aunoforge/core";
export function renderJson(report: ReviewReport): string {
  return JSON.stringify(validateReviewReport(report), null, 2) + "\n";
}
