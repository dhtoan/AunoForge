import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewReport } from '../packages/core/dist/index.js';
import { compareReviewReports, validateBaselineReport } from '../packages/comparison/dist/index.js';
import { renderReport, selectGitHubAnnotations } from '../packages/reporters/dist/index.js';
import { resolveRuntimeConfig } from '../packages/cli/dist/config.js';
import { emitGitHubAnnotations } from './action-annotations.mjs';
import { renderActionStepSummary } from './action-summary.mjs';

const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const actionRoot = resolve(process.env.GITHUB_ACTION_PATH || sourceRoot);
const packagedCli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const cliPath = existsSync(packagedCli) ? packagedCli : join(actionRoot, 'dist/action/cli.mjs');
const workspace = resolve(process.env.GITHUB_WORKSPACE || process.cwd());
const command = process.env.INPUT_COMMAND || 'review';
const provider = process.env.INPUT_PROVIDER || 'mock';
const model = process.env.INPUT_MODEL || '';
const formatInput = process.env.INPUT_FORMAT || '';
const advisory = process.env.INPUT_ADVISORY || '';
const baselineInput = process.env.INPUT_BASELINE || '';
const comment = (process.env.INPUT_COMMENT || 'false').toLowerCase() === 'true';
const allowWrite = (process.env.INPUT_ALLOW_WRITE || 'false').toLowerCase() === 'true';
const githubApiBase = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const reviewCommentMarker = '<!-- aunoforge:review-comment -->';

if (!['review', 'security'].includes(command)) throw new Error(`Unsupported AunoForge Action command: ${command}`);
const format = command === 'review' && formatInput === 'sarif'
  ? 'sarif'
  : (await resolveRuntimeConfig(
      workspace,
      formatInput ? { format: formatInput } : {},
      { format: command === 'review' ? 'markdown' : 'terminal' },
    )).format;

if (command === 'review') {
  if (comment && !allowWrite) throw new Error('comment=true requires allow-write=true and pull-requests: write permission.');
  if (!['mock','codex','claude'].includes(provider)) throw new Error(`Unsupported provider: ${provider}`);
  if (!['terminal','markdown','json','sarif'].includes(format)) throw new Error(`Unsupported format: ${format}`);
  if (advisory) throw new Error('advisory is supported only with command=security.');
} else {
  if (!['terminal','json'].includes(format)) throw new Error('command=security supports format=terminal or format=json.');
  if (advisory && advisory !== 'osv') throw new Error('command=security advisory must be empty or osv.');
  if (baselineInput) throw new Error('baseline is supported only with command=review.');
  if (comment || allowWrite) throw new Error('command=security is read-only and does not support comment or allow-write.');
}

function runNode(argv) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, argv, { cwd:workspace, env:process.env, stdio:['ignore','pipe','inherit'] });
    let stdout='';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolvePromise(stdout) : reject(new Error(`AunoForge CLI exited with ${code}`)));
  });
}

function githubHeaders(accept) {
  const headers = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const eventPath = process.env.GITHUB_EVENT_PATH;
let event = {};
if (eventPath) {
  try { event = JSON.parse(await readFile(eventPath, 'utf8')); } catch { event = {}; }
}
const repository = process.env.GITHUB_REPOSITORY || '';
const [owner, repo] = repository.split('/');
const prNumber = Number(event?.pull_request?.number);
const hasPullRequestContext = Number.isInteger(prNumber) && prNumber > 0 && Boolean(owner) && Boolean(repo);

async function fetchPullRequestDiff() {
  if (!hasPullRequestContext) return undefined;
  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
    method: 'GET',
    headers: githubHeaders('application/vnd.github.v3.diff'),
  });
  if (!response.ok) throw new Error(`GitHub diff API returned ${response.status}`);
  return response.text();
}

async function upsertReviewComment(body) {
  const listUrl = `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments?per_page=100`;
  const listResponse = await fetch(listUrl, {
    method: 'GET',
    headers: githubHeaders('application/vnd.github+json'),
  });
  if (!listResponse.ok) throw new Error(`GitHub comment list API returned ${listResponse.status}`);
  const comments = await listResponse.json();
  if (!Array.isArray(comments)) throw new Error('GitHub comment list API returned an invalid response');

  const ownedComment = comments.find((entry) => (
    Number.isInteger(Number(entry?.id))
    && typeof entry?.body === 'string'
    && entry.body.includes(reviewCommentMarker)
  ));
  const markedBody = `${reviewCommentMarker}\n${body}`;
  const target = ownedComment
    ? `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/comments/${Number(ownedComment.id)}`
    : `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`;
  const response = await fetch(target, {
    method: ownedComment ? 'PATCH' : 'POST',
    headers: {
      ...githubHeaders('application/vnd.github+json'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: markedBody }),
  });
  if (!response.ok) throw new Error(`GitHub comment ${ownedComment ? 'update' : 'create'} API returned ${response.status}`);
}

if (command === 'security') {
  const args = [cliPath, 'security', '--root', workspace, '--format', format];
  if (advisory) args.push('--advisory', advisory);
  const report = await runNode(args);
  process.stdout.write(report);

  const extension = format === 'json' ? 'json' : 'txt';
  const reportPath = join(workspace, `aunoforge-security.${extension}`);
  await writeFile(reportPath, report, 'utf8');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `report-path=${reportPath}\n`, 'utf8');
} else {
  const args = [cliPath, 'review', '--root', workspace, '--provider', provider, '--format', 'json'];
  if (model) args.push('--model', model);
  if (hasPullRequestContext) args.push('--pr', String(prNumber), '--owner', owner, '--repo', repo);

  const rawReport = await runNode(args);
  const structuredReport = validateReviewReport(JSON.parse(rawReport));
  const baseline = baselineInput
    ? validateBaselineReport(JSON.parse(await readFile(resolve(workspace, baselineInput), 'utf8')))
    : undefined;
  const incremental = baseline ? compareReviewReports(baseline, structuredReport) : undefined;
  const report = renderReport(structuredReport, format, incremental);
  process.stdout.write(report);

  const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : format === 'sarif' ? 'sarif' : 'txt';
  const reportPath = join(workspace, `aunoforge-review.${extension}`);
  await writeFile(reportPath, report, 'utf8');

  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `report-path=${reportPath}\n`, 'utf8');

  let annotationSummary = { eligible: 0, emitted: 0, overflow: 0 };
  if (hasPullRequestContext) {
    try {
      const diff = await fetchPullRequestDiff();
      if (diff !== undefined) {
        const annotationReport = incremental
          ? {
              ...structuredReport,
              findings: incremental.findings
                .filter((item) => item.state === 'new' || item.state === 'regressed')
                .map((item) => item.finding),
            }
          : structuredReport;
        const selection = selectGitHubAnnotations(annotationReport, diff);
        emitGitHubAnnotations(selection.annotations);
        annotationSummary = {
          eligible: selection.eligible,
          emitted: selection.annotations.length,
          overflow: selection.overflow,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`AunoForge annotations skipped: ${message}\n`);
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const stepSummary = renderActionStepSummary({
      report: structuredReport,
      provider,
      format,
      reportPath,
      commentEnabled: comment,
      allowWrite,
      incrementalSummary: incremental?.summary,
      annotationSummary,
    });
    await appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummary, 'utf8');
  }

  if (comment) {
    if (!hasPullRequestContext) throw new Error('PR comment mode requires a pull_request event.');
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('PR comment mode requires GITHUB_TOKEN.');
    const body = format === 'markdown' ? report : `\`\`\`${format}\n${report}\n\`\`\``;
    await upsertReviewComment(body);
  }
}
