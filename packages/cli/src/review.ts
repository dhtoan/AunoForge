import { dedupeFindings, normalizeReviewReport, verifyFindingEvidence, type AunoForgeProvider, type AuditEvent, type Finding, type ReviewReport } from "@aunoforge/core";
import { renderReport, type ReportFormat } from "@aunoforge/reporters";
import type { PullRequest } from "@aunoforge/github";
import { buildAnalysisContext } from "./context.js";
import { getLocalDiff } from "./git.js";
import { scanDiffDeterministically } from "./deterministic.js";

export const REVIEW_PASSES = ["correctness","regression","security","compatibility","test-coverage","breaking-changes"] as const;
export type ReviewPass = (typeof REVIEW_PASSES)[number];
export type ReviewReader = {
  getPullRequest(ref:{owner:string;repo:string;number:number}):Promise<PullRequest>;
  getPullRequestDiff(ref:{owner:string;repo:string;number:number}):Promise<string>;
};
export type AuditSink={write(event:AuditEvent):Promise<void>};
export type ReviewOptions={
  root:string;
  provider:AunoForgeProvider;
  passes?:ReviewPass[];
  base?:string;
  diff?:string;
  github?:{reader:ReviewReader;owner:string;repo:string;prNumber:number};
  runTests?:boolean;
  audit?:AuditSink;
};

export async function review(options:ReviewOptions):Promise<ReviewReport>{
  const passes=options.passes??[...REVIEW_PASSES];
  let diff:string; let pull:PullRequest|undefined;
  const repository:{root:string;owner?:string;repo?:string;ref?:string}={root:options.root};
  if(options.github){
    const ref={owner:options.github.owner,repo:options.github.repo,number:options.github.prNumber};
    [pull,diff]=await Promise.all([options.github.reader.getPullRequest(ref),options.github.reader.getPullRequestDiff(ref)]);
    repository.owner=options.github.owner;repository.repo=options.github.repo;repository.ref=`pr:${options.github.prNumber}`;
  }else {
    diff=options.diff ?? await getLocalDiff(options.root,options.base);
    if(options.diff!==undefined) repository.ref="provided-diff";
  }

  if(options.runTests){
    if(pull?.fromFork) await options.audit?.write({command:"review",provider:options.provider.id,permissions:["git.diff","filesystem.read"],writes:[],shell:[],details:{decision:"fork-pr-no-secret-bearing-execution"}});
    else await options.audit?.write({command:"review",provider:options.provider.id,permissions:["git.diff","filesystem.read"],writes:[],shell:[],details:{decision:"safe-mode-no-shell-execution"}});
  }

  const all:Finding[]=scanDiffDeterministically(diff);
  for(const pass of passes){
    const request=buildAnalysisContext({
      task:`pull_request_review:${pass}`,
      trustedMetadata:{pass,...(pull?{pull:{number:pull.number,title:pull.title,baseRef:pull.baseRef,headRef:pull.headRef,fromFork:pull.fromFork,labels:pull.labels}}:{})},
      untrustedContent:{diff,...(pull?{pullBody:pull.body}:{})},checks:[pass],constraints:{readOnly:true,noShell:true,noNetwork:true}
    });
    const response=await options.provider.analyze(request);
    for(const finding of response.findings??[]) all.push(finding);
  }

  const deduped=dedupeFindings(all);
  const verified:Finding[]=[];
  for(const finding of deduped) verified.push(finding.source==="deterministic" ? finding : await verifyFindingEvidence(options.root,finding));
  return normalizeReviewReport(repository,verified);
}

export function renderReview(report:ReviewReport,format:ReportFormat="terminal"):string{
  return renderReport(report,format);
}
