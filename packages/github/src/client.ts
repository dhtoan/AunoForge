import { normalizeIssue, normalizeDuplicates, type IssueRef, type RepoRef, type Issue, type DuplicateCandidate } from "./issues.js";
import { normalizePullRequest, type PullRequestRef, type PullRequest } from "./pulls.js";
import { normalizeMergedPullRequests, type MergedPullRequest } from "./releases.js";

export type GitHubTransportRequest = { url:string; accept?:string };
export type GitHubTransport = (request:GitHubTransportRequest, signal?:AbortSignal)=>Promise<unknown>;
export type GitHubReaderOptions = { token?:string; apiBase?:string; transport?:GitHubTransport };

export class GitHubReader {
  private readonly apiBase:string;
  private readonly transport:GitHubTransport;
  constructor(private readonly options:GitHubReaderOptions={}) {
    this.apiBase=(options.apiBase??"https://api.github.com").replace(/\/$/,"");
    this.transport=options.transport??this.defaultTransport.bind(this);
  }
  private async defaultTransport(request:GitHubTransportRequest,signal?:AbortSignal):Promise<unknown>{
    const headers:Record<string,string>={Accept:request.accept??"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
    if(this.options.token)headers.Authorization=`Bearer ${this.options.token}`;
    const response=await fetch(request.url,{method:"GET",headers,signal});
    if(!response.ok)throw new Error(`GitHub API returned ${response.status}`);
    if(request.accept?.includes("diff"))return response.text();
    return response.json();
  }
  async getIssue(ref:IssueRef,signal?:AbortSignal):Promise<Issue>{return normalizeIssue(await this.transport({url:`${this.apiBase}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/issues/${ref.number}`},signal));}
  async findDuplicateCandidates(input:RepoRef&{query:string},signal?:AbortSignal):Promise<DuplicateCandidate[]>{
    const q=encodeURIComponent(`repo:${input.owner}/${input.repo} is:issue ${input.query}`);
    return normalizeDuplicates(await this.transport({url:`${this.apiBase}/search/issues?q=${q}&per_page=10`},signal));
  }
  async getPullRequest(ref:PullRequestRef,signal?:AbortSignal):Promise<PullRequest>{return normalizePullRequest(await this.transport({url:`${this.apiBase}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`},signal));}
  async getPullRequestDiff(ref:PullRequestRef,signal?:AbortSignal):Promise<string>{const raw=await this.transport({url:`${this.apiBase}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}`,accept:"application/vnd.github.v3.diff"},signal);if(typeof raw!=="string")throw new Error("GitHub diff response must be text");return raw;}
  async listMergedPullRequestsSince(ref:RepoRef,since:string,signal?:AbortSignal):Promise<MergedPullRequest[]>{const raw=await this.transport({url:`${this.apiBase}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls?state=closed&sort=updated&direction=desc&per_page=100`},signal);return normalizeMergedPullRequests(raw,since);}
}
