// Per-build hashes preserve static delivery without trusting arbitrary inline scripts.
import {createHash} from 'node:crypto';
import {access,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function hardenHtml(input) {
 const clean=input.replace(/<meta name="build-script-policy"[^>]*>/g,'');
 if(!/<head(?:\s[^>]*)?>/i.test(clean)) throw Error('HTML document has no head');
 const hashes=new Set();
 for(const match of clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if(!/\bsrc\s*=/i.test(match[1]) && match[2].trim()) {
   hashes.add(`'sha256-${createHash('sha256').update(match[2],'utf8').digest('base64')}'`);
  }
 }
 const policy=`script-src 'self' ${[...hashes].sort().join(' ')}; script-src-attr 'none'`;
 const meta=`<meta name="build-script-policy" http-equiv="Content-Security-Policy" content="${policy}">`;
 return clean.replace(/<head(?:\s[^>]*)?>/i,match=>match+meta);
}

async function walk(root) {
 const result=[];
 for(const entry of await readdir(root,{withFileTypes:true})) {
  const file=path.join(root,entry.name);
  if(entry.isDirectory()) result.push(...await walk(file));
  else if(entry.name.endsWith('.html')) result.push(file);
 }
 return result;
}

export async function hardenBuild() {
 // A dynamic route needs per-request nonces; do not silently ship it unprotected.
 const manifest=JSON.parse(await readFile('.next/prerender-manifest.json','utf8'));
 if(Object.values(manifest.dynamicRoutes??{}).some(route=>route.fallback!==false)) throw Error('Dynamic fallback requires a reviewed nonce policy');
 const routes=JSON.parse(await readFile('.next/server/app-paths-manifest.json','utf8'));
 for(const route of Object.keys(routes).filter(key=>key.endsWith('/page'))) {
  const source=route.slice(0,-5)||'/';
  const names=source.includes('[')
   ? Object.entries(manifest.routes).filter(([,info])=>info.srcRoute===source).map(([name])=>name)
   : [source];
  if(!names.length) throw Error(`Route ${route} has no prerendered documents`);
  for(const name of names) {
   if(manifest.routes[name]?.initialRevalidateSeconds!==false) throw Error(`Route ${name} is not immutable prerendered HTML`);
   try {await access(path.join('.next/server/app',(name==='/'?'index':name.slice(1))+'.html'));}
   catch {throw Error(`Route ${name} is not prerendered; a nonce policy is required`);}
  }
 }
 const root=process.argv[2]??'out';
 const files=await walk(root);
 if(!files.length) throw Error('No prerendered HTML found');
 for(const file of files) {
  const content=await readFile(file,'utf8');
  await writeFile(file,hardenHtml(content));
 }
 console.log(`Hardened ${files.length} prerendered documents with build-specific script hashes`);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await hardenBuild();
