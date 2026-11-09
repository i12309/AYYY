/* Synthetic parity tests for GEDCOM 5.5.1/7 in the browser. */
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {buildSync}=require('../family-app/node_modules/esbuild');
function compile(filename){
  const output=buildSync({entryPoints:[path.join(__dirname,'../family-app/src/lib',filename)],
    bundle:true,platform:'node',format:'cjs',write:false,target:'node24'}).outputFiles[0].text;
  const mod={exports:{}};
  new Function('module','exports','require',output)(mod,mod.exports,require);
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
