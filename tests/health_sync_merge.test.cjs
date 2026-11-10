const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const window = {};
const context = vm.createContext({window, TextEncoder, TextDecoder});
for (const file of ['crypto.js', 'journal-state.js', 'sync-merge.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../health', file), 'utf8'), context);
}
const {plan} = window.HumanSyncMerge;
const empty = () => ({
  id:'synthetic-vault', schema:1, profile:{name:'Synthetic'},
  ...Object.fromEntries([...Object.keys(window.HumanJournal.collections), 'revisions', 'timeline'].map(key => [key, []])),
});
const normalized = value => JSON.parse(JSON.stringify(value));

test('independent changes, deletion and binary attachment union retain both histories', () => {
  const base = empty();
  base.observations = [{id:'edit',value:'original'}, {id:'delete',value:'original'}];
  base.documents = [{id:'keep',objectId:'a'.repeat(64),size:3}];
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.observations[0].value = 'edited';
  local.documents.push({id:'left-file',objectId:'b'.repeat(64),size:3});
  local.revisions.push({id:'left',changedAt:'2026-11-10T10:00:00Z'});
  remote.observations.pop();
  remote.documents.push({id:'right-file',objectId:'c'.repeat(64),size:3});
  remote.revisions.push({id:'right',changedAt:'2026-11-10T09:00:00Z'});
  remote.timeline.push({id:'delete-event'});
  const {doc, conflicts} = plan(base, local, remote);
  assert.equal(conflicts.length, 0);
  assert.deepEqual(normalized(doc.observations), [{id:'edit',value:'edited'}]);
  assert.deepEqual(normalized(doc.documents.map(x => x.objectId)), ['a','b','c'].map(value=>value.repeat(64)));
  assert.deepEqual(normalized(doc.revisions.map(x => x.id)), ['right','left']);
  assert.equal(doc.timeline[0].id, 'delete-event');
  assert.equal(base.observations[0].value, 'original');
});

test('edit versus deletion and conflicting encrypted objects require a choice per item', () => {
  const base = empty();
  base.observations = [{id:'row',value:'old'}];
  base.documents = [{id:'file',objectId:'a'.repeat(64),size:1}];
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.observations = [];
  remote.observations[0].value = 'corrected';
  local.documents[0].objectId = 'b'.repeat(64);
  remote.documents[0].objectId = 'c'.repeat(64);
  const pending = plan(base, local, remote, ['local']);
  assert.equal(pending.doc, null);
  assert.deepEqual(normalized(pending.conflicts.map(x => x.collection)), ['observations','documents']);
  assert.equal(pending.conflicts[0].local, undefined);
  const {doc} = plan(base, local, remote, ['local','remote']);
  assert.equal(doc.observations.length, 0);
  assert.equal(doc.documents[0].objectId, 'c'.repeat(64));
});

test('a split questionnaire history keeps both versions and explicitly selects the current answers', () => {
  const base = empty();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.recommendationIntakes = [{id:'left',version:1,answers:{smoking:'left'}}];
  remote.recommendationIntakes = [{id:'right',version:1,answers:{smoking:'right'}}];
  assert.equal(plan(base, local, remote).conflicts[0].collection, 'currentQuestionnaire');
  const {doc} = plan(base, local, remote, ['local']);
  assert.deepEqual(normalized(doc.recommendationIntakes.map(x => x.id)), ['right','left']);
});

test('independent analyte settings and identical edits do not create conflicts', () => {
  const base = empty();
  const local = {...empty(),profile:{timezone:'UTC',name:'Synthetic'},analytePreferences:{one:{favorite:true}}};
  const remote = {...empty(),profile:{name:'Synthetic',timezone:'UTC'},analytePreferences:{two:{favorite:true}}};
  const {doc, conflicts} = plan(base, local, remote);
  assert.equal(conflicts.length, 0);
  assert.deepEqual(normalized(doc.analytePreferences), {one:{favorite:true},two:{favorite:true}});
  assert.throws(() => plan(base, local, {...remote,id:'unrelated'}));
});
