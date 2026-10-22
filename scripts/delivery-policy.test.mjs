import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {hardenBuild} from './harden-static-html.mjs';

test('protects both static-server and Vercel Next output; rejects dynamic fallback',async()=>{
 const before=process.cwd(), args=[...process.argv];
 const root=await mkdtemp(path.join(tmpdir(),'csp-delivery-'));
 try {
  await mkdir(path.join(root,'.next/server/app'),{recursive:true});
  await mkdir(path.join(root,'out'));
  const manifest={routes:{'/':{initialRevalidateSeconds:false}},dynamicRoutes:{}};
  await writeFile(path.join(root,'.next/prerender-manifest.json'),JSON.stringify(manifest));
  await writeFile(path.join(root,'.next/server/app-paths-manifest.json'),JSON.stringify({'/page':'app/page.js'}));
  const html='<html><head><script>boot()</script></head><body>fixture</body></html>';
  for(const file of ['out/index.html','.next/server/app/index.html'])await writeFile(path.join(root,file),html);
  process.chdir(root);process.argv.length=2;
  await hardenBuild();
  for(const file of ['out/index.html','.next/server/app/index.html']) assert.ok((await readFile(file,'utf8')).includes('build-script-policy'));
  manifest.dynamicRoutes['/private/[id]']={fallback:null};
  await writeFile('.next/prerender-manifest.json',JSON.stringify(manifest));
  await assert.rejects(hardenBuild(),/nonce/);
 } finally {process.chdir(before);process.argv.splice(0,process.argv.length,...args);await rm(root,{recursive:true,force:true});}
});
