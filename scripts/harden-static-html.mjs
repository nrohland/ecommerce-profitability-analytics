// Per-build hashes preserve static delivery without trusting arbitrary inline scripts.
import {createHash} from 'node:crypto';
import {access,readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';

function nodes(document) {
 return [document,...(document.childNodes??[]).flatMap(nodes),...(document.content?nodes(document.content):[])];
}
const attribute=(node,name)=>node.attrs?.find(attr=>attr.name===name)?.value;

export function hardenHtml(input) {
 let clean=input;
 const oldPolicies=nodes(parse(clean,{sourceCodeLocationInfo:true}))
  .filter(node=>node.tagName==='meta' && attribute(node,'name')==='build-script-policy')
  .map(node=>node.sourceCodeLocation).filter(Boolean).sort((a,b)=>b.startOffset-a.startOffset);
 for(const loc of oldPolicies) clean=clean.slice(0,loc.startOffset)+clean.slice(loc.endOffset);
 const documentNodes=nodes(parse(clean,{sourceCodeLocationInfo:true}));
 const head=documentNodes.find(node=>node.tagName==='head');
 if(!head?.sourceCodeLocation?.startTag) throw Error('HTML document has no head');
 const hashes=new Set();
 for(const node of documentNodes.filter(node=>node.tagName==='script')) {
  if(attribute(node,'src')===undefined) {
   const loc=node.sourceCodeLocation;
   if(!loc?.startTag || !loc.endTag) throw Error('Unclosed build script');
   const code=clean.slice(loc.startTag.endOffset,loc.endTag.startOffset);
   if(code.trim()) hashes.add(`'sha256-${createHash('sha256').update(code,'utf8').digest('base64')}'`);
  }
 }
 const policy=`script-src 'self' ${[...hashes].sort().join(' ')}; script-src-attr 'none'`;
 const meta=`<meta name="build-script-policy" http-equiv="Content-Security-Policy" content="${policy}">`;
 const charset=head.childNodes.find(node=>node.tagName==='meta' && attribute(node,'charset')!==undefined);
 const offset=charset?.sourceCodeLocation?.endOffset??head.sourceCodeLocation.startTag.endOffset;
 if(documentNodes.some(node=>node.tagName==='script' && node.sourceCodeLocation?.startOffset<offset)) throw Error('Script precedes the build policy');
 return clean.slice(0,offset)+meta+clean.slice(offset);
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
 const root=process.argv[2]??'out';
 for(const route of Object.keys(routes).filter(key=>key.endsWith('/page'))) {
  const source=route.slice(0,-5)||'/';
  if(['/_global-error','/_not-found'].includes(source)) continue;
  const names=source.includes('[')
   ? Object.entries(manifest.routes).filter(([,info])=>info.srcRoute===source).map(([name])=>name)
   : [source];
  if(!names.length) throw Error(`Route ${route} has no prerendered documents`);
  for(const name of names) {
   if(manifest.routes[name]?.initialRevalidateSeconds!==false) throw Error(`Route ${name} is not immutable prerendered HTML`);
   const candidates=name==='/'?['index.html']:[name.slice(1)+'.html',path.join(name.slice(1),'index.html')];
   const present=await Promise.all(candidates.map(async file=>{try {await access(path.join(root,file));return true;}catch{return false;}}));
   if(!present.some(Boolean)) throw Error(`Route ${name} has no exported HTML; a nonce policy is required`);
  }
 }
 const files=await walk(root);
 if(!files.length) throw Error('No prerendered HTML found');
 for(const file of files) {
  const content=await readFile(file,'utf8');
  await writeFile(file,hardenHtml(content));
 }
 console.log(`Hardened ${files.length} prerendered documents with build-specific script hashes`);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await hardenBuild();
