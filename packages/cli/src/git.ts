import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec=promisify(execFile);
export async function gitRead(root:string,args:string[]):Promise<string>{const {stdout}=await exec("git",["-C",root,...args],{maxBuffer:20*1024*1024});return stdout;}
export async function getLocalDiff(root:string,base?:string):Promise<string>{return gitRead(root,base?["diff",base,"--"]:["diff","--"]);}
export async function getGitLog(root:string,from?:string):Promise<string>{return gitRead(root,["log",...(from?[`${from}..HEAD`]:[]),"--pretty=format:%H%x09%s%x09%an%x09%aI"]);}
