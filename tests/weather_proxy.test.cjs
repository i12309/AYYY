/* Run node tests/model.test.cjs --fixture first. Controlled transport; no live API calls. */
'use strict';
const assert=require('node:assert/strict');
const M=require('../weather/model.js');
const fixture=require('./forecast.fixture.json');
const store=new Map();
global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const response=()=>new Response(JSON.stringify(fixture));
let count=0;
async function test(name,fn){store.clear();await fn();count++;console.log('PASS '+name);}
(async()=>{
 await test('successful direct request skips proxy',async()=>{
   const urls=[];global.fetch=async url=>{urls.push(url);return response()};
   assert.equal((await M.forecast(M.CITIES[0])).live,true);assert.deepEqual(urls,[M.forecastURL(M.CITIES[0])]);
 });
 await test('successful direct request does not use demo proxy',async()=>{
   let calls=0;global.fetch=async()=>{calls++;return response()};
   await M.forecast(M.CITIES[0]);assert.equal(calls,1);
 });
 await test('network failure uses encoded URL and browser origin policy',async()=>{
   const calls=[];global.fetch=async(url,options)=>{calls.push({url,options});if(calls.length===1)throw new TypeError('offline');return response()};
   assert.equal((await M.forecast(M.CITIES[0])).live,true);
   const u=new URL(calls[1].url);assert.equal(u.origin,'https://corsproxy.io');assert.equal(u.searchParams.get('key'),'a5fca891');assert.equal(u.searchParams.get('url'),M.forecastURL(M.CITIES[0]));
   assert.equal(calls[1].options.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(calls[1].options.credentials,'omit');
 });
 await test('stalled direct connection switches after bounded timeout',async()=>{
   let calls=0;global.fetch=async(url,{signal})=>{if(++calls===2)return response();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))};
   await M.forecast(M.CITIES[0]);assert.equal(calls,2);
 });
 await test('user cancellation never launches proxy',async()=>{
   const controller=new AbortController();let calls=0;
   global.fetch=async()=>{calls++;controller.abort();throw new DOMException('Aborted','AbortError')};
   await assert.rejects(M.forecast(M.CITIES[0],controller.signal));assert.equal(calls,1);
 });
 await test('rate limit is not bypassed using another connection',async()=>{
   let calls=0;global.fetch=async()=>{calls++;return new Response('{}',{status:429})};
   await assert.rejects(M.forecast(M.CITIES[0]),/429/);assert.equal(calls,1);
 });
 await test('server failure can use proxy',async()=>{
   let calls=0;global.fetch=async()=>++calls===1?new Response('{}',{status:503}):response();
   await M.forecast(M.CITIES[0]);assert.equal(calls,2);
 });
 await test('proxy errors explain account setup without exposing credentials',async()=>{
   let calls=0;global.fetch=async()=>{if(++calls===1)throw new TypeError('offline');return new Response('{}',{status:403})};
   await assert.rejects(M.forecast(M.CITIES[0]),e=>e.message.includes('403')&&!e.message.includes('a5fca891'));assert.equal(calls,2);
 });
 await test('malformed forecast cannot replace saved weather',async()=>{
   global.fetch=async()=>new Response('{}');await assert.rejects(M.forecast(M.CITIES[0]));
 });
 await test('city search uses same fallback',async()=>{
   let calls=0;global.fetch=async url=>{if(++calls===1)throw new TypeError('offline');assert.equal(new URL(new URL(url).searchParams.get('url')).hostname,'geocoding-api.open-meteo.com');return new Response(JSON.stringify({results:[M.CITIES[1]]}))};
   assert.equal((await M.search('Москва'))[0].name,'Москва');
 });
 await test('demo fallback works without browser storage or setup',async()=>{
   const previous=global.localStorage;global.localStorage={getItem(){throw new Error('denied')}};
   let calls=0;global.fetch=async url=>{if(++calls===1)throw new TypeError('offline');assert.equal(new URL(url).searchParams.get('key'),'a5fca891');return response()};
   try{assert.equal((await M.forecast(M.CITIES[0])).live,true);assert.equal(calls,2);}finally{global.localStorage=previous;}
 });
 console.log(count+' proxy checks PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
