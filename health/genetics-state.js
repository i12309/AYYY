/* Reported findings only. No genotype inference or clinical interpretation. */
(() => {
 'use strict';
 const M=window.HumanModel;
 const categories={disease_risk:'Риски заболеваний',carrier_status:'Носительство',nutrition:'Питание',metabolism:'Обмен веществ',drug_response:'Ответ на лекарства',physical_trait:'Особенности',other:'Другое'};
 const statuses={recorded:'Записано',attention:'По отчёту: внимание',unknown:'Неизвестно'};
 const reviewStatuses={confirmed_manual:'Внесено вручную',confirmed_review:'Проверено по источнику',draft:'Черновик'};
 function text(value,max){const result=String(value??'');if(Array.from(result).length>max)throw Error('Поле превышает допустимую длину: '+max+' символов.');return result;}
 function sourceURL(value){const raw=String(value??'').trim();if(!raw)return '';if(!/^https?:\/\//i.test(raw))throw Error('Источник должен быть ссылкой HTTP или HTTPS.');let url;try{url=new URL(raw);}catch{throw Error('Проверьте ссылку на источник.');}if(!url.hostname||url.username||url.password)throw Error('Проверьте адрес источника: данные авторизации в ссылке не поддерживаются.');return url.href;}
 function safeURL(value){try{return sourceURL(value);}catch{return '';}}
 function checkFinding(input,original={},doc,now=new Date()){
  original=original||{};
  const title=text(input.title??original.title,300).trim(),result=text(input.result??original.result,16000),category=String(input.category??original.category??'other'),status=String(input.status??original.status??'recorded'),review_status=String(input.review_status??original.review_status??'confirmed_manual');
  if(!title||!result.trim())throw Error('Укажите название и результат из отчёта.');if(!Object.hasOwn(categories,category))throw Error('Выберите категорию результата.');if(!Object.hasOwn(statuses,status))throw Error('Выберите метку результата.');if(!Object.hasOwn(reviewStatuses,review_status))throw Error('Выберите статус проверки записи.');
  const date_precision=String(input.date_precision??original.date_precision??'unknown');if(!['unknown','year','month','day'].includes(date_precision))throw Error('Выберите точность даты исследования.');
  const date=M.partialDate(input.test_date??original.test_date??'',date_precision),provider=text(input.provider??original.provider,1000).trim(),test_name=text(input.test_name??original.test_name,1000).trim(),variants=text(input.variants??original.variants,16000),provider_text=text(input.provider_text??original.provider_text,64000),method_version=text(input.method_version??original.method_version,1000).trim(),source_url=sourceURL(text(input.source_url??original.source_url,4000));
  const supplied=input.genes??original.genes??[],genes=Array.isArray(supplied)?supplied.map(x=>text(x,128).trim()).filter(Boolean):text(supplied,4000).split(/[,;\s]+/).filter(Boolean);if(genes.length>512||genes.some(g=>g.length>128))throw Error('Слишком длинный список генов.');
  const source_document_id=String(input.source_document_id??original.source_document_id??'');if(source_document_id&&source_document_id!==original.source_document_id&&!doc.documents.some(x=>x.id===source_document_id))throw Error('Документ-источник не найден.');
  return {...original,id:original.id||M.id(),title,result,category,status,review_status,test_date:date.value,date_precision,provider,test_name,genes,variants,provider_text,method_version,source_document_id,source_url,source:{...original.source,type:'manual',document_id:source_document_id,provider,url:source_url,method_version},version:(original.version||0)+1,createdAt:original.createdAt||new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
 }
 function records(doc,{query='',category=''}={}){const q=String(query).toLocaleLowerCase('ru-RU');return doc.findings.filter(x=>(!category||x.category===category)&&(!q||[x.title,x.provider].join(' ').toLocaleLowerCase('ru-RU').includes(q))).slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));}
 window.HumanGenetics={categories,statuses,reviewStatuses,checkFinding,sourceURL,safeURL,records};
})();
