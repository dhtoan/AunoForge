export type MergedPullRequest = { number:number; title:string; body:string; url?:string; labels:string[]; mergedAt:string; author?:string; breaking:boolean };
function labelNames(value:unknown):string[]{if(!Array.isArray(value))return[];return value.flatMap((x:any)=>typeof x==="string"?[x]:typeof x?.name==="string"?[x.name]:[]);}
export function normalizeMergedPullRequests(raw:unknown,since:string):MergedPullRequest[]{
  if(!Array.isArray(raw))throw new Error("GitHub pull list response must be an array");
  const sinceTime=Date.parse(since);
  if(Number.isNaN(sinceTime))throw new Error("Invalid since timestamp");
  return raw.flatMap((r:any)=>{
    if(!Number.isInteger(r?.number)||typeof r?.title!=="string"||typeof r?.merged_at!=="string")return[];
    if(Date.parse(r.merged_at)<sinceTime)return[];
    const labels=labelNames(r.labels); const body=typeof r.body==="string"?r.body:"";
    const breaking=labels.some((l)=>l.toLowerCase()==="breaking-change")||/BREAKING CHANGE:/i.test(body)||/^\w+(?:\([^)]*\))?!:/i.test(r.title);
    return [{number:r.number,title:r.title,body,...(typeof r.html_url==="string"?{url:r.html_url}:{}),labels,mergedAt:r.merged_at,...(typeof r.user?.login==="string"?{author:r.user.login}:{}),breaking}];
  });
}
