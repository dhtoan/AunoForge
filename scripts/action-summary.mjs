import { basename } from 'node:path';

export function getFindingVerificationCounts(report) {
  let verified = 0;
  let unverified = 0;
  for (const finding of report.findings) {
    if (finding.source === 'deterministic' || finding.location?.verified === true) verified += 1;
    else unverified += 1;
  }
  return { verified, unverified };
}

export function renderActionStepSummary({
  report,
  provider,
  format,
  reportPath,
  commentEnabled,
  allowWrite,
  incrementalSummary,
  annotationSummary = { eligible: 0, emitted: 0, overflow: 0 },
}) {
  const { verified, unverified } = getFindingVerificationCounts(report);
  const mode = commentEnabled && allowWrite ? 'PR comment write enabled' : 'read-only';
  const severity = report.summary;
  const rows = [
    `| Recommendation | \`${report.recommendation}\` |`,
  ];
  if (incrementalSummary) {
    rows.push(`| Incremental | New ${incrementalSummary.new} · Regressed ${incrementalSummary.regressed} · Persistent ${incrementalSummary.persistent} · Resolved ${incrementalSummary.resolved} |`);
  }
  rows.push(
    `| Provider | \`${provider}\` |`,
    `| Format | \`${format}\` |`,
    `| Mode | \`${mode}\` |`,
    `| Findings | ${verified} verified · ${unverified} unverified |`,
    `| Severity | Critical ${severity.critical} · High ${severity.high} · Medium ${severity.medium} · Low ${severity.low} · Info ${severity.info} |`,
    `| Annotations | ${annotationSummary.emitted} emitted · ${annotationSummary.overflow} overflow |`,
    `| Report | \`${basename(reportPath)}\` |`,
  );
  return [
    '## AunoForge Review',
    '',
    '| Field | Result |',
    '| --- | --- |',
    ...rows,
    '',
    '> Repository writes are disabled by default. PR comments require both `comment=true` and `allow-write=true` plus the required GitHub permission.',
    '',
  ].join('\n');
}
