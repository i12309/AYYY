const test=require('node:test');
const assert=require('node:assert/strict');
const {pathProblem,availableNotePath,importName}=require('../oberon/app.js');

const vault=(paths=[],folders=[])=>({notes:paths.map((path,index)=>({id:String(index),path,content:'Original text'})),folders});

test('new paths reject reserved directories, controls and length overflow before changing the vault',()=>{
  const current=vault(['Keep.md'],['Folder']),before=structuredClone(current);
  for(const path of ['.git/a.md','Folder/.GiT/a.md','Folder/unsafe\u007f.md','../outside.md','Folder//a.md'])
    assert.equal(pathProblem(current,path).code,'INVALID_PATH',path);
  assert.equal(pathProblem(current,'Folder/.git',{folder:true}).code,'INVALID_PATH');
  assert.equal(pathProblem(current,'a'.repeat(1021)+'.md'),null);
  assert.equal(pathProblem(current,'a'.repeat(1022)+'.md').code,'PATH_LIMIT');
  assert.deepEqual(current,before);
});

test('files cannot replace folders or become parent directories, while a rename can retain its own path',()=>{
  const current=vault(['File.md','Implicit.md/child.md'],['Folder.md','Ordinary']);
  assert.equal(pathProblem(current,'File.md/child.md').code,'FILE_PARENT');
  assert.equal(pathProblem(current,'FILE.MD/subfolder',{folder:true}).code,'FILE_PARENT');
  assert.equal(pathProblem(current,'File.md',{folder:true}).code,'NAME_TAKEN');
  assert.equal(pathProblem(current,'Folder.md').code,'NAME_TAKEN');
  assert.equal(pathProblem(current,'Implicit.md').code,'NAME_TAKEN');
  assert.equal(pathProblem(current,'File.md',{ignoreId:'0'}),null);
  assert.equal(pathProblem(current,'Ordinary/New.md'),null);
});

test('copy naming avoids both notes and directories and reports an overlong suffix without mutation',()=>{
  const current=vault(['Idea.markdown'],['Idea (2).markdown']);
  assert.deepEqual(availableNotePath(current,'Idea.markdown'),{path:'Idea (3).markdown',error:''});
  const path='a'.repeat(1021)+'.md',long=vault([path]),before=structuredClone(long);
  const rejected=availableNotePath(long,path);
  assert.equal(rejected.path,null);assert.match(rejected.error,/1024/);
  assert.deepEqual(long,before);
  assert.equal(availableNotePath(vault(['Parent.md']),'Parent.md/new.md').path,null);
});

test('import names stay a single safe filename and pass the same collision checks',()=>{
  const safe=importName('../A\u007f/[title].markdown');
  assert.equal(safe,'.._A___title_.md');
  assert.equal(pathProblem(vault(),'Импорт/'+safe),null);
  assert.equal(importName('.md'),'Заметка.md');
  assert.equal(importName('picture.png'),null);
  assert.equal(availableNotePath(vault([],['Импорт/A.md']),'Импорт/A.md').path,'Импорт/A (2).md');
});
