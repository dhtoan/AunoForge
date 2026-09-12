import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

async function markdownFiles(dir) {
  const files=[];
  for (const entry of await readdir(dir,{withFileTypes:true}).catch(()=>[])) {
    const path=join(dir,entry.name);
    if(entry.isDirectory()) files.push(...await markdownFiles(path));
    else if(extname(entry.name)==='.md') files.push(path);
  }
  return files;
}

function relativeTargets(markdown) {
  const targets=[];
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw=match[1].trim();
    if(!raw || raw.startsWith('#') || /^(?:https?:|mailto:)/i.test(raw)) continue;
    targets.push(raw.split('#')[0].split('?')[0]);
  }
  return targets;
}

test('README presents first success and all relative markdown links resolve', async()=>{
  const readme=await readFile('README.md','utf8');
  assert.match(readme,/AunoForge — AI-assisted maintenance you can verify\./);
  assert.match(readme,/npx aunoforge doctor/);
  assert.match(readme,/npx aunoforge review/);
  const files=['README.md',...(await markdownFiles('docs')),'CONTRIBUTING.md','SECURITY.md','ROADMAP.md','OSS-EVIDENCE.md'];
  for(const file of files){
    const body=await readFile(file,'utf8');
    for(const target of relativeTargets(body)){
      const path=resolve(dirname(file),target);
      await assert.doesNotReject(()=>access(path),`${file} links to missing ${target}`);
    }
  }
});
