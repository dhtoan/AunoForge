import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createApprovalToken, type AunoForgeProvider } from "@aunoforge/core";
import { GitHubReader } from "@aunoforge/github";
import { MockProvider } from "@aunoforge/provider-mock";
import { CodexProvider } from "@aunoforge/provider-codex";
import { ClaudeProvider } from "@aunoforge/provider-claude";
import { initializeAunoForge } from "./init.js";
import { runDoctor } from "./doctor.js";
import { triageIssue, renderTriage } from "./triage.js";
import { reproduceIssue, renderReproduction } from "./reproduce.js";
import { review, renderReview } from "./review.js";
import { generateReleaseNotes } from "./release.js";
import { listRecipes, resolveRecipePath, testRecipePath, validateRecipePath } from "./recipe-commands.js";
import { AuditLogger } from "@aunoforge/core";
import { loadIssueFixtureReader } from "./fixture-github.js";

export const commands=["init","doctor","triage","reproduce","review","release","recipes","recipe"] as const;
function argValue(args:string[],name:string):string|undefined{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
function formatValue(args:string[]):"terminal"|"markdown"|"json"{const value=argValue(args,"--format")??"terminal";if(value!=="terminal"&&value!=="markdown"&&value!=="json")throw new Error("--format must be terminal, markdown, or json");return value;}
function reviewFormatValue(args:string[]):"terminal"|"markdown"|"json"|"sarif"{const value=argValue(args,"--format")??"terminal";if(value!=="terminal"&&value!=="markdown"&&value!=="json"&&value!=="sarif")throw new Error("--format must be terminal, markdown, json, or sarif");return value;}
function required(args:string[],name:string):string{const value=argValue(args,name);if(!value)throw new Error(`${name} is required`);return value;}
function providerFromArgs(args:string[]):AunoForgeProvider{
  const id=argValue(args,"--provider")??"mock";
  if(id==="mock")return new MockProvider();
  const model=argValue(args,"--model")??process.env.AUNOFORGE_MODEL;
  if(!model)throw new Error("--model or AUNOFORGE_MODEL is required for live providers");
  if(id==="codex"){const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)throw new Error("OPENAI_API_KEY is required for Codex provider");return new CodexProvider({apiKey,model});}
  if(id==="claude"){const apiKey=process.env.ANTHROPIC_API_KEY;if(!apiKey)throw new Error("ANTHROPIC_API_KEY is required for Claude provider");return new ClaudeProvider({apiKey,model});}
  throw new Error(`Unknown provider: ${id}`);
}
function githubFromEnv():GitHubReader{return new GitHubReader({token:process.env.GITHUB_TOKEN});}

export async function runCli(argv=process.argv.slice(2)):Promise<number>{
  const [command,...args]=argv;
  if(!command||command==="--help"||command==="-h"){console.log(`AunoForge — AI-assisted maintenance you can verify.\n\nCommands:\n${commands.map(c=>`  ${c}`).join("\n")}`);return 0;}
  const root=resolve(argValue(args,"--root")??".");
  if(command==="init"){
    const dryRun=args.includes("--dry-run");
    const result=await initializeAunoForge(root,{dryRun,...(!dryRun?{approvalToken:createApprovalToken("interactive")}: {})});
    console.log(result.skippedExisting?`Config already exists: ${result.path}`:dryRun?result.preview:`Created ${result.path}`);return 0;
  }
  if(command==="doctor"){console.log(JSON.stringify(await runDoctor(root),null,2));return 0;}
  if(command==="triage"||command==="reproduce"){
    const issueNumber=Number(args.find(x=>/^\d+$/.test(x))); if(!Number.isInteger(issueNumber)||issueNumber<1)throw new Error(`${command} requires an issue number`);
    const owner=required(args,"--owner"), repo=required(args,"--repo"), provider=providerFromArgs(args), format=formatValue(args);
    const fixture=argValue(args,"--fixture");
    const reader=fixture?await loadIssueFixtureReader(resolve(fixture)):githubFromEnv();
    if(command==="triage")console.log(renderTriage(await triageIssue({reader,provider,owner,repo,issueNumber}),format).trimEnd());
    else console.log(renderReproduction(await reproduceIssue({reader,provider,owner,repo,issueNumber}),format).trimEnd());
    return 0;
  }
  if(command==="review"){
    const provider=providerFromArgs(args), format=reviewFormatValue(args), prValue=argValue(args,"--pr"), audit=new AuditLogger(resolve(root,".aunoforge","audit.log"));
    const diffPath=argValue(args,"--diff");
    const suppliedDiff=diffPath?await readFile(resolve(diffPath),"utf8"):undefined;
    if(prValue&&suppliedDiff!==undefined)throw new Error("--pr and --diff cannot be used together");
    const report=prValue
      ? await review({root,provider,github:{reader:githubFromEnv(),owner:required(args,"--owner"),repo:required(args,"--repo"),prNumber:Number(prValue)},runTests:args.includes("--run-tests"),audit})
      : await review({root,provider,base:argValue(args,"--base"),...(suppliedDiff!==undefined?{diff:suppliedDiff}:{}),runTests:args.includes("--run-tests"),audit});
    console.log(renderReview(report,format).trimEnd());return 0;
  }
  if(command==="release"){
    const from=argValue(args,"--from");
    const owner=argValue(args,"--owner"), repo=argValue(args,"--repo"), since=argValue(args,"--since");
    const github=owner&&repo&&since?{reader:githubFromEnv(),owner,repo,since}:undefined;
    const result=await generateReleaseNotes({root,...(from?{from}:{}),...(github?{github}:{})});
    console.log(result.markdown.trimEnd());return 0;
  }
  if(command==="recipes"){
    if(args[0]!=="list")throw new Error("recipes supports only: list");
    for(const id of await listRecipes(root))console.log(id);
    return 0;
  }
  if(command==="recipe"){
    const subcommand=args[0], value=args[1];
    if(!value||(subcommand!=="validate"&&subcommand!=="test"))throw new Error("recipe requires: validate <path> or test <path>");
    const path=resolveRecipePath(root,value);
    const result=subcommand==="validate"?await validateRecipePath(path,{mode:"safe"}):await testRecipePath(path,{mode:"safe"});
    console.log(JSON.stringify(result,null,2));return result.valid?0:1;
  }
  if(commands.includes(command as any)){console.error(`${command} is not available in this implementation checkpoint yet.`);return 2;}
  console.error(`Unknown command: ${command}`);return 2;
}
