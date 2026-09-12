import type { AunoForgeProvider, ReproductionPlan } from "@aunoforge/core";
import type { Issue } from "@aunoforge/github";
import { buildAnalysisContext } from "./context.js";
export type ReproduceReader={getIssue(ref:{owner:string;repo:string;number:number}):Promise<Issue>};
function strings(value:unknown,label:string):string[]{if(!Array.isArray(value)||value.some(x=>typeof x!=="string"))throw new Error(`${label} must be a string array`);return value as string[];}
function str(value:unknown,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} must be a non-empty string`);return value;}
export async function reproduceIssue(options:{reader:ReproduceReader;provider:AunoForgeProvider;owner:string;repo:string;issueNumber:number}):Promise<ReproductionPlan>{
  const issue=await options.reader.getIssue({owner:options.owner,repo:options.repo,number:options.issueNumber});
  const context=buildAnalysisContext({task:"bug_reproduction",trustedMetadata:{issue:{number:issue.number,title:issue.title,url:issue.url,labels:issue.labels}},untrustedContent:{issueBody:issue.body}});
  const response=await options.provider.generate({...context,outputKind:"reproduction-plan/v1"}); const d=response.data;
  return {schemaVersion:"1",issue:{number:issue.number,title:issue.title,...(issue.url?{url:issue.url}:{})},environment:strings(d.environment,"environment"),steps:strings(d.steps,"steps"),expected:str(d.expected,"expected"),actual:str(d.actual,"actual"),likelyAffectedAreas:strings(d.likelyAffectedAreas,"likelyAffectedAreas"),missingEvidence:strings(d.missingEvidence,"missingEvidence")};
}
export function renderReproduction(plan:ReproductionPlan,format:"json"|"markdown"|"terminal"="terminal"):string{
  if(format==="json")return JSON.stringify(plan,null,2)+"\n";
  if(format==="markdown")return `# Reproduction Plan — Issue #${plan.issue.number}\n\n## Environment\n${plan.environment.map(x=>`- ${x}`).join("\n")}\n\n## Steps\n${plan.steps.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\n## Expected\n${plan.expected}\n\n## Actual\n${plan.actual}\n\n## Likely affected areas\n${plan.likelyAffectedAreas.map(x=>`- ${x}`).join("\n")}\n\n## Missing evidence\n${plan.missingEvidence.map(x=>`- ${x}`).join("\n")}\n`;
  return `Issue #${plan.issue.number}\nSteps: ${plan.steps.length}\nExpected: ${plan.expected}\nActual: ${plan.actual}\n`;
}
