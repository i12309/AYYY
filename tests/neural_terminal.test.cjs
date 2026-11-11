/* AYYY neural terminal: no-server, three-engine regression checks. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadProviders(extra = {}) {
  const window = {navigator:{gpu:extra.webgpu ? {} : undefined}};
  const context = vm.createContext({window,AbortController,DOMException,TextDecoder,console});
  vm.runInContext(read('terminal/providers.js'),context);
  return window.AYYY_TERMINAL_PROVIDERS;
}

test('approved CRT design keeps one full-screen view and its three mode controls', () => {
  const html = read('terminal/index.html');
  assert.match(html, /class="terminal-brand"/);
  assert.match(html, /Нейронный терминал/);
  assert.match(html, /SCANLINES/);
  assert.match(html, /GLOW/);
  assert.match(html, /class="telemetry"/);
  assert.match(html, /operator@ayyy:~\$/);
  assert.doesNotMatch(html, /<aside class="sidebar"/);
  assert.doesNotMatch(html, /<header class="topbar"/);
  for (const mode of ['public','webgpu','demo'])
    assert.match(html, new RegExp('data-engine="' + mode + '"'));
  assert.match(html, /src="providers\.js(?:\?v=[\w-]+)?"/);
  assert.match(html, /id="stopBtn"/);
  assert.match(html, /СБОЙ ПОДКЛЮЧЕНИЯ/);
  assert.match(html, /new URLSearchParams\(window.location.search\)/);
});

test('chat is volatile; the API/MLC engines are loaded only on demand', () => {
  const html = read('terminal/index.html');
  const provider = read('terminal/providers.js');
  assert.doesNotMatch(html + provider, /localStorage|sessionStorage|indexedDB\.open/);
  assert.match(html, /function getReply\(/);
  assert.match(provider, /@gradio\/client@2\.7\.2/);
  assert.match(provider, /@mlc-ai\/web-llm@0\.2\.87/);
  const route = read('src/neural-terminal-route.js');
  assert.match(route, /a.register\('ai'/);
  assert.match(route, /encodeURIComponent\(a.param.slice\(0,500\)\)/);
  assert.match(read('src/neural-terminal.css'), /body\[data-page="ai"\] \.sidebar/);
});

test('anonymous OVH sends only an explicit request and streams UTF-8 chunks', async () => {
  const provider = loadProviders();
  const requests=[];
  const stream = Buffer.from('data: {"choices":[{"delta":{"content":"Привет"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"!"}}]}\n\n' +
    'data: [DONE]\n\n');
  const engine = provider.createProviders({
    fetch:async (url,options)=>{
      requests.push({url,options});
      let sent=false;
      return {ok:true,body:{getReader(){return {
        async read(){if(sent)return {done:true};sent=true;return {done:false,value:stream};},
        releaseLock(){}
      };}}};
    },
    hasGPU:()=>false
  });
  const tokens=[];
  const answer=await engine.run('ovh',{
    prompt:'Здравствуйте',history:[],
    onText:s=>tokens.push(s),onStatus:()=>{}
  });
  assert.equal(answer,'Привет!');
  assert.deepEqual(tokens,['Привет','Привет!']);
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/ovh\.net\/v1\/chat\/completions$/);
  assert.equal(requests[0].options.credentials,'omit');
  assert.equal(requests[0].options.headers.Authorization,undefined);
  const body=JSON.parse(requests[0].options.body);
  assert.equal(body.model,'Qwen3.8-27B');
  assert.equal(body.messages[0].content,'Здравствуйте');
});

test('Hugging Face submits official Qwen Gradio positional inputs without a token', async () => {
  const provider=loadProviders();
  let connectArgs,submitted;
  const engine=provider.createProviders({
    importModule:async()=>({Client:{connect:async (...args)=>{
      connectArgs=args;
      return {
        view_api:async()=>({named_endpoints:{'/add_message':{}}}),
        submit:(endpoint,payload)=>{
          submitted={endpoint,payload};
          return {
            cancel(){},
            async *[Symbol.asyncIterator](){
              yield {type:'status',stage:'generating',position:0};
              yield {type:'data',data:[null,null,null,null,null,
                {__type__:'update',value:[{role:'user',content:'Hello'},
                  {role:'assistant',content:[{type:'text',content:'Ответ Qwen'}]}]}]};
            }
          };
        }
      };
    }}}),
    hasGPU:()=>false
  });
  const result=await engine.run('hf',{prompt:'Hello',history:[],onText:()=>{},onStatus:()=>{}});
  assert.equal(result,'Ответ Qwen');
  assert.equal(connectArgs[0],'Qwen/Qwen3-Demo');
  assert.equal(connectArgs[1].token,undefined);
  assert.equal(submitted.endpoint,'/add_message');
  assert.equal(submitted.payload.length,4);
});

test('WebGPU initializes a small model on demand and streams locally', async () => {
  const provider=loadProviders({webgpu:true});
  let created=0;
  const engine=provider.createProviders({
    hasGPU:()=>true,
    importModule:async()=>({
      prebuiltAppConfig:{model_list:[{model_id:'Qwen2-0.5B-Instruct-q4f16_1-MLC'}]},
      CreateMLCEngine:async ()=>{
        created++;
        return {interruptGenerate(){},
          chat:{completions:{create:async()=>({
            async *[Symbol.asyncIterator](){
              yield {choices:[{delta:{content:'GPU '}}]};
              yield {choices:[{delta:{content:'ответ'}}]};
            }
          })}}};
      }
    })
  });
  const run=()=>engine.run('webgpu',{prompt:'тест',history:[],onText:()=>{},onStatus:()=>{}});
  assert.equal(await run(),'GPU ответ');
  assert.equal(await run(),'GPU ответ');
  assert.equal(created,1,'model is reused without downloading it again');
});

test('bad external endpoint is a real error, not a simulated answer', async () => {
  const provider=loadProviders();
  const engine=provider.createProviders({
    fetch:async()=>({ok:false,status:429}),hasGPU:()=>false
  });
  await assert.rejects(()=>engine.run('ovh',{prompt:'Hi',history:[],onText:()=>{},onStatus:()=>{}}),
    /лимит/);
});

test('the static build includes the terminal directory but not retired focus/AI modules', () => {
  const build=read('src/build.py');
  assert.match(build, /'terminal'\)/);
  assert.match(build, /'neural-terminal-route.js'/);
  assert.match(build, /'neural-terminal.css'/);
  for (const name of ['connected.js', 'productivity.js', 'productivity.css'])
    assert.doesNotMatch(build, new RegExp(name.replace('.', '\\.')));
});
