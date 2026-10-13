import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../experimental/six-encounters/app.js',import.meta.url),'utf8');
const closeReading=app.slice(app.indexOf('  function closeReading()'),app.indexOf("  document.querySelector('#reading').onclick"));
test('Reading return records a pending study mount but preserves completed trials',()=>{
  for(const pending of [true,false]){
    const records=[];
    const context={readingBack:{screen:'study',study:'memory'},study:null,studyTrialPending:pending,showStudy:record=>records.push(record)};
    vm.runInNewContext(closeReading+';closeReading();',context);
    assert.deepEqual(records,[pending]);
  }
});
