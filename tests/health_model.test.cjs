// Pure Node tests; no GitHub Actions required to run locally.
// Usage: node --test tests/health_model.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const script=name=>fs.readFileSync(path.join(root,name),'utf8');
function model(){
  const w={},ctx={window:w,crypto:{randomUUID:()=>String(Math.random()).slice(2)}};
  for(const file of ['analyte-catalog','analytes','model','health-state'])
    vm.runInNewContext(script('health/'+file+'.js'),ctx);
  return Object.assign(w.HumanModel,{health:w.HumanHealth,analytes:w.HumanAnalytes});
}
test('all static HUMAN scripts parse',()=>{
  for(const path of ['health/crypto.js','health/store.js','health/github.js',
    'health/analyte-catalog.js','health/analytes.js','health/model.js','health/view.js',
    'health/analyte-view.js','health/app.js','src/health-route.js']){
    assert.doesNotThrow(()=>new vm.Script(script(path)),path);
  }
});
test('measurements group only when type, unit, specimen and method match',()=>{
  const m=model();
  const base={name:'Глюкоза',date:'2026-11-01',value:'5,3',unit:'ммоль/л',
    low:'3,9',high:'5,5',material:'Кровь',method:'А'};
  const a=m.checkLab(base);
  const b=m.checkLab({...base,name:'глюкоза',date:'2026-10-01'});
  const c=m.checkLab({...base,material:'Моча'});
  const d=m.checkLab({...base,unit:'мг/дл'});
  assert.equal(m.groups([a,b,c,d]).length,3);
  assert.equal(m.groups([a,b])[0].rows.length,2);
});

test('catalogue identifies method-qualified values and retains percent/absolute separation',()=>{
  const M=model(),A=M.analytes;
  const raw={date:'2026-11-11',value:'2',unit:'ммоль/л'};
  const direct=M.checkLab({...raw,name:'Холестерин ЛПНП прямой'});
  const calculated=M.checkLab({...raw,name:'Холестерин ЛПНП по Фридвальду'});
  assert.equal(A.classify(direct).id,'ldl-cholesterol');
  assert.equal(A.classify(direct).technique,'direct');
  assert.equal(A.classify(calculated).technique,'friedewald');
  assert.notEqual(M.groupKey(direct),M.groupKey(calculated));
  assert.equal(A.classify({name:'basophils %',unit:'%'}).id,'basophils-percent');
  assert.equal(A.classify({name:'basophils %',unit:'г/л'}).basis,'source');
  assert.notEqual(A.classify({name:'Моча: Глюкоза'}).id,A.classify({name:'Глюкоза'}).id);
  assert.equal(A.normalize('Ca²⁺'),'ca2+');
});

test('unit history cannot be reused after a change of context or inferred from another assignment',()=>{
  const M=model(),A=M.analytes;
  const input={name:'ALT',date:'2026-11-11',value:'2',material:'serum',method:'one'};
  const anchor=M.checkLab(input);
  const exact=M.checkLab({...input,unit:'U/L'});
  const other=M.checkLab({...input,unit:'kU/L',method:'two'});
  const derived=M.checkLab({...input,unit:'IU/L'});
  derived.unitHistory={unit:'IU/L'};
  const doc={observations:[anchor,exact,other,derived],documents:[]};
  const [choice]=A.unitOptions(doc,anchor);
  assert.equal(A.unitOptions(doc,anchor).length,1);
  assert.deepEqual(A.unitOptions(doc,anchor,A.unitHistoryIndex(doc)),A.unitOptions(doc,anchor));
  assert.equal(choice.observationId,exact.id);
  const censored=M.checkLab({...input,value:'<2'});
  assert.equal(A.unitOptions(doc,censored)[0].unit,'U/L');
  assert.equal(M.chartRows([{...censored,unit:'U/L'}]).length,0);
  anchor.unitHistory={...choice,context:A.context(anchor)};
  assert.equal(A.effectiveUnit(anchor),'U/L');
  const {key}=A.applyAlias(doc,anchor,{scope:'name',target:'ast',reason:'Synthetic change',expected:0});
  assert.throws(()=>A.applyAlias(doc,anchor,{scope:'name',target:'alt',reason:'Stale edit',expected:0}));
  assert.equal(doc.analyteAliases[key].version,1);
  assert.equal(A.effectiveUnit(anchor,doc.analyteAliases),'');
  assert.equal(anchor.unit,'');
});
test('reference rules handle zero, partial bounds and qualitative results',()=>{
  const m=model();
  assert.equal(m.status({value:'0',unit:'ммоль/л',low:'1',high:'2'}),'abnormal');
  assert.equal(m.status({value:'2',unit:'ммоль/л',low:'',high:'3'}),'normal');
  assert.equal(m.status({value:'положительно',unit:'ммоль/л',low:'',high:'3'}),'unknown');
  assert.equal(m.status({value:'3',unit:'ммоль/л',low:'',high:''}),'unknown');
  assert.equal(m.status({value:'8',unit:'',low:'0',high:'5'}),'unknown');
});
test('impossible dates are rejected rather than silently normalised',()=>{
  const m=model();
  assert.throws(()=>m.isoDate('2026-02-30'));
  assert.throws(()=>m.isoDate('2026-13-01'));
  assert.equal(m.isoDate('2026-02-28'),'2026-02-28');
});

test('partial dates and censored values retain their original meaning',()=>{
  const m=model(),base={name:'Synthetic CRP',unit:'мг/л',value:'< 0,1'};
  const year=m.checkLab({...base,date:'2026',datePrecision:'year'});
  assert.equal(year.date,'2026');assert.equal(year.value,'< 0,1');assert.equal(year.valueKind,'censored');
  assert.equal(m.chartRows([year]).length,0);assert.equal(m.status(year),'unknown');
  const unknown=m.checkLab({...base,value:'отрицательно',date:'',datePrecision:'unknown'});
  assert.equal(unknown.date,'');assert.equal(unknown.valueKind,'qualitative');
  assert.throws(()=>m.checkLab({...base,date:'2026-13',datePrecision:'month'}));
  assert.throws(()=>m.checkLab({...base,date:'2026',datePrecision:'day'}));
});

test('classification preserves the source name and only merges compatible groups',()=>{
 const m=model(),base={name:'Synthetic lab A',value:'3',unit:'mg',date:'2026-11-01',canonicalName:'Synthetic catalog'};
 const a=m.checkLab(base),b=m.checkLab({...base,name:'Synthetic lab B'}),c=m.checkLab({...base,unit:'g'});
 assert.equal(a.name,'Synthetic lab A');assert.equal(m.groups([a,b,c]).length,2);
 assert.equal(m.groups([a,b])[0].name,'Synthetic catalog');
});

test('shared references and favorites preserve source references and survive serialization',()=>{
 const m=model(),record=m.checkLab({name:'Synthetic marker',value:'3',unit:'mg',date:'2026-11-01',low:'1',high:'5'}),key=m.groupKey(record);
 const pref=m.checkPreferences({unit:'mg',low:'0',high:'2',useReference:'yes',note:'Synthetic reference'},{favorite:true});
 const prefs=JSON.parse(JSON.stringify({[key]:pref})),g=m.groups([record],prefs)[0];
 assert.equal(g.status,'abnormal');assert.equal(g.preferences.favorite,true);
 assert.equal(record.high,'5');assert.equal(m.status(record),'normal');
 assert.equal(m.referenceRow({...record,unit:'g'},pref).high,'5');
 assert.throws(()=>m.checkPreferences({low:'5',high:'1'}));
 assert.throws(()=>m.checkPreferences({high:'NaN'}));
});
test('CSV supports quoted columns and partial success with row errors',()=>{
  const m=model();
  const csv='Дата;Показатель;Результат;Единица;Мин;Макс\n'+
    '2026-11-01;"Глюкоза; натощак";5,1;ммоль/л;3,9;5,5\n'+
    '2026-02-30;ЛПНП;4;ммоль/л;0;3\n';
  const outcome=m.parseCSV(csv);
  assert.equal(outcome.records.length,1);
  assert.equal(outcome.errors.length,1);
  assert.equal(outcome.records[0].name,'Глюкоза; натощак');
});
test('private GitHub storage uses isolated health-data path and in-memory token',()=>{
  const github=script('health/github.js');
  const window={HumanCrypto:{MAX_METADATA:28*1024*1024,MAX_OBJECTS:1000}};
  vm.runInNewContext(github,{window,TextEncoder,TextDecoder});
  assert.equal(window.HumanGithub.PATH,'health-data/v2/vault.json');
  assert.match(github,/info\.private!==true/);
  assert.doesNotMatch(github,/localStorage|sessionStorage/);
  assert.match(github,/expectedSha/);
  const html=script('health/index.html');
  assert.ok(html.indexOf('model.js')<html.indexOf('view.js'));
  assert.ok(html.indexOf('view.js')<html.indexOf('app.js'));
  const builder=script('src/build.py');
  assert.match(builder,/health-route\.js/);
  assert.match(builder,/'health'/);
});

test('GitHub rate limit blocks a second network request until the permitted time',async()=>{
  const window={HumanCrypto:{MAX_METADATA:28*1024*1024,MAX_OBJECTS:1000}};
  let requests=0;
  const fetch=async()=>{
    requests++;
    return new Response('{"message":"secondary rate limit"}',{status:429,headers:{'retry-after':'30'}});
  };
  vm.runInNewContext(script('health/github.js'),{window,TextEncoder,TextDecoder,fetch,AbortController});
  const github=window.HumanGithub;
  github.token('synthetic-token');
  const repo=github.parseRepo('test-owner/test-repo');
  await assert.rejects(github.verify(repo),/Повторите после/);
  await assert.rejects(github.verify(repo),/Повторите после/);
  assert.equal(requests,1);
});

test('binary downloads use the immutable Git blob and verify its content identity',async()=>{
  const {createHash}=require('node:crypto');
  const bytes=Buffer.from(Array.from({length:48},(_,index)=>index*5));
  const objectId=createHash('sha256').update(bytes).digest('hex');
  const gitSha='f'.repeat(40);
  const window={HumanCrypto:{
    MAX_METADATA:28*1024*1024,MAX_OBJECTS:1000,MAX_FILE:32*1024*1024,FILE_OVERHEAD:28,
    isHash:value=>/^[a-f0-9]{64}$/.test(value),
    unbase64:value=>new Uint8Array(Buffer.from(value,'base64')),
    async verifyObject(id,data){assert.equal(createHash('sha256').update(data).digest('hex'),id);},
  }};
  const calls=[];
  const fetch=async url=>{
    calls.push(url);
    const content=url.includes('/contents/')
      ? {type:'file',sha:gitSha,size:bytes.length,encoding:'base64',content:'AAAA'}
      : {sha:gitSha,size:bytes.length,encoding:'base64',content:bytes.toString('base64')};
    return new Response(JSON.stringify(content),{status:200});
  };
  vm.runInNewContext(script('health/github.js'),{window,TextEncoder,TextDecoder,fetch,AbortController});
  const github=window.HumanGithub;
  github.token('synthetic-token');
  const result=await github.readObject(github.parseRepo('test-owner/test-repo'),objectId,'c'.repeat(40));
  assert.deepEqual(Buffer.from(result.bytes),bytes);
  assert.match(calls[0],/objects\/[a-f0-9]{64}\.bin\?ref=[a-f0-9]{40}$/);
  assert.ok(calls[1].endsWith('/git/blobs/'+gitSha));
});

test('replacing the GitHub token aborts requests and discards late responses',async()=>{
  const window={HumanCrypto:{MAX_METADATA:28*1024*1024,MAX_OBJECTS:1000}};
  const calls=[];
  let finish;
  const fetch=(url,options)=>{
    calls.push(options);
    if(calls.length===1)return new Promise(resolve=>{finish=resolve;});
    return Promise.resolve(Response.json(url.endsWith('/test-repo')?{id:41,private:true,visibility:'private'}:{object:{sha:'a'.repeat(40)}}));
  };
  vm.runInNewContext(script('health/github.js'),{window,TextEncoder,TextDecoder,fetch,AbortController});
  const github=window.HumanGithub,repo=github.parseRepo('test-owner/test-repo');
  const old=github.token('synthetic-old-token');
  const pending=github.verify(repo);
  const current=github.token('synthetic-new-token');
  assert.equal(calls[0].signal.aborted,true);
  assert.equal(old(),false);
  finish(Response.json({id:41,private:true,visibility:'private'}));
  await assert.rejects(pending,/отменено/);
  assert.equal(calls.length,1);
  await github.verify(repo);
  assert.equal(calls.length,3);
  assert.equal(calls[1].headers.Authorization,'Bearer synthetic-new-token');
  assert.equal(calls[1].credentials,'omit');
  assert.equal(calls[1].redirect,'error');
  github.disconnect();
  assert.equal(current(),false);
  assert.equal(calls[2].signal.aborted,true);
});

test('a visibility or repository identity change stops GitHub branch publication',async()=>{
  const {createHash,webcrypto}=require('node:crypto');
  for(const changed of [{id:11,private:false,visibility:'public'},{id:11,private:true,visibility:'internal'},{id:12,private:true,visibility:'private'}]){
    const window={HumanCrypto:{MAX_METADATA:28*1024*1024,MAX_OBJECTS:1000,
      assertEnvelope(){},base64:value=>Buffer.from(value).toString('base64')}};
    const calls=[];
    let checks=0;
    const fetch=async (url,options)=>{
      calls.push({url,method:options.method});
      if(url.endsWith('/test-repo'))return Response.json(++checks===1?{id:11,private:true,visibility:'private'}:changed);
      if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:'a'.repeat(40)}});
      if(url.includes('/contents/'))return new Response(null,{status:404});
      if(url.endsWith('/git/blobs')){
        const bytes=Buffer.from(JSON.parse(options.body).content,'base64');
        return Response.json({sha:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')});
      }
      if(url.includes('/git/commits/'))return Response.json({tree:{sha:'b'.repeat(40)}});
      if(url.endsWith('/git/trees'))return Response.json({sha:'c'.repeat(40)});
      if(url.endsWith('/git/commits'))return Response.json({sha:'d'.repeat(40)});
      throw Error('Unexpected GitHub request');
    };
    vm.runInNewContext(script('health/github.js'),{window,TextEncoder,TextDecoder,fetch,AbortController,crypto:webcrypto});
    const github=window.HumanGithub;
    github.token('synthetic-private-token');
    await assert.rejects(github.write(github.parseRepo('test-owner/test-repo'),{objectIds:[]},null),/приватного|изменился во время/);
    assert.equal(checks,2);
    assert.ok(calls.some(call=>call.method==='POST'&&call.url.endsWith('/git/commits')));
    assert.ok(!calls.some(call=>call.method==='PATCH'));
  }
});

test('lab results are never silently truncated during import',()=>{
 const m=model();assert.throws(()=>m.checkLab({name:'Synthetic marker',value:'x'.repeat(8001),date:'2026-11-01'}));
});

test('exact timestamps keep their timezone and drafts stay out of numerical charts',()=>{
 const m=model(),base={name:'Synthetic time marker',value:'3',unit:'mg',date:'2026-11-01T15:00:00.123456789+03:00',datePrecision:'exact'};
 const row=m.checkLab(base);assert.equal(row.date,base.date);assert.equal(row.datePrecision,'exact');assert.equal(m.chartRows([row]).length,1);
 assert.equal(m.chartRows([{...row,reviewStatus:'draft'}]).length,0);
 assert.throws(()=>m.checkLab({...base,date:'2026-11-01T15:00:00'}));
 assert.throws(()=>m.checkLab({...base,date:'2026-02-30T15:00:00Z'}));
});

test('latest exact measurement is ordered by instant across timezone offsets',()=>{
 const m=model(),base={name:'Synthetic time marker',value:'3',unit:'mg',datePrecision:'exact'};
 const a=m.checkLab({...base,date:'2026-11-01T15:00:00+03:00'}),b=m.checkLab({...base,date:'2026-11-01T14:00:00Z'});
 assert.equal(m.groups([a,b])[0].latest.id,b.id);assert.equal(m.recent([a,b])[0].id,b.id);
});

test('medical partial dates validate uncertainty without inventing dates',()=>{
 const m=model(),base={category:'allergy',title:'Synthetic allergy',start:'2020',startPrecision:'year',end:'2020-02',endPrecision:'month',status:'active',basis:'self_reported',reaction:'Synthetic rash',severity:'mild'};
 const r=m.checkMedical(base,null);assert.equal(r.start.value,'2020');assert.equal(r.start.precision,'year');assert.equal(r.end.value,'2020-02');
 assert.throws(()=>m.checkMedical({...base,end:'2019',endPrecision:'year'}));
 assert.throws(()=>m.checkMedical({...base,start:'2020-01-01',startPrecision:'unknown'}));
 assert.throws(()=>m.checkMedical({...base,status:'paused'}));
 assert.throws(()=>m.checkMedical({...base,severity:'invented'}));
 assert.equal(m.checkMedical({category:'allergy',title:'Synthetic date',date:'2020-01-01'}).start.precision,'day');
});

test('clinical edits preserve prior facts while updating the current record',()=>{
 const m=model(),original=m.checkMedical({category:'allergy',title:'Synthetic allergy',start:'2020',startPrecision:'year',status:'active',basis:'clinician',reaction:'Previous reaction',severity:'moderate'});
 const result=m.checkMedical({title:'Synthetic revised allergy',reaction:'Revised reaction',severity:'mild',status:'inactive'},original);
 assert.equal(result.id,original.id);assert.equal(original.allergy.reaction,'Previous reaction');assert.equal(result.allergy.reaction,'Revised reaction');assert.equal(result.start.value,'2020');assert.equal(result.basis,'clinician');
 const med=m.checkMedication({name:'Synthetic supplement',start:'',startPrecision:'unknown',status:'planned',basis:'self_reported',medicationCategory:'supplement',dose:'Synthetic amount',frequency:'Synthetic schedule',route:'Oral',indication:'Synthetic note'});
 assert.equal(med.medication.category,'supplement');assert.equal(med.frequency,'Synthetic schedule');assert.equal(med.startDate,'');
 assert.throws(()=>m.checkMedical({category:'vaccine',title:'Synthetic vaccine',status:'completed',end:'2020',endPrecision:'year'}));
});

test('episode uncertainty, snooze and explicit recovery match HUMAN state transitions',()=>{
 const h=model().health,now=new Date('2026-11-01T12:00:00Z'),base=h.checkEpisode({title:'Synthetic illness',date:'2026-10-30',status:'unknown',diagnosisBasis:'self_reported'},null,now,'UTC');
 assert.equal(h.episodeState(base,now).needsReview,true);assert.equal(h.episodeState(base,now).promptDue,true);
 const snoozed=h.answerEpisode(base,'snooze',{days:3,now,zone:'UTC'});assert.equal(snoozed.status,'unknown');assert.equal(snoozed.confirmedAt,'');assert.equal(h.episodeState(snoozed,now).promptDue,false);
 const ongoing=h.answerEpisode(base,'ongoing',{days:1,now,zone:'UTC'});assert.equal(h.episodeState(ongoing,now).needsReview,false);
 const later=new Date('2026-11-03T12:00:00Z');assert.equal(h.episodeState(ongoing,later).needsReview,true);assert.equal(ongoing.status,'ongoing');
 const ended=h.answerEpisode(ongoing,'ended',{endDate:'2026-11-01',now:later,zone:'UTC'});assert.equal(h.episodeState(ended,later).status,'ended');assert.equal(h.episodeState(ended,later).needsReview,false);const reopened=h.checkEpisode({status:'ongoing'},ended,later,'UTC');assert.equal(reopened.endDate,'');assert.equal(reopened.status,'ongoing');
 assert.throws(()=>h.answerEpisode(ended,'snooze',{days:1,now:later}));assert.throws(()=>h.answerEpisode(base,'ended',{endDate:'2026-10-01',now,zone:'UTC'}));assert.throws(()=>h.answerEpisode(base,'ended',{endDate:'2026-11-30',now,zone:'UTC'}));assert.throws(()=>h.answerEpisode(base,'ongoing',{days:2,now}));
});

test('calendar-day episode review and wall-time ambiguity respect profile timezone',()=>{
 const h=model().health,start=new Date('2026-03-07T17:00:00Z'),next=h.reviewTime(start,'America/New_York',1);
 assert.equal(Date.parse(next)-start.getTime(),23*3600000);
 assert.equal(h.reviewTime(new Date('2026-03-07T07:30:12.345Z'),'America/New_York',1),'2026-03-08T06:30:12.345Z');
 assert.equal(h.reviewTime(new Date('2026-10-31T05:30:00Z'),'America/New_York',1),'2026-11-01T05:30:00.000Z');
 assert.equal(h.reviewTime(new Date('2026-03-28T01:30:00Z'),'Europe/London',1),'2026-03-29T01:30:00.000Z');
 assert.throws(()=>h.timestamp('2026-11-01T01:30','America/New_York'));
 const a=h.timestamp('2026-11-01T01:30','America/New_York','-04:00'),b=h.timestamp('2026-11-01T01:30','America/New_York','-05:00');assert.equal(Date.parse(b)-Date.parse(a),3600000);
 assert.throws(()=>h.timestamp('2026-03-08T02:30','America/New_York'));
});

test('measurements retain glucose units and reject invalid pressure or saturation',()=>{
 const m=model(),base={date:'2026-11-01',type:'Глюкоза',value:'100',unit:'мг/дл'};
 const original=m.checkVital(base);assert.throws(()=>m.checkVital({...base,type:'Масса',unit:'кг'},original));
 assert.equal(m.checkVital(base).unit,'мг/дл');assert.equal(m.checkVital(base).value,'100');
 assert.throws(()=>m.checkVital({...base,type:'Давление',value:'80/120',unit:'мм рт. ст.'}));assert.throws(()=>m.checkVital({...base,type:'Сатурация',value:'101',unit:'%'}));
 assert.equal(m.checkVital({...base,type:'Шаги',value:'0',unit:'шагов'}).value,'0');
 const input=m.health.formInput({date:'2026-11-01',localTime:'15:30',offset:''},null,'Europe/Moscow');assert.equal(input.observedAt,'2026-11-01T12:30:00.000Z');
});

test('episode ending date respects the current profile zone',()=>{
 const h=model().health;
 const record={id:'zone-case',date:'2026-11-01',observedAt:'2026-11-01T23:00:00Z',status:'unknown'};
 assert.throws(()=>h.answerEpisode(record,'ended',{endDate:'2026-11-01',now:new Date('2026-11-03T00:00:00Z'),zone:'Europe/Moscow'}));
});
