/* HUMAN sample data. Entirely fictional; constructed in memory and never persisted. */
(() => {
  'use strict';
  const M=window.HumanModel;
  const dates=['2025-03-14','2025-06-20','2025-09-15','2025-12-22',
    '2026-03-18','2026-06-23','2026-10-19'];
  const labNames=['Лаборатория №1 (демо)','Клиника «Пример» (демо)'];
  function labSeries(code,name,unit,low,high,values,extra={}){
    const selected=dates.slice(-values.length);
    return values.map((v,index)=>({
      id:'demo-lab-'+code+'-'+(index+1),date:selected[index],
      name,value:String(v).replace('.',','),unit,low:String(low),high:String(high),
      source:labNames[index%2],material:extra.material||'Венозная кровь',
      method:extra.method||'Лабораторное исследование',
      notes:index===values.length-1?'Учебный результат, не медицинское заключение.':'',
      createdAt:selected[index]+'T09:00:00Z',
      updatedAt:selected[index]+'T09:00:00Z'
    }));
  }
  const vitalDates=['2026-06-12','2026-06-30','2026-07-14','2026-07-29',
    '2026-08-10','2026-08-25','2026-09-05','2026-09-19',
    '2026-10-01','2026-10-13','2026-10-27','2026-11-06'];
  function vital(type,unit,values,code,notes=''){
    const d=vitalDates.slice(-values.length);
    return values.map((value,i)=>({
      id:'demo-vital-'+code+'-'+(i+1),type,date:d[i],
      value:String(value).replace('.',','),unit,
      notes:i===values.length-1?notes:'',
      createdAt:d[i]+'T07:30:00Z',updatedAt:d[i]+'T07:30:00Z'
    }));
  }
  function medical(id,category,title,date,notes){
    return {id:'demo-medical-'+id,category,title,date,notes,
      createdAt:date+'T10:00:00Z',updatedAt:date+'T10:00:00Z'};
  }
  function medication(id,name,dose,frequency,startDate,notes){
    return {id:'demo-medication-'+id,name,dose,frequency,startDate,notes,
      createdAt:startDate+'T10:00:00Z',updatedAt:startDate+'T10:00:00Z'};
  }
  function diary(id,kind,title,date,notes){
    return {id:'demo-diary-'+id,kind,title,date,notes,
      createdAt:date+'T20:00:00Z',updatedAt:date+'T20:00:00Z'};
  }
  function attachment(id,name,title,date,mime,content){
    const bytes=new TextEncoder().encode(content);
    return {id:'demo-document-'+id,name,title,date,mime,size:bytes.length,
      data:window.HumanCrypto.base64(bytes),
      createdAt:date+'T11:00:00Z',updatedAt:date+'T11:00:00Z'};
  }
  function create(){
    const observations=[
      ...labSeries('ldl','Холестерин ЛПНП','ммоль/л','',3.0,[3.8,3.6,3.4,3.0,2.7,2.5]),
      ...labSeries('chol','Холестерин общий','ммоль/л','',5.2,[6.4,6.2,5.9,5.5,5.1,4.9]),
      ...labSeries('hdl','Холестерин ЛПВП','ммоль/л',1.2,'',[1.28,1.32,1.4,1.34,1.42,1.5]),
      ...labSeries('trig','Триглицериды','ммоль/л','',1.7,[1.8,1.64,1.55,1.48,1.4,1.35]),
      ...labSeries('glucose','Глюкоза натощак','ммоль/л',3.9,5.5,[5.3,5.2,5.8,5.1,4.9,5.1]),
      ...labSeries('a1c','Гликированный гемоглобин HbA1c','%',4.0,5.6,[5.6,5.5,5.4,5.4]),
      ...labSeries('hb','Гемоглобин','г/л',120,155,[129,130,134,131,136,137]),
      ...labSeries('ferritin','Ферритин','мкг/л',15,150,[44,40,38,36,30,13]),
      ...labSeries('vitd','Витамин D (25-OH)','нг/мл',30,100,[24,28,30,34,31,27]),
      ...labSeries('tsh','ТТГ','мМЕ/л',0.4,4.0,[1.6,1.9,2.1,1.5,1.8]),
      ...labSeries('alt','АЛТ','Ед/л','',35,[27,31,29,34,47]),
      ...labSeries('crp','С-реактивный белок','мг/л','',5,[1.2,1.7,0.8,2.0,1.3,1.0])
    ];
    const vitals=[
      ...vital('Давление','мм рт. ст.',['120/78','118/76','124/79','121/80',
        '119/77','122/81','117/76','125/82','120/79','121/78'],'bp','Измерение в покое.'),
      ...vital('Пульс','уд/мин',[72,70,75,74,68,71,69,73],'pulse',''),
      ...vital('Масса','кг',[65.2,65.1,64.8,64.7,64.6,64.4,64.5],'weight','Утром, натощак.'),
      ...vital('Сон','ч',[7.5,8,7,7.8,8.2],'sleep',''),
      ...vital('Температура','°C',[36.5,36.6,36.5],'temperature','')
    ];
    const medicalRecords=[
      medical('allergy','allergy','Сезонная реакция на пыльцу','2021-05-01',
        'Пример записи аллергии со слов пользователя.'),
      medical('condition','condition','Сезонный аллергический ринит','2022-04-01',
        'Самостоятельно внесённые сведения, без врачебной верификации.'),
      medical('vaccine','vaccine','Прививка от гриппа','2025-10-10',
        'Демонстрационная запись вакцинации.'),
      medical('operation','surgery','Удаление аппендикса','2013-02-15',
        'Вымышленный пример ранее перенесённой операции.')
    ];
    const medications=[
      medication('vitd','Витамин D','1000 МЕ','Раз в день','2026-10-01',
        'Учебная запись, не рекомендация к приёму.'),
      medication('spray','Назальный спрей','По назначению','При необходимости','2026-04-05',
        'Учебный пример. Схема лечения не назначается программой.')
    ];
    const diaryRows=[
      diary('01','food','Завтрак: омлет и овощи','2026-10-27','Время 08:45, самочувствие хорошее.'),
      diary('02','activity','Пешая прогулка, 45 минут','2026-10-27','Пример учёта активности.'),
      diary('03','sleep','Сон: 7 ч 30 мин','2026-10-28','Просыпалась один раз.'),
      diary('04','wellbeing','Самочувствие: хорошее','2026-10-28','Энергия 8/10.'),
      diary('05','food','Обед: рыба, гречка, салат','2026-10-29','Пример дневника питания.'),
      diary('06','activity','Велосипед, 35 минут','2026-10-30','Лёгкая нагрузка.'),
      diary('07','food','Ужин: овощной суп','2026-11-01','Без заметных жалоб.'),
      diary('08','sleep','Сон: 8 часов','2026-11-02','Хорошее восстановление.'),
      diary('09','wellbeing','Самочувствие: небольшая усталость','2026-11-03','После рабочего дня.'),
      diary('10','activity','Прогулка 6 200 шагов','2026-11-04','Спокойный темп.'),
      diary('11','food','Завтрак: йогурт, ягоды','2026-11-06','Вымышленный рацион.'),
      diary('12','wellbeing','Самочувствие: без жалоб','2026-11-07','Показатели из демонстрационного профиля.')
    ];
    diaryRows.filter(x=>x.kind==='food').forEach((row,i)=>Object.assign(row,{description:row.title,eaten_at:row.date+'T'+(['05:45:00Z','10:00:00Z','15:30:00Z','06:30:00Z'][i]),calories_kcal:[320,610,null,0][i],protein_g:[18,32,null,null][i],fat_g:[14,19,null,null][i],carbs_g:[30,70,null,null][i],alcohol_g:null,estimated:i===1,version:1,origin:{type:'manual'}}));
    diaryRows.filter(x=>x.kind==='activity').forEach((row,i)=>Object.assign(row,{daily:true,steps:[4200,null,6200][i],sleep_minutes:[450,480,null][i],exercise_minutes:[45,35,0][i],activity_type:row.title,version:1,origin:{type:'manual'}}));
    const documents=[
      attachment('one','demo-lab-results.csv','Бланк анализов · пример','2026-10-19','text/csv',
        'Дата;Показатель;Результат;Единица;Мин;Макс\n2026-10-19;Глюкоза натощак;5,1;ммоль/л;3,9;5,5\n2026-10-19;АЛТ;47;Ед/л;;35\n'),
      attachment('two','demo-doctor-note.txt','Консультация · учебная заметка','2026-10-21','text/plain',
        'ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ\nВсе сведения вымышлены.\nЭто пример структуры медицинского журнала AYYY.\nНикаких медицинских рекомендаций документ не содержит.\n'),
      attachment('three','demo-medication-history.txt','История препаратов · пример','2026-10-26','text/plain',
        'ДЕМОНСТРАЦИЯ. Не является назначением.\nВитамин D — учебная запись от 2026-10-01.\nНазальный спрей — учебная запись от 2026-04-05.\n')
    ];
    const episodes=[{id:'demo-episode-ended',title:'Пример эпизода самочувствия',date:'2026-11-01',observedAt:'',diagnosisBasis:'self_reported',symptoms:'Вымышленная запись для знакомства с журналом.',treatments:'',context:'',notes:'Только демонстрация, не медицинское заключение.',endDate:'2026-11-07',status:'ended',confirmedAt:'2026-11-07T12:00:00Z',confirmedUntil:'',nextPromptAt:'',version:1,createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-07T12:00:00Z'},{id:'demo-episode-review',title:'Демонстрационная запись для уточнения',date:'2026-10-01',observedAt:'',diagnosisBasis:'self_reported',symptoms:'Состояние в примере не уточнено.',treatments:'',context:'',notes:'',endDate:'',status:'unknown',confirmedAt:'',confirmedUntil:'',nextPromptAt:'',version:1,createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z'}];
    vitals.find(x=>x.type==='Температура'&&x.date==='2026-11-06').episodeId='demo-episode-ended';
    const doc={
      schema:1,id:'demo-human-example-v1',
      profile:{name:'Анна Примерова',birthDate:'1988-04-18',sex:'female',heightCm:165,timezone:'Europe/Moscow',
        notes:'Вымышленный профиль для знакомства с интерфейсом HUMAN. Записи не являются медицинскими рекомендациями.'},
      intakes:[{id:'demo-intake',version:1,medication_id:medications[0].id,medication_name:medications[0].name,occurred_at:'2026-11-06T09:00:00Z',outcome:'taken',dose:'',notes:'Вымышленное событие для знакомства с журналом.',source:{type:'manual'}}],
      reminders:[{id:'demo-reminder',version:1,title:'Пример: внести измерение',frequency:'daily',date:'2026-11-01',until_date:'',time:'09:00',timezone:'Europe/Moscow',utc_offset:'',enabled:true,medication_id:'',medication_name:'',scheduled_at:'2026-11-07T06:00:00Z',next_due_at:'2026-11-07T06:00:00Z',notes:'Вымышленное расписание. Уведомления в демо не отправляются.'}],carePreferences:{browser_enabled:false},
      findings:[window.HumanGenetics.checkFinding({title:'Демонстрационная запись из отчёта',category:'other',status:'recorded',result:'Вымышленный пример структуры результата. Клинического заключения здесь нет.',provider:'Поставщик (демо)',test_name:'Учебный отчёт',date_precision:'year',test_date:'2025',genes:'DEMO1',variants:'SYNTHETIC:no-call',provider_text:'Исходный текст в этом примере вымышлен.',method_version:'Демонстрационная версия'}, {},{documents:[]},new Date('2026-11-01T12:00:00Z')),window.HumanGenetics.checkFinding({title:'Пример метки из отчёта',category:'nutrition',status:'attention',result:'Учебный пример метки поставщика. Эта запись не является рекомендацией по питанию.',provider:'Лаборатория (демо)',date_precision:'unknown'}, {},{documents:[]},new Date('2026-11-02T12:00:00Z'))],
      observations,vitals,episodes,medical:medicalRecords,medications,diary:diaryRows,documents,
      revisions:[],timeline:[],recommendationIntakes:[],recommendationContexts:[],recommendationReports:[]
    };
    for(const [collection,kind] of Object.entries(window.HumanJournal.collections))for(const row of doc[collection]){const at=row.createdAt||row.created_at;if(at)doc.timeline.push(window.HumanJournal.event(kind,row,'create',at));}
    window.HumanCrypto.assertData(doc);
    return doc;
  }
  window.HumanDemo={create};
})();