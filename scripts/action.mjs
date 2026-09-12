import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewReport } from '../packages/core/dist/index.js';
import { renderReport, selectGitHubAnnotations } from '../packages/reporters/dist/index.js';
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
const format = process.env.INPUT_FORMAT || 'markdown';
const comment = (process.env.INPUT_COMMENT || 'false').toLowerCase() === 'true';
const allowWrite = (process.env.INPUT_ALLOW_WRITE || 'false').toLowerCase() === 'true';
const githubApiBase = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');

if (command !== 'review') throw new Error('AunoForge Action supports command=review only.');
if (comment && !allowWrite) throw new Error('comment=true requires allow-write=true and pull-requests: write permission.');
if (!['mock','codex','claude'].includes(provider)) throw new Error(`Unsupported provider: ${provider}`);
if (!['terminal','markdown','json','sarif'].includes(format)) throw new Error(`Unsupported format: ${format}`);

const args = [cliPath, 'review', '--root', workspace, '--provider', provider, '--format', 'json'];
if (model) args.push('--model', model);

const eventPath = process.env.GITHUB_EVENT_PATH;
let event = {};
if (eventPath) {
  try { event = JSON.parse(await readFile(eventPath, 'utf8')); } catch { event = {}; }
}
const repository = process.env.GITHUB_REPOSITORY || '';
const [owner, repo] = repository.split('/');
const prNumber = Number(event?.pull_request?.number);
const hasPullRequestContext = Number.isInteger(prNumber) && prNumber > 0 && Boolean(owner) && Boolean(repo);
if (hasPullRequestContext) args.push('--pr', String(prNumber), '--owner', owner, '--repo', repo);

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

async function fetchPullRequestDiff() {
  if (!hasPullRequestContext) return undefined;
  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`, {
    method: 'GET',
    headers: githubHeaders('application/vnd.github.v3.diff'),
  });
  if (!response.ok) throw new Error(`GitHub diff API returned ${response.status}`);
  return response.text();
}

const rawReport = await runNode(args);
const structuredReport = validateReviewReport(JSON.parse(rawReport));
const report = renderReport(structuredReport, format);
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
      const selection = selectGitHubAnnotations(structuredReport, diff);
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
    annotationSummary,
  });
  await appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummary, 'utf8');
}

if (comment) {
  if (!hasPullRequestContext) throw new Error('PR comment mode requires a pull_request event.');
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('PR comment mode requires GITHUB_TOKEN.');
  const body = format === 'markdown' ? report : `\`\`\`${format}\n${report}\n\`\`\``;
  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`, {
    method:'POST',
    headers:{
      ...githubHeaders('application/vnd.github+json'),
      'Content-Type':'application/json',
    },
    body:JSON.stringify({body})
  });
  if (!response.ok) throw new Error(`GitHub comment API returned ${response.status}`);
}
