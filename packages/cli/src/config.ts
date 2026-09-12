import { readFile } from "node:fs/promises";
import { join } from "node:path";
export type AunoForgeConfig={project:{type:string;frameworks:string[]};provider:{default:string};security:{mode:"safe"|"ask"|"trusted";allowWrite:boolean;allowMerge:boolean;allowPublish:boolean};};
export async function loadConfig(root:string):Promise<AunoForgeConfig|undefined>{try{return JSON.parse(await readFile(join(root,".aunoforge","config.yml"),"utf8")) as AunoForgeConfig;}catch{return undefined;}}
