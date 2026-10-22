import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactMoney} from '../components/format.ts';

test('compact USD does not add ICU-dependent integer decimal zeros',()=>{
 for(const [value,expected] of [[421000,'$421K'],[1250000,'$1.3M'],[-421000,'-$421K'],[0,'$0']]){
  assert.equal(compactMoney.format(value),expected);
 }
});
