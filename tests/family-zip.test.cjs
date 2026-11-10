/* ZIP restore validation: browser STORE and Python DEFLATE, only fictional data. */
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readArchive}=require('../family-app/src/lib/browserZipImport.ts');
const ID='0123456789abcdef0123456789abcdef';
function document(hasMedia=true){
  return {
    schema_version:1,
    tree:{id:'abcdefabcdefabcdefabcdefabcdefab',slug:'sample-family',name:'Семья Пример',description:'',revision:1,updated_at:'2026-11-10T00:00:00Z'},
    persons:[{id:ID,given_name:'Анна',surname:'Примерова',revision:1,
      ...(hasMedia?{_photo:{filename:'portrait.png',mime_type:'image/png'},
        _gallery:[{id:'m1',filename:'record.pdf',mime_type:'application/pdf'}]}:{})}],
    families:[],metadata:{_unmodeled:['preserved',42]}
  };
}
const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489','hex');
const pdf=Buffer.from('%PDF-1.4\n%%EOF','utf8');
function archive(entries,method='ZIP_DEFLATED') {
  const py=[
    'import zipfile,base64,sys,json,io',
    'items=json.loads(sys.stdin.read())',
    'output=io.BytesIO()',
    'with zipfile.ZipFile(output,"w",compression=zipfile.'+method+') as z:',
    '  for name,value in items.items():',
    '    z.writestr(name,base64.b64decode(value))',
    'sys.stdout.buffer.write(output.getvalue())'
  ].join('\n');
  const payload=Object.fromEntries(Object.entries(entries).map(([k,v])=>[k,Buffer.from(v).toString('base64')]));
  const call=spawnSync('python3',['-c',py],{input:JSON.stringify(payload),encoding:null,maxBuffer:8*1024*1024});
  if(call.status!==0)throw new Error(String(call.stderr));
  return new Blob([call.stdout]);
}
function pack(doc=document(),extra={}){
  return archive({
    'tree.json':JSON.stringify(doc),
    'tree.ged':'0 HEAD\n1 SOUR GEN\n0 TRLR\n',
    'original.ged':'0 HEAD\r\n1 SOUR TEST\r\n0 TRLR\r\n',
    'media/portrait.png':png,
    'media/record.pdf':pdf,
    ...extra
  });
}
test('Python ZIP_DEFLATED preserves persons, media and original GEDCOM',async()=>{
  const parsed=await readArchive(pack());
  assert.equal(parsed.document.persons.length,1);
  assert.equal(parsed.document.metadata._unmodeled[0],'preserved');
  assert.equal(parsed.files.length,3);
  for(const [filename,original] of [['portrait.png',png],['record.pdf',pdf],['original.ged',Buffer.from('0 HEAD\r\n1 SOUR TEST\r\n0 TRLR\r\n')]]){
    const item=parsed.files.find(x=>x.filename===filename);
    assert.deepEqual(Buffer.from(await item.blob.arrayBuffer()),original);
  }
});
test('browser ZIP_STORED imports without dependencies',async()=>{
  const result=await readArchive(archive({'tree.json':JSON.stringify(document()),'media/portrait.png':png,'media/record.pdf':pdf},'ZIP_STORED'));
  assert.equal(result.files.length,2);
});
test('tree-only archive allowed',async()=>{
  const result=await readArchive(archive({'tree.json':JSON.stringify(document(false))}));
  assert.equal(result.files.length,0);
});
test('missing referenced media is blocked before writing IndexedDB',async()=>{
  const bad=archive({'tree.json':JSON.stringify(document()),'media/portrait.png':png});
  await assert.rejects(readArchive(bad),/отсутствует файл media\/record.pdf/);
});
test('ZIP traversal paths are rejected even if extra entry is ignored',async()=>{
  await assert.rejects(readArchive(pack(document(false),{'../evil.txt':'bad'})),/Небезопасный путь/);
});
test('data cannot reference traversal media filename',async()=>{
  const data=document();
  data.persons[0]._photo.filename='../outside.png';
  await assert.rejects(readArchive(pack(data)),/Некорректная ссылка/);
});
test('checksum or payload corruption is rejected',async()=>{
  const b=new Uint8Array(await archive({'tree.json':JSON.stringify(document(false))},'ZIP_STORED').arrayBuffer());
  const start=b.indexOf(0x7b,b.indexOf(0x04034b50)+30);
  b[start+12]^=0x10;
  await assert.rejects(readArchive(new Blob([b])),/CRC32|повреждён|JSON/);
});
test('malformed relationships rejected',async()=>{
  const d=document(false);
  d.families=[{id:'b'.repeat(32),partner1_id:'unknown',partner2_id:null,children:[]}];
  await assert.rejects(readArchive(archive({'tree.json':JSON.stringify(d)})),/неизвестного человека/);
});
test('non-ZIP data rejected',async()=>{
  await assert.rejects(readArchive(new Blob([Buffer.from('not a zip')])),/Не найден конец/);
});
