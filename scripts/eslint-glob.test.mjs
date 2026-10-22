import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const pluginRequire=createRequire(require.resolve('@next/eslint-plugin-next'));
const {getRootDirs}=pluginRequire('./utils/get-root-dirs');

test('Next lint root-directory glob contract is preserved without braces',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'lint-roots-'));
 try {
  for(const name of ['one','two']) mkdirSync(path.join(root,name));
  writeFileSync(path.join(root,'not-a-directory.txt'),'fixture');
  assert.deepEqual(getRootDirs({cwd:root,settings:{}}),[root]);
  const glob=root.replaceAll('\\','/')+'/*';
  assert.deepEqual(getRootDirs({cwd:root,settings:{next:{rootDir:glob}}}).sort(),['one','two'].map(x=>path.join(root,x).replaceAll('\\','/')));
  const globList=['one','two'].map(x=>root.replaceAll('\\','/')+'/'+x);
  assert.deepEqual(getRootDirs({cwd:root,settings:{next:{rootDir:globList}}}).sort(),globList);
  assert.deepEqual(getRootDirs({cwd:root,settings:{next:{rootDir:root.replaceAll('\\','/')+'/{one,two}'}}}).sort(),globList);
 } finally {rmSync(root,{recursive:true,force:true});}
});
