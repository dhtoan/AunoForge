import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { detectProject } from "./project.js";
export type DoctorCheck={id:string;label:string;pass:boolean;points:number;detail:string};
export type DoctorReport={score:number;projectType:string;checks:DoctorCheck[]};
async function exists(path:string):Promise<boolean>{try{await access(path);return true;}catch{return false;}}
async function hasWorkflow(root:string):Promise<boolean>{const dir=join(root,".github","workflows");try{return (await readdir(dir)).some(x=>/\.ya?ml$/i.test(x));}catch{return false;}}
async function packageInfo(root:string):Promise<any>{try{return JSON.parse(await readFile(join(root,"package.json"),"utf8"));}catch{return undefined;}}
export async function runDoctor(root:string):Promise<DoctorReport>{
  const project=await detectProject(root);const pkg=await packageInfo(root);
  const checks:DoctorCheck[]=[
    {id:"license",label:"License",pass:await exists(join(root,"LICENSE")),points:12,detail:"LICENSE file"},
    {id:"contributing",label:"Contributing guide",pass:await exists(join(root,"CONTRIBUTING.md")),points:10,detail:"CONTRIBUTING.md"},
    {id:"security",label:"Security policy",pass:await exists(join(root,"SECURITY.md")),points:12,detail:"SECURITY.md"},
    {id:"code-of-conduct",label:"Code of conduct",pass:await exists(join(root,"CODE_OF_CONDUCT.md")),points:8,detail:"CODE_OF_CONDUCT.md"},
    {id:"tests",label:"Tests",pass:Boolean(pkg?.scripts?.test)||await exists(join(root,"pytest.ini"))||await exists(join(root,"phpunit.xml")),points:14,detail:"test command/config"},
    {id:"ci",label:"Continuous integration",pass:await hasWorkflow(root),points:14,detail:".github/workflows"},
    {id:"dependency-updates",label:"Dependency updates",pass:await exists(join(root,".github","dependabot.yml"))||await exists(join(root,"renovate.json")),points:8,detail:"Dependabot/Renovate"},
    {id:"codeowners",label:"CODEOWNERS",pass:await exists(join(root,"CODEOWNERS"))||await exists(join(root,".github","CODEOWNERS")),points:10,detail:"CODEOWNERS"},
    {id:"compatibility",label:"Compatibility declaration",pass:Boolean(pkg?.engines?.node)||project.type==="wordpress-plugin"||project.type==="python",points:12,detail:"runtime compatibility"}
  ];
  return{score:checks.filter(x=>x.pass).reduce((n,x)=>n+x.points,0),projectType:project.type,checks};
}
