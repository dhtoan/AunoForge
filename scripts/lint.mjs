import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots=['packages','scripts','test'];
const extensions=new Set(['.ts','.mjs']);
const failures=[];
async function walk(dir){
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}
  for(const entry of entries){
    if(entry.name==='dist'||entry.name==='node_modules')continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory())await walk(path);
    else if(extensions.has(extname(entry.name))){
      const lines=(await readFile(path,'utf8')).split(/\r?\n/);
      for(let i=0;i<lines.length;i+=1){
        if(/[ \t]+$/.test(lines[i]??''))failures.push(`${path}:${i+1}: trailing whitespace`);
        if((lines[i]??'').includes('\t'))failures.push(`${path}:${i+1}: tab character`);
      }
    }
  }
}
for(const root of roots)await walk(root);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('AunoForge lint: clean');
