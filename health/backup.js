/* Portable archive: a bounded encrypted manifest followed by encrypted file bytes. */
(() => {
  'use strict';
  const C=window.HumanCrypto;
  const encode=new TextEncoder();
  const magic=encode.encode('AYYY-HUMAN-BACKUP-2\n');
  const prefixLength=magic.length+4;
  const maxHeader=Math.ceil((C.MAX_METADATA+16)/3)*4+C.MAX_OBJECTS*180+2048;

  async function pack(envelope,objects){
    C.assertEnvelope(envelope);
    const files=new Map(objects.map(object=>[object.id,object.bytes]));
    if(files.size!==objects.length||files.size!==envelope.objectIds.length)
      throw Error('Не совпадает состав резервной копии.');
    const parts=[],entries=[];
    let total=0;
    for(const id of envelope.objectIds){
      const bytes=await C.verifyObject(id,files.get(id));
      total+=bytes.length-C.FILE_OVERHEAD;
      entries.push({id,length:bytes.length});
      parts.push(bytes);
    }
    const header=encode.encode(JSON.stringify({envelope,entries}));
    if(total>C.MAX_FILES||header.length>maxHeader)throw Error('Резервная копия превышает предел размера.');
    const prefix=new Uint8Array(prefixLength);
    prefix.set(magic);
    new DataView(prefix.buffer).setUint32(magic.length,header.length);
    return new Blob([prefix,header,...parts],{type:'application/octet-stream'});
  }
  async function open(file){
    if(!file||file.size<prefixLength||file.size>prefixLength+maxHeader+C.MAX_FILES+C.FILE_OVERHEAD*C.MAX_OBJECTS)
      throw Error('Выберите резервную копию HUMAN в формате .human.');
    const prefix=new Uint8Array(await file.slice(0,prefixLength).arrayBuffer());
    if(!magic.every((value,index)=>prefix[index]===value))
      throw Error('Выберите резервную копию HUMAN в формате .human.');
    const length=new DataView(prefix.buffer).getUint32(magic.length);
    if(!length||length>maxHeader||prefixLength+length>file.size)throw Error('Заголовок резервной копии повреждён.');
    const {envelope,entries}=JSON.parse(await file.slice(prefixLength,prefixLength+length).text());
    C.assertEnvelope(envelope);
    if(!Array.isArray(entries)||entries.length!==envelope.objectIds.length)
      throw Error('В резервной копии отсутствуют документы.');
    let offset=prefixLength+length,total=0;
    const slices=new Map();
    for(const [index,entry] of entries.entries()){
      if(entry?.id!==envelope.objectIds[index]||!Number.isSafeInteger(entry.length)||
         entry.length<C.FILE_OVERHEAD||entry.length>C.MAX_FILE+C.FILE_OVERHEAD)
        throw Error('Некорректный список документов резервной копии.');
      slices.set(entry.id,file.slice(offset,offset+entry.length));
      offset+=entry.length;
      total+=entry.length-C.FILE_OVERHEAD;
    }
    if(offset!==file.size||total>C.MAX_FILES)throw Error('Резервная копия неполная или повреждена.');
    return {envelope,async readObject(id){
      const slice=slices.get(id);
      if(!slice)throw Error('В резервной копии отсутствует документ.');
      const bytes=new Uint8Array(await slice.arrayBuffer());
      await C.verifyObject(id,bytes);
      return {id,bytes};
    }};
  }
  window.HumanBackup={pack,open};
})();
