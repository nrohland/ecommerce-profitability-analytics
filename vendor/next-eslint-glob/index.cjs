// Narrow adapter for @next/eslint-plugin-next's sole fast-glob call.
// Keep fast-glob's absolute-pattern and unmarked-directory semantics.
const path=require('node:path');
const {globSync:tinyGlobSync}=require('tinyglobby');
exports.globSync=(pattern,options={})=>{
 if(typeof pattern!=='string' || options.onlyDirectories!==true || Object.keys(options).some(key=>key!=='onlyDirectories')) {
  throw new Error('Next lint glob contract changed; review the security adapter');
 }
 return tinyGlobSync(pattern,{onlyDirectories:true,absolute:path.isAbsolute(pattern),markDirectories:false})
  .map(result=>result.endsWith('/')?result.slice(0,-1):result);
};
