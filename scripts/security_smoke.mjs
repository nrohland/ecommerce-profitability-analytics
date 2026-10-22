// Production builds, real browser hydration and deterministic demo interactions.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const config=JSON.parse(process.argv[2]);
const directory=path.resolve(config.directory);
const require=createRequire(path.join(directory,'package.json'));
const {chromium}=require('@playwright/test');
const port=4175,base=`http://127.0.0.1:${port}`;
const output=path.resolve(process.env.EVIDENCE_DIR??'security-ui-evidence');
await mkdir(output,{recursive:true});
const server=config.static
 ? spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory','out'],{cwd:directory,stdio:'ignore'})
 : spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port',String(port),'--hostname','127.0.0.1'],{cwd:directory,stdio:'ignore'});
let browser;
try {
 for(let i=0;i<40;i++){
  if(server.exitCode!==null)throw Error('Production server exited');
  try {if((await fetch(base)).ok)break;}catch{}
  if(i===39)throw Error('Production server did not become ready');
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const route of config.routes){
   const response=await page.goto(base+route,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,route);
   assert.ok((await page.locator('body').innerText()).trim().length>120,'Missing page content');
   if(config.kind==='lendflow'&&route==='/ask'){
    await page.getByLabel('Question',{exact:true}).fill('Where do applicants drop off most?');
    await page.getByRole('button',{name:'Ask',exact:true}).click();
    await page.locator('[data-status="answered"]').waitFor({state:'visible'});
   }
   if(config.kind==='ecommerce'){
    await page.getByRole('button',{name:'Ask Northstar'}).click();
    assert.equal(await page.getByRole('complementary',{name:'Northstar AI analyst'}).getAttribute('aria-hidden'),'false');
    await page.getByRole('button',{name:'Close AI analyst',exact:true}).click();
   }
   assert.deepEqual(errors,[],'Browser runtime errors');
   const name=(route==='/'?'home':route.replaceAll('/','-'))+'-'+viewport.width;
   await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  }
  await page.close();
 }
 await writeFile(path.join(output,'result.json'),JSON.stringify({status:'pass',routes:config.routes,viewports:2})+'\n');
 console.log(JSON.stringify({status:'pass',routes:config.routes.length,viewports:2}));
}finally{
 await browser?.close();server.kill('SIGTERM');
}
