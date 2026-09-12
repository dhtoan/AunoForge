import type { IssueRef } from "./issues.js";
export type PullRequestRef = IssueRef;
export type PullRequest = { number:number; title:string; body:string; url?:string; headRef:string; baseRef:string; fromFork:boolean; author?:string; labels:string[] };

function labels(value:unknown):string[]{if(!Array.isArray(value))return[];return value.flatMap((x:any)=>typeof x==="string"?[x]:typeof x?.name==="string"?[x.name]:[]);}
export function normalizePullRequest(raw:unknown):PullRequest{
  if(!raw||typeof raw!=="object")throw new Error("GitHub pull request response must be an object");
  const r=raw as any;
  if(!Number.isInteger(r.number)||typeof r.title!=="string"||typeof r.head?.ref!=="string"||typeof r.base?.ref!=="string")throw new Error("GitHub pull request response missing required fields");
  return {number:r.number,title:r.title,body:typeof r.body==="string"?r.body:"",...(typeof r.html_url==="string"?{url:r.html_url}:{}),headRef:r.head.ref,baseRef:r.base.ref,fromFork:r.head?.repo?.fork===true,...(typeof r.user?.login==="string"?{author:r.user.login}:{}),labels:labels(r.labels)};
}
