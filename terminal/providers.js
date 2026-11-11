/* AYYY CRT — optional browser-only inference providers. No server, keys or chat storage. */
(function(global) {
  'use strict';
  const URLS={
    gradio:'https://esm.sh/@gradio/client@2.7.2',
    webllm:'https://esm.run/@mlc-ai/web-llm@0.2.87',
    wllama:'https://esm.sh/@wllama/wllama@3.13.0',
    wllamaWasm:'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.13.0/esm/wasm/wllama.wasm',
    ovh:'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions'
  };
  const SPACE='Qwen/Qwen3-Demo';
  // GGUF is not an MLC/WebLLM artifact; Wllama loads the published Q4_1 build.
  const POCKET={repo:'taobao-mnn/MNN-Pocket-0.3B-GGUF',file:'MNN-Pocket-0.3B-Instruct-Q4_1.gguf'};
  const POCKET_BYTES=192*1024*1024;
  const POCKET_RESERVE=240*1024*1024; // approximate space for 192-MB file + cache overhead
  const MODELS={
    qwen:'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    llama:'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    qwen15:'Qwen2-1.5B-Instruct-q4f16_1-MLC'
  };
  function messages(history,prompt) {
    return [...(Array.isArray(history)?history:[])
      .filter(m=>m && ['user','assistant'].includes(m.role))
      .slice(-10).map(m=>({role:m.role,content:String(m.content).slice(0,2000)})),
      {role:'user',content:String(prompt).slice(0,2000)}];
  }
  function textPart(node) {
    if(typeof node==='string')return node;
    if(Array.isArray(node))return node.map(textPart).filter(Boolean).join('\n');
    if(!node || typeof node!=='object')return '';
    if(node.type==='tool' || node.role==='user')return '';
    if(node.__type__==='update')return textPart(node.value);
    if(node.type==='text')return textPart(node.content || node.text);
    if(node.role==='assistant')return textPart(node.content);
    return '';
  }
  function gradioAnswer(eventData) {
    const data=eventData && 'data' in Object(eventData)?eventData.data:eventData;
    if(!Array.isArray(data))return textPart(data);
    const response=data.length>=6?data[5]:data[0];
    const value=response?.__type__==='update'?response.value:response;
    if(Array.isArray(value)) {
      for(let i=value.length-1;i>=0;i--) {
        const m=value[i];
        if(m?.role==='assistant')return textPart(m.content);
        if(Array.isArray(m)&&m.length===2)return textPart(m[1]);
      }
    }
    return textPart(value);
  }
  function createProviders(injected={}) {
    const load=injected.importModule || (url=>import(url));
    const fetcher=injected.fetch || ((url,config)=>fetch(url,config));
    const hasGPU=injected.hasGPU || (()=>!!global.navigator?.gpu);
    const requestGPUAdapter=injected.requestGPUAdapter || (()=>global.navigator?.gpu?.requestAdapter?.());
    let hfClient=null, hfName='', gpuEngine=null, gpuName='', pocketEngine=null;
    let job=null,controller=null;
    let webLLMLibrary=null,wllamaLibrary=null;
    async function webLLMLib(){
      if(!webLLMLibrary)webLLMLibrary=load(URLS.webllm).catch(e=>{webLLMLibrary=null;throw e;});
      return webLLMLibrary;
    }
    async function wllamaLib(){
      if(!wllamaLibrary)wllamaLibrary=load(URLS.wllama).catch(e=>{wllamaLibrary=null;throw e;});
      return wllamaLibrary;
    }
    const interrupted=signal=>{
      if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    };
    function fastLocalSupport(modelPreference) {
      if(global.isSecureContext===false)
        return {ok:false,reason:'Нужна защищённая HTTPS-страница.'};
      if(modelPreference==='pocket') {
        if(typeof global.WebAssembly?.validate!=='function')
          return {ok:false,reason:'В браузере нет WebAssembly — запуск на CPU невозможен.'};
        if(typeof global.navigator?.storage?.getDirectory!=='function')
          return {ok:false,reason:'В браузере отсутствует OPFS — кэширование GGUF недоступно.'};
        return {ok:true,engine:'CPU / WebAssembly',details:'GGUF · CPU, 1 поток'};
      }
      if(!Object.hasOwn(MODELS,modelPreference))
        return {ok:false,reason:'Неизвестная модель.'};
      if(!hasGPU() || !global.navigator?.gpu?.requestAdapter && !injected.requestGPUAdapter)
        return {ok:false,reason:'WebGPU недоступен. Эта модель WebLLM не запускается на CPU. Выберите MNN-Pocket.'};
      return {ok:true,engine:'GPU / WebGPU',details:'WebLLM · требуется WebGPU'};
    }
    // Runs before any model-weight download, optionally exercising the small
    // WASM runtime itself. Passing this check never guarantees enough RAM, a
    // compatible GGUF architecture or successful inference.
    async function preflightLocalModel(modelPreference,{signal,runtimeTest=false,onStatus=()=>{}}={}) {
      const quick=fastLocalSupport(modelPreference);
      if(!quick.ok)return {...quick,cached:false,warnings:[]};
      const warnings=[];
      const fail=reason=>({ok:false,reason,engine:quick.engine,cached:false,warnings});
      const tell=text=>{interrupted(signal);onStatus(text);};
      try {
        tell('LOCAL: проверка возможностей браузера (без загрузки модели)...');
        if(modelPreference==='pocket') {
          interrupted(signal);
          await global.navigator.storage.getDirectory();
          let estimate=null;
          try{estimate=await global.navigator.storage.estimate?.();}catch(_){}
          if(Number.isFinite(global.navigator?.deviceMemory)&&global.navigator.deviceMemory<2)
            warnings.push('Браузер сообщает менее 2 ГБ RAM: запуск может завершиться ошибкой.');
          tell('CPU / GGUF: проверка сохранённых файлов...');
          const lib=await wllamaLib();
          if(typeof lib.Wllama!=='function'||typeof lib.ModelManager!=='function')
            return fail('Wllama не предоставил необходимые API.');
          const models=await new lib.ModelManager().getModels({includeInvalid:true});
          const match=models.find(m=>
            m?.url?.includes('/taobao-mnn/MNN-Pocket-0.3B-GGUF/resolve/') &&
            m.url.split('?')[0].endsWith('/'+POCKET.file));
          const cached=match?.validate?.()==='valid';
          if(match && !cached)
            warnings.push('Найдена неполная загрузка — потребуется загрузить модель заново.');
          if(!cached && Number.isFinite(estimate?.quota)&&Number.isFinite(estimate?.usage)) {
            const available=estimate.quota-estimate.usage;
            if(available<POCKET_RESERVE)
              return fail('Недостаточно места в хранилище браузера: свободно около '+
                Math.max(0,Math.floor(available/(1024*1024)))+
                ' МБ, для GGUF желательно не менее 240 МБ.');
          }
          if(runtimeTest&&!pocketEngine) {
            tell('CPU / GGUF: пробный запуск WASM-движка без весов (192 МБ пока не скачиваются)...');
            const tester=new lib.Wllama({default:URLS.wllamaWasm},{allowOffline:true});
            tester.setCompat?.('default');
            try{
              if(typeof tester.testBackendOps!=='function')
                return fail('Текущий Wllama не поддерживает тест вычислительного движка.');
              const result=await tester.testBackendOps(['-o','ADD']);
              if(!result?.success)return fail('Пробный запуск Wllama завершился ошибкой ('+
                (result?.retcode??'нет кода')+'). Модель не будет скачана.');
            }finally{try{await tester.exit?.();}catch(_){}}
          }
          interrupted(signal);
          return {
            ok:true,engine:'CPU / WASM (1 поток)',cached:!!cached,
            modelName:'MNN-Pocket-0.3B Q4_1',sizeBytes:POCKET_BYTES,
            warnings:[...warnings,'Проверка не гарантирует совместимость GGUF и достаточный объём оперативной памяти.']
          };
        }
        tell('WebGPU: проверка адаптера и устройства...');
        const adapter=await requestGPUAdapter();
        if(!adapter)return fail('WebGPU API есть, но браузер не смог получить GPU-адаптер. WebLLM не запустится.');
        try{
          if(typeof adapter.requestDevice!=='function')
            return fail('GPU-адаптер не поддерживает создание вычислительного устройства.');
          const device=await adapter.requestDevice();
          if(!device)return fail('Не удалось создать GPU-устройство.');
          device.destroy?.();
        }catch(error){
          return fail('GPU-устройство недоступно: '+(error?.message||String(error)));
        }
        tell('WebLLM: проверка наличия модели в каталоге...');
        const lib=await webLLMLib();
        if(!lib.prebuiltAppConfig||typeof lib.CreateMLCEngine!=='function')
          return fail('WebLLM не загрузился или API недоступен.');
        const id=MODELS[modelPreference];
        const model=lib.prebuiltAppConfig.model_list?.find(m=>m.model_id===id);
        if(!model)return fail('Выбранной модели нет в каталоге WebLLM. Автоматическая замена отключена.');
        let cached=false;
        try{
          if(typeof lib.hasModelInCache==='function')
            cached=!!await lib.hasModelInCache(id,lib.prebuiltAppConfig);
        }catch(error){warnings.push('Не удалось проверить локальный кэш: '+(error?.message||String(error)));}
        if(model.vram_required_MB)
          warnings.push('Нужно приблизительно '+Math.round(model.vram_required_MB)+
            ' МБ видеопамяти; браузер не сообщает её точный свободный объём.');
        else warnings.push('Свободный объём видеопамяти недоступен для предварительной оценки.');
        interrupted(signal);
        return {ok:true,engine:'GPU / WebGPU',cached,modelName:id,
          sizeBytes:null,warnings};
      }catch(error){
        if(signal?.aborted||error?.name==='AbortError')throw error;
        return fail('Предварительная проверка не пройдена: '+(error?.message||String(error)));
      }
    }
    const abort=()=>{
      controller?.abort();
      try {job?.cancel?.();}catch(_){}
      try {gpuEngine?.interruptGenerate?.();}catch(_){}
      job=null;
    };
    async function ovh({prompt,history,onText,onStatus,signal}) {
      onStatus('PUBLIC / OVH: соединение...');
      const response=await fetcher(URLS.ovh,{
        method:'POST',mode:'cors',credentials:'omit',signal,
        headers:{'Content-Type':'application/json','Accept':'text/event-stream'},
        body:JSON.stringify({model:'Qwen3.8-27B',messages:messages(history,prompt),
          max_tokens:640,stream:true})
      });
      if(!response.ok)throw new Error('OVH: HTTP '+response.status+
        (response.status===429?' — превышен лимит анонимных запросов.':''));
      if(!response.body?.getReader)throw new Error('OVH: потоковый ответ недоступен.');
      const reader=response.body.getReader(),decoder=new TextDecoder();
      let buffer='',answer='';
      onStatus('PUBLIC / OVH: генерация...');
      try {
        while(true) {
          const {value,done}=await reader.read();
          if(done)break;
          if(signal.aborted)throw new DOMException('Stopped','AbortError');
          buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
          let idx;
          while((idx=buffer.indexOf('\n\n'))!==-1) {
            const packet=buffer.slice(0,idx);buffer=buffer.slice(idx+2);
            for(const line of packet.split('\n')) {
              if(!line.startsWith('data:'))continue;
              const raw=line.slice(5).trim();if(raw==='[DONE]')continue;
              let data;try{data=JSON.parse(raw);}catch(_){continue;}
              if(data.error)throw new Error('OVH: '+(data.error.message||String(data.error)));
              const part=data?.choices?.[0]?.delta?.content;
              if(typeof part==='string' && part){answer+=part;onText(answer);}
            }
          }
        }
      }finally{try{reader.releaseLock();}catch(_){}}
      if(!answer.trim())throw new Error('OVH: модель не вернула текст.');
      return answer;
    }
    async function hf({prompt,history,onText,onStatus,signal,space}) {
      const name=String(space||SPACE).trim();
      if(!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(name))
        throw new Error('Space ID должен иметь формат owner/name.');
      onStatus('PUBLIC / HF: подключение '+name+'...');
      if(!hfClient || hfName!==name) {
        const module=await load(URLS.gradio);
        if(!module.Client)throw new Error('Не удалось загрузить Gradio SDK.');
        hfClient=await module.Client.connect(name,{events:['data','status'],record_history:false});
        hfName=name;
      }
      if(signal.aborted)throw new DOMException('Stopped','AbortError');
      const api=await hfClient.view_api({all_endpoints:true});
      const named=api?.named_endpoints||api?.api?.named_endpoints||{};
      const endpoints=Object.keys(named);
      const endpoint=endpoints.find(x=>/^\/add_message/.test(x))||
        endpoints.find(x=>/^\/chat$/.test(x))||
        endpoints.find(x=>/^\/predict$/.test(x));
      if(!endpoint)throw new Error('HF: в Space нет поддерживаемого API чата; попробуйте OVH.');
      let payload;
      if(name===SPACE && endpoint.startsWith('/add_message')) {
        const transcript=messages(history,prompt).map(m=>
          (m.role==='user'?'Пользователь':'Ассистент')+': '+m.content).join('\n\n').slice(-7000);
        payload=[transcript,{model:'qwen3-8b',sys_prompt:'You are a helpful assistant.',thinking_budget:1},
          {enable_thinking:false},{conversation_id:'',conversation_contexts:{},conversations:[]}];
      } else {
        payload=[prompt,messages(history,prompt).slice(0,-1)];
      }
      onStatus('PUBLIC / HF: ожидание очереди...');
      const running=hfClient.submit(endpoint,payload);
      job=running;
      const stop=()=>{try{running.cancel();}catch(_){}};
      signal.addEventListener('abort',stop,{once:true});
      let answer='';
      try {
        for await(const event of running){
          if(signal.aborted)throw new DOMException('Stopped','AbortError');
          if(event.type==='status'){
            if(event.stage==='error')throw new Error('HF: '+(event.message||'ошибка очереди.'));
            if(Number.isFinite(event.position))onStatus('PUBLIC / HF: очередь '+event.position);
          }
          if(event.type==='data'){
            const candidate=gradioAnswer(event.data);
            if(candidate && candidate!==answer){answer=candidate;onText(answer);}
          }
        }
      }finally{
        signal.removeEventListener('abort',stop);
        if(job===running)job=null;
      }
      if(!answer.trim())throw new Error('HF: ответ пустой или формат API изменился.');
      return answer;
    }
    async function pocket({prompt,history,onText,onStatus,signal}) {
      onStatus('GGUF / MNN-POCKET: подготовка Wllama...');
      if(!pocketEngine) {
        const lib=await wllamaLib();
        if(signal.aborted)throw new DOMException('Stopped','AbortError');
        if(typeof lib.Wllama!=='function')throw new Error('Не удалось загрузить Wllama.');
        const next=new lib.Wllama({default:URLS.wllamaWasm},{allowOffline:true});
        next.setCompat?.('default');
        try {
          await next.loadModelFromHF(POCKET,{
            n_ctx:2048,n_threads:1,signal,
            progressCallback:({loaded,total})=>{
              if(signal.aborted)return;
              const percent=total>0?Math.round(loaded/total*100)+'%':'загрузка...';
              onStatus('GGUF / MNN-POCKET: '+percent+' / 192 МБ');
            }
          });
          if(signal.aborted)throw new DOMException('Stopped','AbortError');
          pocketEngine=next;
        }catch(error){
          try{await next.exit();}catch(_){}
          throw error;
        }
      }
      onStatus('GGUF / MNN-POCKET: генерация...');
      const stream=await pocketEngine.createChatCompletion({
        messages:[{role:'system',content:'Answer in the language of the user.'},
          ...messages(history,prompt)],
        max_tokens:384,temperature:0.7,top_p:0.8,top_k:20,
        stream:true,abortSignal:signal
      });
      let answer='';
      for await(const chunk of stream){
        if(signal.aborted)throw new DOMException('Stopped','AbortError');
        const part=chunk?.choices?.[0]?.delta?.content;
        if(typeof part==='string'&&part){answer+=part;onText(answer);}
      }
      if(!answer.trim())throw new Error('GGUF: модель не вернула текст.');
      return answer;
    }
    async function webgpu({prompt,history,onText,onStatus,signal,modelPreference}) {
      // Mandatory lightweight check even if the UI preflight was bypassed.
      const check=await preflightLocalModel(modelPreference,{signal,onStatus});
      if(!check.ok)throw new Error(check.reason);
      if(modelPreference==='pocket')return pocket({prompt,history,onText,onStatus,signal});
      onStatus('WEBGPU: загрузка WebLLM...');
      const lib=await webLLMLib();
      const model=lib.prebuiltAppConfig.model_list.find(m=>m.model_id===MODELS[modelPreference]);
      if(!model)throw new Error('Выбранной модели нет в каталоге WebLLM.');
      interrupted(signal);
      if(!gpuEngine || gpuName!==model.model_id){
        gpuEngine=await lib.CreateMLCEngine(model.model_id,{
          initProgressCallback:p=>onStatus('WEBGPU: '+(p.text||'загрузка')+
            (Number.isFinite(p.progress)?' '+Math.round(p.progress*100)+'%':''))
        });
        gpuName=model.model_id;
      }
      if(signal.aborted)throw new DOMException('Stopped','AbortError');
      onStatus('WEBGPU / '+gpuName+': генерация...');
      const stream=await gpuEngine.chat.completions.create({
        messages:[{role:'system',content:'Answer in the language of the user.'},
          ...messages(history,prompt)],max_tokens:512,temperature:0.7,stream:true
      });
      let answer='';
      for await(const chunk of stream) {
        if(signal.aborted)throw new DOMException('Stopped','AbortError');
        const part=chunk?.choices?.[0]?.delta?.content;
        if(typeof part==='string'&&part){answer+=part;onText(answer);}
      }
      if(!answer.trim())throw new Error('WebGPU: пустой ответ.');
      return answer;
    }

    // Inspect only the model caches owned by Wllama and WebLLM.
    // Never clear Cache Storage, OPFS or IndexedDB for the whole Pages origin:
    // other AYYY services and other GitHub Pages projects may share this origin.
    async function listCachedModels() {
      const models=[],errors=[];
      try {
        const lib=await wllamaLib();
        if(typeof lib.ModelManager!=='function')throw new Error('ModelManager недоступен.');
        const cached=await new lib.ModelManager().getModels({includeInvalid:true});
        for(const item of cached) {
          if(!item || typeof item.url!=='string' || item.size===-1)continue;
          const status=item.validate?.() || 'invalid';
          const filename=decodeURIComponent(item.url.split('/').pop()?.split('?')[0] || item.url);
          const physicalBytes=Array.isArray(item.files) ?
            item.files.reduce((n,file)=>n+Math.max(0,Number(file.size)||0),0) : 0;
          models.push({
            engine:'wllama',id:item.url,name:filename,
            cache:'OPFS / GGUF',
            sizeBytes:physicalBytes || Math.max(0,Number(item.size)||0),
            status:status==='valid'?'ready':'incomplete'
          });
        }
      }catch(error){
        errors.push('GGUF / Wllama: '+(error?.message||String(error)));
      }
      try {
        const lib=await webLLMLib();
        if(typeof lib.hasModelInCache!=='function')throw new Error('Cache API библиотеки недоступен.');
        const all=lib.prebuiltAppConfig?.model_list||[];
        const unique=[...new Map(all.filter(m=>m?.model_id).map(m=>[m.model_id,m])).values()];
        let failures=0;
        for(let i=0;i<unique.length;i+=8){
          await Promise.all(unique.slice(i,i+8).map(async model=>{
            try{
              if(await lib.hasModelInCache(model.model_id,lib.prebuiltAppConfig)){
                models.push({
                  engine:'webllm',id:model.model_id,name:model.model_id,
                  cache:'Cache Storage / WebLLM',
                  sizeBytes:null,status:'ready'
                });
              }
            }catch(_){failures++;}
          }));
        }
        if(failures)errors.push('WebLLM: не удалось проверить '+failures+' моделей каталога.');
      }catch(error){
        errors.push('WebLLM: '+(error?.message||String(error)));
      }
      let originUsage=null;
      try {
        const usage=(await global.navigator?.storage?.estimate?.())?.usage;
        if(Number.isFinite(usage))originUsage=usage;
      }catch(_){}
      models.sort((a,b)=>a.engine.localeCompare(b.engine)||a.name.localeCompare(b.name));
      return {models,errors,originUsage};
    }
    async function deleteCachedModel({engine,id}) {
      if(controller)throw new Error('Остановите текущую генерацию или загрузку модели.');
      if(typeof id!=='string' || !id)throw new Error('Не выбрана модель.');
      if(engine==='wllama') {
        const lib=await wllamaLib();
        const cached=await new lib.ModelManager().getModels({includeInvalid:true});
        const model=cached.find(m=>m.url===id);
        if(!model)throw new Error('Эта GGUF-модель уже отсутствует в хранилище.');
        if(pocketEngine){
          await pocketEngine.exit();
          pocketEngine=null;
        }
        await model.remove();
      }else if(engine==='webllm') {
        const lib=await webLLMLib();
        const registered=lib.prebuiltAppConfig?.model_list?.some(m=>m.model_id===id);
        if(!registered)throw new Error('Модель не найдена в каталоге WebLLM.');
        if(typeof lib.deleteModelAllInfoInCache!=='function')
          throw new Error('Удаление моделей не поддерживается текущей версией WebLLM.');
        if(gpuName===id && gpuEngine){
          await gpuEngine.unload?.();
          gpuEngine=null;gpuName='';
        }
        await lib.deleteModelAllInfoInCache(id,lib.prebuiltAppConfig);
      }else{
        throw new Error('Неизвестный тип модели.');
      }
    }
    async function run(name,params) {
      if(!['ovh','hf','webgpu'].includes(name))throw new Error('Неизвестный движок.');
      const ctrl=new AbortController();
      controller=ctrl;
      const f=()=>ctrl.abort();
      params.signal?.addEventListener('abort',f,{once:true});
      try {
        if(params.signal?.aborted)ctrl.abort();
        const args={...params,signal:ctrl.signal};
        return await ({ovh,hf,webgpu})[name](args);
      }finally{
        params.signal?.removeEventListener('abort',f);
        if(controller===ctrl)controller=null;
      }
    }
    return {run,abort,hasWebGPU:hasGPU,fastLocalSupport,preflightLocalModel,listCachedModels,deleteCachedModel,isBusy:()=>!!controller};
  }
  global.AYYY_TERMINAL_PROVIDERS={createProviders,gradioAnswer,messages};
})(typeof window!=='undefined'?window:globalThis);