import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewReport } from '../packages/core/dist/index.js';
import { renderJson, renderMarkdown, renderTerminal } from '../packages/reporters/dist/index.js';
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

if (command !== 'review') throw new Error('AunoForge Action supports command=review only.');
if (comment && !allowWrite) throw new Error('comment=true requires allow-write=true and pull-requests: write permission.');
if (!['mock','codex','claude'].includes(provider)) throw new Error(`Unsupported provider: ${provider}`);
if (!['terminal','markdown','json'].includes(format)) throw new Error(`Unsupported format: ${format}`);

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
if (Number.isInteger(prNumber) && prNumber > 0 && owner && repo) args.push('--pr', String(prNumber), '--owner', owner, '--repo', repo);

function runNode(argv) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, argv, { cwd:workspace, env:process.env, stdio:['ignore','pipe','inherit'] });
    let stdout='';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolvePromise(stdout) : reject(new Error(`AunoForge CLI exited with ${code}`)));
  });
}

const rawReport = await runNode(args);
const structuredReport = validateReviewReport(JSON.parse(rawReport));
const report = format === 'json'
  ? renderJson(structuredReport)
  : format === 'markdown'
    ? renderMarkdown(structuredReport)
    : renderTerminal(structuredReport);
process.stdout.write(report);

const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
const reportPath = join(workspace, `aunoforge-review.${extension}`);
await writeFile(reportPath, report, 'utf8');

if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `report-path=${reportPath}\n`, 'utf8');

if (process.env.GITHUB_STEP_SUMMARY) {
  const stepSummary = renderActionStepSummary({
    report: structuredReport,
    provider,
    format,
    reportPath,
    commentEnabled: comment,
    allowWrite,
  });
  await appendFile(process.env.GITHUB_STEP_SUMMARY, stepSummary, 'utf8');
}

if (comment) {
  if (!Number.isInteger(prNumber) || prNumber < 1 || !owner || !repo) throw new Error('PR comment mode requires a pull_request event.');
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('PR comment mode requires GITHUB_TOKEN.');
  const body = format === 'markdown' ? report : `\`\`\`${format}\n${report}\n\`\`\``;
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNumber}/comments`, {
    method:'POST',
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json',
      'X-GitHub-Api-Version':'2022-11-28'
    },
    body:JSON.stringify({body})
  });
  if (!response.ok) throw new Error(`GitHub comment API returned ${response.status}`);
}
