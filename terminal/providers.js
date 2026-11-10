/* AYYY CRT — optional browser-only inference providers. No server, keys or chat storage. */
(function(global) {
  'use strict';
  const URLS={
    gradio:'https://esm.sh/@gradio/client@2.7.2',
    webllm:'https://esm.run/@mlc-ai/web-llm@0.2.87',
    ovh:'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions'
  };
  const SPACE='Qwen/Qwen3-Demo';
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
    const hasGPU=injected.hasGPU || (()=>!!(global.navigator && global.navigator.gpu));
    let hfClient=null, hfName='', gpuEngine=null, gpuName='';
    let job=null,controller=null;
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
    async function webgpu({prompt,history,onText,onStatus,signal,modelPreference}) {
      if(!hasGPU())throw new Error('WebGPU недоступен. Нужен браузер с аппаратным ускорением.');
      onStatus('WEBGPU: загрузка WebLLM...');
      const lib=await load(URLS.webllm);
      if(!lib.CreateMLCEngine || !lib.prebuiltAppConfig)throw new Error('WebLLM не загрузился.');
      const catalog=lib.prebuiltAppConfig.model_list || [];
      const preferred=MODELS[modelPreference] || MODELS.qwen;
      let model=catalog.find(m=>m.model_id===preferred)||
        catalog.find(m=>m.model_id===MODELS.llama);
      if(!model)model=catalog.filter(m=>!(/vision|audio/i).test(m.model_id||''))
        .sort((a,b)=>(a.vram_required_MB||99999)-(b.vram_required_MB||99999))[0];
      if(!model)throw new Error('WebLLM: нет доступных текстовых моделей.');
      if(signal.aborted)throw new DOMException('Stopped','AbortError');
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
    return {run,abort,hasWebGPU:hasGPU};
  }
  global.AYYY_TERMINAL_PROVIDERS={createProviders,gradioAnswer,messages};
})(typeof window!=='undefined'?window:globalThis);