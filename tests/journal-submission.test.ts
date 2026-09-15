import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmsRow,submissionMode} from '../src/lib/journal-submission';
test('shared saves use AUTO and respect the editable permission',()=>{
  const rows=[{editable:true,canConfirm:true},{editable:true,canConfirm:false},{editable:false,canConfirm:false}];
  assert.equal(submissionMode(rows),'AUTO');
  assert.equal(confirmsRow('AUTO',true),true);
  assert.equal(confirmsRow('AUTO',false),false);
  assert.equal(submissionMode([rows[0],rows[2]]),'AUTO');
  assert.equal(submissionMode([rows[1],rows[2]]),'AUTO');
});
