import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isApprovalToken, type ApprovalToken } from "@aunoforge/core";

async function exists(path:string):Promise<boolean>{try{await access(path);return true;}catch{return false;}}
export type InitResult={created:boolean;skippedExisting:boolean;path:string;preview:string};
export async function initializeAunoForge(root:string,options:{dryRun?:boolean;approvalToken?:ApprovalToken}={}):Promise<InitResult>{
  const path=join(root,".aunoforge","config.json");
  if(await exists(path))return{created:false,skippedExisting:true,path,preview:""};
  const config={schemaVersion:1 as const,extends:"recommended" as const};
  const preview=JSON.stringify(config,null,2)+"\n";
  if(options.dryRun)return{created:false,skippedExisting:false,path,preview};
  if(!isApprovalToken(options.approvalToken))throw new Error("init write requires explicit human approval");
  await mkdir(join(root,".aunoforge"),{recursive:true});
  await writeFile(path,preview,{encoding:"utf8",flag:"wx"});
  return{created:true,skippedExisting:false,path,preview};
}
