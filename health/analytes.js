/* Exact catalogue matches and explicit profile rules. Source facts stay intact. */
(() => {
  'use strict';
  const version='human-analytes/2';
  const catalog=window.HumanAnalyteCatalog;
  const byId=new Map(catalog.map(([id,name,aliases])=>[id,{id,name,aliases}]));
  const notation='₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹';

  function normalize(value){
    const input=String(value??'').trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е')
      .replace(/[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g,digit=>String(notation.indexOf(digit)%10))
      .replaceAll('⁺','+').replaceAll('⁻','-');
    const suffix=/[-−]$/.test(input)?input.at(-1):'';
    const base=suffix?input.slice(0,-1):input;
    return (base.replace(/[^\p{L}\p{N}%+<>=≤≥/]/gu,' ')+suffix).trim().replace(/\s+/g,' ');
  }

  const lookup=new Map();
  for(const definition of byId.values()){
    for(const spelling of [definition.name,...definition.aliases]){
      const key=normalize(spelling);
      if(lookup.has(key)&&lookup.get(key).id!==definition.id)throw Error('Повтор названия в каталоге показателей.');
      lookup.set(key,definition);
    }
  }
  const aliasKey=(name,documentId='')=>JSON.stringify([documentId,normalize(name)]);
  const findRule=(rules,name,documentId='')=>rules[aliasKey(name,documentId)];
  const reportedUnit=row=>String(row.unit||'').trim();
  function compatibleUnit(id,unit){
    return !unit||(id.endsWith('-percent')?unit==='%':!id.endsWith('-absolute')||unit!=='%');
  }
  const matchTechnique=name=>name==='холестерин лпнп прямой'?'direct'
    :/ по фридвальду(?: расчетный)?$/.test(name)?'friedewald':'';
  function classify(row,rules={}){
    const normalized=normalize(row.name),source=lookup.get(normalized);
    const file=row.documentId?findRule(rules,row.name,row.documentId):null;
    const shared=findRule(rules,row.name);
    const manual=byId.get(file?.target)||byId.get(shared?.target);
    const custom=String(row.canonicalName||'').trim();
    let definition=manual||lookup.get(normalize(custom||row.name));
    const unit=reportedUnit(row);
    if(!manual&&!custom&&definition&&!compatibleUnit(definition.id,unit))definition=null;
    const name=definition?.name||custom||row.name||'';
    return {
      id:definition?.id||'name:'+normalize(name),
      name,basis:manual?'manual':custom?'custom':definition?'catalog':'source',
      scope:byId.has(file?.target)?'document':'name',
      technique:source?matchTechnique(normalized):'',
      ruleVersion:version,
    };
  }
  const contextLabel=value=>String(value??'').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g,' ');
  function context(row,rules,match=classify(row,rules)){
    return JSON.stringify([match.id,contextLabel(row.material),contextLabel(row.method),match.technique]);
  }
  const favoriteKey=match=>'favorite:'+match.id;
  const defaultKey=(row,rules)=>'unit:'+context(row,rules);
  const unitEligible=row=>['quantity','censored','range'].includes(row.valueKind);
  function effectiveUnit(row,rules){
    return reportedUnit(row)||(unitEligible(row)&&row.unitHistory?.context===context(row,rules)?row.unitHistory.unit:'');
  }
  function unitOptions(doc,row){
    if(reportedUnit(row)||!unitEligible(row)||row.reviewStatus==='draft')return [];
    const rules=doc.analyteAliases||{},match=classify(row,rules),key=context(row,rules,match);
    const setting=doc.analytePreferences?.[defaultKey(row,rules)];
    if(setting?.unit&&compatibleUnit(match.id,setting.unit))
      return [{unit:setting.unit,settingsVersion:setting.version,reason:setting.reason}];
    const found=new Map();
    for(const other of doc.observations){
      const unit=reportedUnit(other);
      if(other.id===row.id||!unit||!compatibleUnit(match.id,unit)||found.has(unit)||other.unitHistory||
         other.reviewStatus==='draft'||other.valueKind!=='quantity'||context(other,rules)!==key)continue;
      found.set(unit,{unit,observationId:other.id,observationDate:other.date,observationUpdatedAt:other.updatedAt});
    }
    return [...found.values()].sort((a,b)=>a.unit.localeCompare(b.unit,'ru'));
  }
  function applyAlias(doc,row,{scope,target,reason,expected}){
    if(!['name','document'].includes(scope))throw Error('Укажите область сопоставления.');
    const documentId=scope==='document'?row.documentId:'';
    if(scope==='document'&&(!documentId||!doc.documents.some(file=>file.id===documentId)))
      throw Error('Исходный файл не найден.');
    const normalizedName=normalize(row.name);
    if(!normalizedName)throw Error('Укажите название показателя.');
    reason=String(reason??'').trim();
    if(!reason||reason.length>1000)throw Error('Укажите причину сопоставления до 1000 символов.');
    if(target&&!byId.has(target))throw Error('Выберите показатель из каталога.');
    const key=aliasKey(row.name,documentId),rules=doc.analyteAliases??={};
    const previous=rules[key],revision=previous?.version||0;
    if(revision!==Number(expected))throw Error('Сопоставление изменилось. Откройте измерение заново.');
    const next={normalizedName,documentId:documentId||'',target,reason,version:revision+1,
      ruleVersion:version,updatedAt:new Date().toISOString()};
    rules[key]=next;
    return {key,previous,next};
  }
  function setDefault(doc,row,unit,reason,expected){
    const key=defaultKey(row,doc.analyteAliases||{});
    const preferences=doc.analytePreferences??={};
    const previous=preferences[key];
    if((previous?.version||0)!==Number(expected))throw Error('Настройки единицы изменились. Откройте показатель заново.');
    unit=String(unit??'').trim();
    reason=String(reason??'').trim();
    if(unit.length>100||!reason||reason.length>1000)throw Error('Проверьте единицу и укажите причину до 1000 символов.');
    if(!compatibleUnit(classify(row,doc.analyteAliases).id,unit))throw Error('Единица не соответствует типу показателя.');
    const next={unit,reason,version:(previous?.version||0)+1,updatedAt:new Date().toISOString()};
    preferences[key]=next;
    return {key,previous,next};
  }
  function searchText(row,rules){
    const match=classify(row,rules);
    const aliases=byId.get(match.id)?.aliases||[];
    return normalize([row.name,match.name,...aliases,row.unit,row.unitHistory?.unit,row.material,row.method,
      row.source,row.provenance?.filename].join(' '));
  }
  window.HumanAnalytes={version,catalog,byId,normalize,classify,context,favoriteKey,defaultKey,unitEligible,effectiveUnit,
    unitOptions,aliasKey,findRule,applyAlias,setDefault,searchText};
})();
