/* Optional local and mandatory CI compatibility test for public MPXJ .mpp samples.
 * Fixtures are downloaded by CI from a pinned, LGPL-licensed GitHub commit.
 * No customer documents are stored in this repository or uploaded anywhere.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {readProject} from '../mpp/vendor/mpxj-ts/mpxj.mjs';
import {normalizeProject} from '../mpp/model.mjs';

const dir=process.env.MPP_FIXTURES_DIR;
const samples=[
  ['mpp8recurring.mpp','legacy Project 98'],
  ['mpp9relations.mpp','Project 2000/2002 links'],
  ['mpp14resource.mpp','Project 2010+ resources']
];
for(const [filename,label] of samples){
  const file=dir?path.join(dir,filename):'';
  if(!file||!existsSync(file)){
    test('binary MPP '+label,{skip:'Set MPP_FIXTURES_DIR to the folder containing public MPXJ samples'},()=>{});
    continue;
  }
  test('read real binary MPP: '+label,()=>{
    const bytes=new Uint8Array(readFileSync(file));
    assert.equal(bytes[0],0xD0,'OLE2 file signature');
    assert.equal(bytes[1],0xCF,'OLE2 file signature');
    const project=readProject(bytes);
    const model=normalizeProject(project,filename);
    assert.ok(model.tasks.length>0,'parsed tasks must be non-empty');
    assert.ok(model.tasks.some(t=>t.start!==null||t.finish!==null),'tasks need real dates');
    if(filename==='mpp9relations.mpp')assert.ok(model.links.length>0,'expected dependencies');
    if(filename==='mpp14resource.mpp')assert.ok(model.resources.length>0,'expected resources');
  });
}
