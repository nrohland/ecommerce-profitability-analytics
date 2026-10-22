import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hardenHtml} from './harden-static-html.mjs';

test('hashes exact inline bytes and precedes executable scripts',()=>{
 const code='window.data="á\\n";';
 const input=`<!doctype html><html><head><script>${code}</script><script src="/app.js"></script></head><body></body></html>`;
 const output=hardenHtml(input);
 assert.ok(output.includes(`sha256-${createHash('sha256').update(code).digest('base64')}`));
 assert.ok(output.indexOf('build-script-policy')<output.indexOf('<script>'));
 assert.equal((output.match(/sha256-/g)??[]).length,1);
 assert.ok(output.includes("script-src-attr 'none'"));
 assert.ok(!output.includes('unsafe-inline'));
 assert.ok(!output.includes('unsafe-eval'));
 assert.equal(hardenHtml(output),output);
});

test('changing inline content changes the policy',()=>{
 assert.notEqual(hardenHtml('<head><script>a()</script></head>'),hardenHtml('<head><script>b()</script></head>'));
 assert.throws(()=>hardenHtml('<body>No head</body>'),/no head/);
});

 test('HTML parser handles browser-valid closing tags and preserves charset',()=>{
 const html='<head><meta charset="utf-8"><script>boot()</script data-x>'+'</head><body></body>';
 const output=hardenHtml(html);
 assert.ok(output.includes(createHash('sha256').update('boot()').digest('base64')));
 assert.ok(output.indexOf('charset')<output.indexOf('build-script-policy'));
 assert.equal(hardenHtml(output),output);
 });
