/* Synthetic parity tests for GEDCOM 5.5.1/7 in the browser. */
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const ts=require('../family-app/node_modules/typescript');
// Vite 8 no longer pulls in esbuild. Use the project's own TypeScript
// compiler and a small local CommonJS resolver for the test modules.
const loaded=new Map();
function compile(filename){
  const full=path.resolve(__dirname,'../family-app/src/lib',filename);
  if(loaded.has(full))return loaded.get(full);
  const source=fs.readFileSync(full,'utf8');
  const output=ts.transpileModule(source,{fileName:full,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
    esModuleInterop:true
  }}).outputText;
  const mod={exports:{}};
  loaded.set(full,mod.exports);
  const localRequire=(name)=>{
    if(!name.startsWith('.'))return require(name);
    return compile(path.resolve(path.dirname(full),name+(path.extname(name)?'':'.ts')));
  };
  new Function('require','module','exports',output)(localRequire,mod,mod.exports);
  loaded.set(full,mod.exports);
  return mod.exports;
}
const {parseGedcom}=compile('gedcomParse.ts');
const {exportGedcom}=compile('gedcomExport.ts');
const encoder=new TextEncoder(),decoder=new TextDecoder();
function input(body,version='5.5.1'){
  const head=['0 HEAD','1 SOUR GEN-TEST','1 GEDC','2 VERS '+version,
    ...(version.startsWith('7.')?[]:['2 FORM LINEAGE-LINKED','1 CHAR UTF-8'])].join('\n');
  return encoder.encode(head+'\n'+body.trim()+'\n0 TRLR\n');
}
function rows(...lines){return lines.join('\n');}
function read(bytes,encoding){return parseGedcom(bytes,encoding);}
function person(data,id){return data.persons.find(p=>p.gedcom_id===id);}
function family(data,id){return data.families.find(f=>f.gedcom_id===id);}
function write(data){return exportGedcom(data.persons,data.families,data.metadata);}
function text(data){return decoder.decode(write(data));}
test('551: spouses, children, pedigree, unknown records survive round-trip',()=>{
  const data=read(input(rows(
    '0 @I1@ INDI','1 NAME Иван /Волков/','1 SEX M','1 FAMS @F1@','1 _UNKNOWN KEEP',
    '0 @I2@ INDI','1 NAME Мария /Лесная/','1 FAMS @F1@',
    '0 @I3@ INDI','1 NAME Аня /Волкова/','1 FAMC @F1@','2 PEDI adopted',
    '0 @F1@ FAM','1 HUSB @I1@','1 WIFE @I2@','1 CHIL @I3@',
    '1 MARR Y','2 DATE 12 MAY 1995','2 PLAC Москва',
    '0 @S1@ SOUR','1 TITL Семейный архив')));
  assert.equal(data.persons.length,3);assert.equal(data.families.length,1);
  assert.equal(family(data,'@F1@').children[0].pedigree,'adopted');
  assert.equal(family(data,'@F1@').marriage_place,'Москва');
  const exported=text(data);
  assert.match(exported,/1 _UNKNOWN KEEP/);
  assert.match(exported,/0 @S1@ SOUR/);
  assert.match(exported,/2 PEDI adopted/);
  assert.equal(read(write(data)).families[0].children.length,1);
});
test('editing primary NAME retains alternate names, citations, unmodeled properties',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Анна /Иванова/',
    '2 GIVN Анна','2 SURN Иванова','2 SOUR @S1@','3 PAGE 17',
    '1 NAME Анюта /Петрова/','2 TYPE married','2 GIVN Анюта','2 SURN Петрова',
    '1 _CUSTOM custom-value','0 @S1@ SOUR','1 TITL История семьи')));
  person(data,'@I1@').surname='Сидорова';
  const output=text(data);
  assert.match(output,/1 NAME Анюта \/Петрова\//);
  assert.match(output,/3 PAGE 17/);
  assert.match(output,/1 _CUSTOM custom-value/);
  assert.match(output,/2 SURN Сидорова/);
  assert.equal(person(read(write(data)),'@I1@').surname,'Сидорова');
});
test('Cyrillic notes, literal at-signs, CONT/CONC and long wrapping',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Анна /Петрова/',
    '1 NOTE Первая строка:','2 CONC  однажды','2 CONT Вторая строка',
    '2 CONT','2 CONT Адрес: anna@@example.org')));
  const p=person(data,'@I1@');
  assert.equal(p.biography,'Первая строка: однажды\nВторая строка\n\nАдрес: anna@example.org');
  const biography='Очень длинная история @дома. '.repeat(80)+'\n\n@Последний абзац.';
  p.biography=biography;
  const rendered=text(data);
  assert.ok(rendered.split(/\r?\n/).every(line=>Buffer.byteLength(line,'utf8')<=253));
  assert.match(rendered,/\r\n2 CONC /);
  assert.equal(person(read(write(data)),'@I1@').biography,biography);
});
test('shared NOTE remains unchanged when one person edits biography',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Анна /Иванова/','1 NOTE @N1@',
    '0 @I2@ INDI','1 NAME Олег /Иванов/','1 NOTE @N1@',
    '0 @N1@ NOTE Общая заметка')));
  assert.equal(person(data,'@I1@').biography,'Общая заметка');
  person(data,'@I1@').biography='Личная биография';
  const output=text(data);
  assert.match(output,/0 @N1@ NOTE Общая заметка/);
  assert.match(output,/1 NOTE Личная биография/);
  assert.equal(person(read(write(data)),'@I2@').biography,'Общая заметка');
});
test('GEDCOM 7: SNOTE, sex X and application extension',()=>{
  const data=read(input(rows('0 @N1@ SNOTE Источник заметки',
    '0 @I1@ INDI','1 NAME Лена /Тестова/','1 SEX X',
    '1 SNOTE @N1@','1 _APPVENDOR VALUE','0 @X1@ _CUSTOM',
    '1 _ATTR external data'),'7.0'));
  assert.equal(data.metadata.gedcom_version,'7.0');
  assert.equal(person(data,'@I1@').biography,'Источник заметки');
  const output=text(data);
  assert.match(output,/2 VERS 7.0/);
  assert.match(output,/1 SEX X/);
  assert.match(output,/1 _APPVENDOR VALUE/);
  assert.match(output,/0 @X1@ _CUSTOM/);
  assert.ok(!/\n1 CHAR /.test(output));
});
test('551 encodes extended sex X using SEX U and _GEN_SEX',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME А /Б/','1 SEX U')));
  person(data,'@I1@').sex='X';
  assert.match(text(data),/1 SEX U/);
  assert.match(text(data),/1 _GEN_SEX X/);
  assert.equal(person(read(write(data)),'@I1@').sex,'X');
});
test('reciprocal links are repaired but unresolved person is not invented',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Иван /Сидоров/','1 FAMC @F1@',
    '0 @F1@ FAM','1 HUSB @MISSING@')));
  assert.equal(data.persons.length,1);
  assert.equal(data.families[0].children.length,1);
  assert.equal(data.families[0].partner1_id,null);
  assert.ok(data.warnings.some(w=>w.includes('UNRESOLVED_REFERENCE')));
  assert.match(text(data),/1 HUSB @MISSING@/);
});
test('UTF-16LE BOM and explicit Windows-1251 import',()=>{
  const plain=decoder.decode(input('0 @I1@ INDI\n1 NAME Иван /Волков/'));
  const utf16=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(plain,'utf16le')]);
  assert.equal(person(read(utf16),'@I1@').surname,'Волков');
  const win=Buffer.concat([
    Buffer.from('0 HEAD\n1 SOUR GEN-TEST\n1 GEDC\n2 VERS 5.5.1\n1 CHAR ANSI\n0 @I1@ INDI\n1 NAME ','ascii'),
    Buffer.from([0xc0,0xed,0xff]),
    Buffer.from(' /Ivanova/\n0 TRLR\n','ascii')]);
  assert.equal(person(read(win,'cp1251'),'@I1@').given_name,'Аня');
  assert.throws(()=>read(win),/Кодировка/);
});
test('malformed hierarchy, duplicate xref and unsupported version rejected',()=>{
  assert.throws(()=>read(encoder.encode('1 NAME illegal\n0 TRLR\n')));
  assert.throws(()=>read(input(rows('0 @I1@ INDI','0 @I1@ INDI'))),/повторяющийся/);
  assert.throws(()=>read(input('0 @I1@ INDI','5.5')),/не поддерживается/);
});
test('GED media object reference retained; binary is not fabricated',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Тест /Фото/',
    '1 OBJE @O1@','0 @O1@ OBJE','1 FILE photo.jpg','2 FORM jpeg')));
  assert.ok(data.warnings.some(w=>w.includes('MEDIA_REFERENCE')));
  assert.match(text(data),/1 FILE photo.jpg/);
  assert.equal(data.persons[0]._photo,undefined);
});

test('edit name and maiden name preserves NPFX, SPFX, NSFX and custom nodes',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Dr. John /van Doe/ Jr.',
    '2 NPFX Dr.','2 GIVN John','2 SPFX van','2 SURN Doe','2 NSFX Jr.',
    '2 _CUSTOM Primary detail','3 _FLAG original',
    '1 NAME John /Brown/ III','2 TYPE birth','2 GIVN John','2 SURN Brown',
    '2 NSFX III','2 _CUSTOM Maiden detail')));
  const p=person(data,'@I1@');
  p.given_name='James';p.surname='Smith';p.maiden_name='Green';
  const output=text(data);
  assert.match(output,/1 NAME Dr\. James \/van Smith\/ Jr\./);
  assert.match(output,/1 NAME John \/Green\/ III/);
  assert.match(output,/2 _CUSTOM Primary detail\r\n3 _FLAG original/);
  assert.match(output,/2 _CUSTOM Maiden detail/);
  assert.equal(person(read(write(data)),'@I1@').maiden_name,'Green');
});
test('multiple marriages and adoptive families stay separate',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Пётр /Первый/','1 FAMS @F1@','1 FAMS @F2@',
    '0 @I2@ INDI','1 NAME Анна /Первая/','1 FAMS @F1@',
    '0 @I3@ INDI','1 NAME Ольга /Вторая/','1 FAMS @F2@',
    '0 @I4@ INDI','1 NAME Борис /Первый/','1 FAMC @F1@','2 PEDI birth',
    '1 FAMC @F2@','2 PEDI adopted',
    '0 @F1@ FAM','1 HUSB @I1@','1 WIFE @I2@','1 CHIL @I4@',
    '0 @F2@ FAM','1 HUSB @I1@','1 WIFE @I3@','1 CHIL @I4@')));
  assert.equal(data.families.length,2);
  assert.equal(family(data,'@F1@').children[0].pedigree,'birth');
  assert.equal(family(data,'@F2@').children[0].pedigree,'adopted');
  assert.equal(read(write(data)).families.length,2);
});
test('removing an adopted child removes both family pointers but retains unrelated records',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Иван /Петров/','1 FAMS @F1@',
    '0 @I2@ INDI','1 NAME Анна /Петрова/','1 FAMC @F1@','2 PEDI adopted',
    '1 _OTHER keep','0 @F1@ FAM','1 HUSB @I1@','1 CHIL @I2@',
    '0 @S1@ SOUR','1 TITL Источник')));
  family(data,'@F1@').children=[];
  const output=text(data);
  assert.ok(!output.includes('1 CHIL @I2@'));
  assert.ok(!output.includes('1 FAMC @F1@'));
  assert.match(output,/1 _OTHER keep/);
  assert.match(output,/0 @S1@ SOUR/);
});
test('GEDCOM 7 leading @ escaping is preserved and no CONC is introduced',()=>{
  const data=read(input(rows('0 @I1@ INDI','1 NAME Анна /Петрова/',
    '1 NOTE @@handle, symbol a@@b','2 CONT @@next'),'7.0'));
  const p=person(data,'@I1@');
  assert.equal(p.biography,'@handle, symbol a@@b\n@next');
  p.biography += '\n'+ 'Очень длинный текст. '.repeat(150);
  const output=text(data);
  assert.ok(!/^\d+ CONC(?: |$)/m.test(output));
  assert.equal(person(read(write(data)),'@I1@').biography,p.biography);
});
test('qualified dates remain verbatim across GEDCOM round-trips',()=>{
  for(const date of ['1901','FEB 1901','ABT 1901','BET 1899 AND 1901',
    'FROM 1901 TO 1905','(до революции)']){
    const data=read(input(rows('0 @I1@ INDI','1 NAME Тест /Дата/',
      '1 BIRT Y','2 DATE '+date)));
    assert.equal(person(data,'@I1@').birth_date,date);
    assert.equal(person(read(write(data)),'@I1@').birth_date,date);
  }
});
test('legacy UTF-8 split over successive CONC lines is repaired, raw nodes retained',()=>{
  const bytes=Buffer.concat([
    Buffer.from('0 HEAD\n1 SOUR GEN-TEST\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Anna /Person/\n1 NOTE Start ','utf8'),
    Buffer.from([0xe4]),Buffer.from('\n2 CONC ','ascii'),Buffer.from([0xb8]),
    Buffer.from('\n2 CONC ','ascii'),Buffer.from([0xad]),
    Buffer.from(' end\n1 _CUSTOM Original detail\n2 _FLAG retained\n0 TRLR\n','utf8')
  ]);
  const data=read(bytes);
  assert.equal(person(data,'@I1@').biography,'Start 中 end');
  assert.ok(data.warnings.some(w=>w.includes('SPLIT_UTF8_CONC')));
  const note=person(data,'@I1@')._raw.node.children.find(n=>n.tag==='NOTE');
  assert.equal(note.children.filter(n=>n.tag==='CONC').length,2);
  person(data,'@I1@').given_name='Edited';
  assert.match(text(data),/1 _CUSTOM Original detail\r\n2 _FLAG retained/);
  assert.equal(person(read(write(data)),'@I1@').biography,'Start 中 end');
});
test('ANSEL and malformed data are rejected without silent replacement',()=>{
  const ansel=encoder.encode('0 HEAD\n1 SOUR X\n1 GEDC\n2 VERS 5.5.1\n1 CHAR ANSEL\n0 TRLR\n');
  assert.throws(()=>read(ansel),/ANSEL/);
  const invalid=Buffer.concat([Buffer.from('0 HEAD\n1 SOUR X\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n1 NOTE '),Buffer.from([0xff]),Buffer.from('\n0 TRLR\n')]);
  assert.throws(()=>read(invalid),/кодировке|повреждённый/);
});
test('generated media references use portable paths, not temporary blob URLs',()=>{
  const data=read(input('0 @I1@ INDI\n1 NAME Иван /Медиа/'));
  data.persons[0]._photo={filename:'portrait.jpg',mime_type:'image/jpeg'};
  data.persons[0].photo_url='blob:https://localhost/temporary';
  const out=text(data);
  assert.match(out,/1 FILE media\/portrait\.jpg/);
  assert.ok(!out.includes('blob:https://'));
  assert.ok(data.persons[0]._raw.node);
});
