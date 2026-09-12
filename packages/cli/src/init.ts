import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isApprovalToken, type ApprovalToken } from "@aunoforge/core";
import { detectProject } from "./project.js";

async function exists(path:string):Promise<boolean>{try{await access(path);return true;}catch{return false;}}
export type InitResult={created:boolean;skippedExisting:boolean;path:string;preview:string};
export async function initializeAunoForge(root:string,options:{dryRun?:boolean;approvalToken?:ApprovalToken}={}):Promise<InitResult>{
  const path=join(root,".aunoforge","config.yml");
  if(await exists(path))return{created:false,skippedExisting:true,path,preview:""};
  const project=await detectProject(root);
  const config={project:{type:project.type,frameworks:project.frameworks},provider:{default:"mock"},security:{mode:"safe",allowWrite:false,allowMerge:false,allowPublish:false}};
  const preview=JSON.stringify(config,null,2)+"\n";
  if(options.dryRun)return{created:false,skippedExisting:false,path,preview};
  if(!isApprovalToken(options.approvalToken))throw new Error("init write requires explicit human approval");
  await mkdir(join(root,".aunoforge"),{recursive:true});
  await writeFile(path,preview,{encoding:"utf8",flag:"wx"});
  return{created:true,skippedExisting:false,path,preview};
}
