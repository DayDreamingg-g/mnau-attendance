import test from 'node:test';
import assert from 'node:assert/strict';
import {journalStateFromCounts,journalStateForRoster,journalStateLabel} from '../src/lib/journal-state';
test('a shared lesson is confirmed only after the entire expected roster is confirmed',()=>{
  assert.equal(journalStateFromCounts(30,0,0),'EMPTY');
  assert.equal(journalStateFromCounts(30,15,15),'DRAFT');
  assert.equal(journalStateFromCounts(30,30,15),'DRAFT');
  assert.equal(journalStateFromCounts(30,30,30),'CONFIRMED');
  assert.equal(journalStateFromCounts(30,29,29),'DRAFT');
  assert.equal(journalStateFromCounts(0,0,0),'EMPTY');
});
test('scoped lesson cards derive the visible group segment independently',()=>{
  assert.equal(journalStateForRoster(2,[{confirmed:true},{confirmed:true}]),'CONFIRMED');
  assert.equal(journalStateForRoster(2,[{confirmed:true}]),'DRAFT');
  assert.equal(journalStateForRoster(2,[{confirmed:false},{confirmed:true}]),'DRAFT');
  assert.match(journalStateLabel('DRAFT'),/Частково/);
});
