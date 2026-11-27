import {parseScriptOutput,validateScriptInput,SANDBOX_LIMITS} from './sandboxLimits.js';
import {scriptDiagnostic, formatScriptDiagnostic} from './scriptDiagnostics.js';
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core';
import releaseVariant from '@jitl/quickjs-singlefile-browser-release-sync';
import {installSandboxRandom} from './sandboxRandom.js';

self.onmessage = async ({data}) => {
  const {id, code, phase, variables, collectionVariables, localVariables, request, response, iterationData, iterationInfo}=data;
  let runtime, vm;
  let sourceStartLine=1;
  try {
    validateScriptInput({code,phase,variables,collectionVariables,localVariables,request,response,iterationData,iterationInfo});
    const QuickJS = await newQuickJSWASMModuleFromVariant(releaseVariant);
    runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(48 * 1024 * 1024);
    runtime.setMaxStackSize(1024 * 1024);
    const deadline = Date.now() + 3500;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    vm = runtime.newContext();

    // Load only an allowlisted, locally installed package. No remote imports or host require().
    if (/\bcrypto-js\b/.test(code)) {
      // CryptoJS captures native crypto when its UMD bundle initializes.
      installSandboxRandom(vm);
      const {default: cryptoJsSource} = await import('crypto-js/crypto-js.js?raw');
      const libraryResult = vm.evalCode(cryptoJsSource, 'crypto-js.js');
      if (libraryResult.error) {
        const error = vm.dump(libraryResult.error);
        libraryResult.error.dispose();
        throw new Error('Cannot load crypto-js: ' + JSON.stringify(error));
      }
      libraryResult.value.dispose();
    }

    const initial=JSON.stringify({phase,variables,collectionVariables,localVariables,request,response,iterationData,iterationInfo});
    // Code executes inside QuickJS, not the JS worker's host/global context.
    const prefix=String.raw`(function(){
      'use strict';
      const input=JSON.parse(${JSON.stringify(initial)});
      const __environment=Object.assign(Object.create(null),input.variables||{});
      const __collection=Object.assign(Object.create(null),input.collectionVariables||{});
      const __local=Object.assign(Object.create(null),input.localVariables||{});
      const __data=Object.assign(Object.create(null),input.iterationData||{});
      const __logs=[]; const __tests=[];
      const __record=(list,value)=>{if(list.length>=${SANDBOX_LIMITS.records})throw Error('Script record limit exceeded');list.push(value)};
      const __line=value=>String(value).slice(0,${SANDBOX_LIMITS.line});
      const __request=input.request ? {...input.request,headers:Object.assign(Object.create(null),input.request.headers||{})} : null;
      const __headerOverrides=Object.create(null);
      const __has=(o,k)=>Object.prototype.hasOwnProperty.call(o,String(k));
      const __allVars=()=>({...__collection,...__environment,...__data,...__local});
      const __get=(key)=>__has(__local,key)?__local[String(key)]:__has(__data,key)?__data[String(key)]:__has(__environment,key)?__environment[String(key)]:__collection[String(key)];
      const __collectionScope={
        get:(k)=>__collection[String(k)],
        set:(k,v)=>{__collection[String(k)]=String(v)},
        unset:(k)=>{delete __collection[String(k)]},
        has:(k)=>__has(__collection,k),
        clear:()=>{for(const k of Object.keys(__collection))delete __collection[k]},
        toObject:()=>({...__collection})
      };
      const __envScope={
        get:(k)=>__environment[String(k)],
        set:(k,v)=>{__environment[String(k)]=String(v)},
        unset:(k)=>{delete __environment[String(k)]},
        has:(k)=>__has(__environment,k),
        clear:()=>{for(const k of Object.keys(__environment))delete __environment[k]},
        toObject:()=>({...__environment})
      };
      const __headerLookup=(key)=>Object.keys(__request?.headers||{}).find(k=>k.toLowerCase()===String(key).toLowerCase());
      const __headerMethods={
        get:(key)=>__request?.headers?.[__headerLookup(key)],
        upsert:({key,value})=>{
          if(!__request)throw Error('pm.request is unavailable');
          const old=__headerLookup(key);
          if(old)delete __request.headers[old];
          __request.headers[String(key)]=String(value);
          __headerOverrides[String(key)]=String(value);
        },
        add:({key,value})=>__headerMethods.upsert({key,value})
      };
      if(__request)__request.headers=Object.assign(__request.headers,__headerMethods);
      const __status=input.response?.statusCode;
      const pm={
        iterationData:{get:k=>__data[String(k)],has:k=>__has(__data,k),toObject:()=>({...__data})},
        info:{iteration:input.iterationInfo?.iteration??0,iterationCount:input.iterationInfo?.iterationCount??1},
        environment:__envScope,
        collectionVariables:__collectionScope,
        variables:{
          get:__get,
          set:(k,v)=>{__local[String(k)]=String(v)},
          unset:(k)=>{delete __local[String(k)]},
          has:(k)=>__has(__local,k)||__has(__data,k)||__has(__environment,k)||__has(__collection,k),
          toObject:__allVars,
          replaceIn:(template)=>{
            let text=String(template);
            for(let i=0;i<8;i++){
              const next=text.replace(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g,(match,name)=>__get(name)??match);
              if(next===text)break;
              text=next;
            }
            return text;
          }
        },
        request:__request,
        response:input.response?{
          ...input.response,
          code:__status,
          responseTime:input.response.elapsedMs,
          json:()=>JSON.parse(input.response.body),
          text:()=>input.response.body,
          headers:{...(input.response.headers||{}),get:k=>Object.entries(input.response.headers||{}).find(([name])=>name.toLowerCase()===String(k).toLowerCase())?.[1],has:k=>Object.keys(input.response.headers||{}).some(name=>name.toLowerCase()===String(k).toLowerCase())},
          to:{have:{status:(n)=>{if(__status!==n)throw Error('Expected status '+n+', received '+__status)}}}
        }:null,
        test:(name,fn)=>{try{fn();__record(__tests,{name:__line(name),passed:true})}catch(e){__record(__tests,{name:__line(name),passed:false,error:__line(e&&e.message||e)})}},
        expect:(actual)=>{
          const equalDeep=(a,b)=>{
            if(a===b)return true;
            if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
            const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>__has(b,k)&&equalDeep(a[k],b[k]));
          };
          const chain=(value,negated=false,deep=false)=>{
            const check=(pass,message)=>{if(negated?pass:!pass)throw Error((negated?'Unexpected: ':'Expected: ')+message);return chain(value)};
            const same=(a,b)=>deep?equalDeep(a,b):a===b;
            const property=(key,...expected)=>{
              const exists=value!=null&&__has(Object(value),key);
              check(exists&&(!expected.length||same(value[key],expected[0])),'property '+key);
              return chain(exists?value[key]:undefined);
            };
            const lengthOf=n=>check(value!=null&&typeof value.length==='number'&&value.length===n,'length '+n);
            const typeOf=t=>check(t==='array'?Array.isArray(value):t==='null'?value===null:t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t,'type '+t);
            const range=(n,op)=>check(typeof value==='number'&&typeof n==='number'&&op(value,n),'numeric comparison');
            const api={
              get not(){return chain(value,!negated,deep)},get deep(){return chain(value,negated,true)},
              equal:n=>check(same(value,n),'equal value'),eql:n=>check(equalDeep(value,n),'deep equal value'),
              property,lengthOf,length:lengthOf,a:typeOf,an:typeOf,
              include:n=>check(typeof value==='string'?typeof n==='string'&&value.includes(n):Array.isArray(value)?value.some(x=>same(x,n)):value!==null&&typeof value==='object'&&n!==null&&typeof n==='object'&&!Array.isArray(n)?Object.keys(n).every(k=>__has(value,k)&&same(value[k],n[k])):false,'included value'),
              match:re=>check(typeof value==='string'&&re instanceof RegExp&&re.test(value),'matching pattern'),
              above:n=>range(n,(a,b)=>a>b),below:n=>range(n,(a,b)=>a<b),least:n=>range(n,(a,b)=>a>=b),most:n=>range(n,(a,b)=>a<=b),
              within:(lo,hi)=>check(typeof value==='number'&&typeof lo==='number'&&typeof hi==='number'&&value>=lo&&value<=hi,'value within range'),
              get true(){return check(value===true,'true')},get false(){return check(value===false,'false')},
              get null(){return check(value===null,'null')},get undefined(){return check(value===undefined,'undefined')},
              get ok(){return check(Boolean(value),'truthy value')},get exist(){return check(value!=null,'existing value')},
              get empty(){return check(typeof value==='string'||Array.isArray(value)?value.length===0:value!==null&&typeof value==='object'&&Object.keys(value).length===0,'empty value')}
            };
            for(const word of ['to','be','been','is','that','which','and','has','have','with','at','of','same'])Object.defineProperty(api,word,{get:()=>api});
            return api;
          };
          return chain(actual);
        },
        require:(name)=>require(name)
      };
      pm.expect.fail=(message)=>{throw Error(String(message||"Assertion failed"));};
      const require=(name)=>{
        if(name==='crypto-js') {
          if(!globalThis.CryptoJS)throw Error('crypto-js is not loaded');
          return globalThis.CryptoJS;
        }
        if(name==='pakpost:utils')return {now:()=>Date.now(),pick:(obj,keys)=>Object.fromEntries(keys.filter(k=>k in obj).map(k=>[k,obj[k]]))};
        throw Error('Package not available in Pakpost: '+name);
      };
      const console={
        log:(...args)=>__record(__logs,__line(args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '))),
        warn:(...args)=>__record(__logs,__line('WARN: '+args.join(' '))),
        error:(...args)=>__record(__logs,__line('ERROR: '+args.join(' ')))
      };
      let __scriptError=null;
      try{(function(){
`;
    sourceStartLine=prefix.split('\n').length;
    const suffix=String.raw`
})();}catch(e){__scriptError={name:__line(e?.name||'Error'),message:__line(e?.message||e),stack:__line(e?.stack||'')}}
      return JSON.stringify({
        variables:__allVars(),
        environmentVariables:__environment,
        collectionVariables:__collection,
        localVariables:__local,
        requestHeaderOverrides:__headerOverrides,
        logs:__logs,tests:__tests,scriptFault:__scriptError
      });
    })()`;
    const script=prefix+String(code)+suffix;
    const result=vm.evalCode(script,'pakpost-script.js');
    if(result.error){
      const fault=vm.dump(result.error);result.error.dispose();
      const diagnostic=scriptDiagnostic(fault,{phase,code,sourceStartLine});
      self.postMessage({id,ok:true,data:{logs:[],tests:[],error:formatScriptDiagnostic(diagnostic),diagnostic}});
      return;
    }
    let output;
    try {
      if(vm.typeof(result.value)!=='string')throw new Error('Invalid script output.');
      output=vm.getString(result.value);
    } finally {result.value.dispose();}
    const data=parseScriptOutput(output);
    if(data.scriptFault){
      data.diagnostic=scriptDiagnostic(data.scriptFault,{phase,code,sourceStartLine});
      data.error=formatScriptDiagnostic(data.diagnostic);
    } else data.error=null;
    delete data.scriptFault;
    self.postMessage({id,ok:true,data});
  }catch(error){
    // Worker failures (e.g. missing crypto-js) have no reliable script location.
    self.postMessage({id,ok:false,error:error?.message||String(error)});
  }
  finally{vm?.dispose();runtime?.dispose();}
};
