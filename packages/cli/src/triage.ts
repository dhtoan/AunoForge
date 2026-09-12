import type { AunoForgeProvider, Severity, TriageReport } from "@aunoforge/core";
import type { DuplicateCandidate, Issue } from "@aunoforge/github";
import { buildAnalysisContext } from "./context.js";

export type TriageReader = {
  getIssue(ref:{owner:string;repo:string;number:number}):Promise<Issue>;
  findDuplicateCandidates(input:{owner:string;repo:string;query:string}):Promise<DuplicateCandidate[]>;
};
const severities=new Set(["critical","high","medium","low","info"]);
function stringArray(value:unknown,label:string):string[]{if(!Array.isArray(value)||value.some(x=>typeof x!=="string"))throw new Error(`${label} must be a string array`);return value as string[];}
function stringValue(value:unknown,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} must be a non-empty string`);return value;}

export async function triageIssue(options:{reader:TriageReader;provider:AunoForgeProvider;owner:string;repo:string;issueNumber:number}):Promise<TriageReport>{
  const issue=await options.reader.getIssue({owner:options.owner,repo:options.repo,number:options.issueNumber});
  const duplicates=await options.reader.findDuplicateCandidates({owner:options.owner,repo:options.repo,query:issue.title});
  const context=buildAnalysisContext({
    task:"issue_triage",
    trustedMetadata:{issue:{number:issue.number,title:issue.title,url:issue.url,labels:issue.labels,author:issue.author},duplicateCandidates:duplicates},
    untrustedContent:{issueBody:issue.body}
  });
  const response=await options.provider.generate({...context,outputKind:"triage-report/v1"});
  const d=response.data;
  const severity=stringValue(d.severity,"severity"); if(!severities.has(severity))throw new Error("severity must be critical, high, medium, low, or info");
  if(typeof d.confidence!=="number"||d.confidence<0||d.confidence>1)throw new Error("confidence must be between 0 and 1");
  return {
    schemaVersion:"1",
    issue:{number:issue.number,title:issue.title,...(issue.url?{url:issue.url}:{})},
    type:stringValue(d.type,"type"),component:stringValue(d.component,"component"),severity:severity as Severity,confidence:d.confidence,
    suggestedLabels:stringArray(d.suggestedLabels,"suggestedLabels"),duplicateCandidates:duplicates,
    missingInformation:stringArray(d.missingInformation,"missingInformation"),nextAction:stringValue(d.nextAction,"nextAction")
  };
}

export function renderTriage(report:TriageReport,format:"json"|"markdown"|"terminal"="terminal"):string{
  if(format==="json")return JSON.stringify(report,null,2)+"\n";
  if(format==="markdown")return `# Issue #${report.issue.number} Triage\n\nType: **${report.type}**\n\nComponent: **${report.component}**\n\nSeverity: **${report.severity}**\n\nConfidence: ${report.confidence}\n\nSuggested labels: ${report.suggestedLabels.join(", ")||"none"}\n\nMissing information:\n${report.missingInformation.map(x=>`- ${x}`).join("\n")||"- none"}\n\nNext action: ${report.nextAction}\n`;
  return `Issue #${report.issue.number}\nType: ${report.type}\nComponent: ${report.component}\nSeverity: ${report.severity}\nConfidence: ${report.confidence}\nNext: ${report.nextAction}\n`;
}
