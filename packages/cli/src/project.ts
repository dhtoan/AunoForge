import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type ProjectType = "wordpress-plugin" | "node" | "python" | "php-composer" | "monorepo" | "generic";
export type ProjectDetection = { type: ProjectType; frameworks: string[] };
async function exists(path:string):Promise<boolean>{try{await access(path);return true;}catch{return false;}}
async function json(path:string):Promise<any|undefined>{try{return JSON.parse(await readFile(path,"utf8"));}catch{return undefined;}}

export async function detectProject(root:string):Promise<ProjectDetection>{
  const packageJson=await json(join(root,"package.json"));
  if(await exists(join(root,"pnpm-workspace.yaml"))||await exists(join(root,"lerna.json"))||Array.isArray(packageJson?.workspaces)) return {type:"monorepo",frameworks:[]};
  const files=await readdir(root).catch(()=>[]);
  const phpFiles=files.filter((x)=>x.endsWith(".php"));
  for(const file of phpFiles){const source=await readFile(join(root,file),"utf8").catch(()=>"");if(/Plugin Name\s*:/i.test(source)){const frameworks=["WordPress"];if(/WooCommerce|WC_/i.test(source))frameworks.push("WooCommerce");return{type:"wordpress-plugin",frameworks};}}
  if(packageJson) return {type:"node",frameworks:[]};
  if(await exists(join(root,"pyproject.toml"))||await exists(join(root,"requirements.txt"))||await exists(join(root,"setup.py"))) return {type:"python",frameworks:[]};
  if(await exists(join(root,"composer.json"))) return {type:"php-composer",frameworks:[]};
  return {type:"generic",frameworks:[]};
}
