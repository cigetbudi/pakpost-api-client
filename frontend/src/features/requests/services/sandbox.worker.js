import {scriptDiagnostic, formatScriptDiagnostic} from './scriptDiagnostics.js';
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core';
import releaseVariant from '@jitl/quickjs-singlefile-browser-release-sync';

self.onmessage = async ({data}) => {
  const {id, code, phase, variables, collectionVariables, localVariables, request, response}=data;
  let runtime, vm;
  let sourceStartLine=1;
  try {
    const QuickJS = await newQuickJSWASMModuleFromVariant(releaseVariant);
    runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(48 * 1024 * 1024);
    runtime.setMaxStackSize(1024 * 1024);
    const deadline = Date.now() + 3500;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    vm = runtime.newContext();

    // Load only an allowlisted, locally installed package. No remote imports or host require().
    if (/\bcrypto-js\b/.test(code)) {
      const {default: cryptoJsSource} = await import('crypto-js/crypto-js.js?raw');
      const libraryResult = vm.evalCode(cryptoJsSource, 'crypto-js.js');
      if (libraryResult.error) {
        const error = vm.dump(libraryResult.error);
        libraryResult.error.dispose();
        throw new Error('Cannot load crypto-js: ' + JSON.stringify(error));
      }
      libraryResult.value.dispose();
    }

    const initial=JSON.stringify({phase,variables,collectionVariables,localVariables,request,response});
    // Code executes inside QuickJS, not the JS worker's host/global context.
    const prefix=String.raw`(function(){
      'use strict';
      const input=${initial};
      const __environment={...input.variables};
      const __collection={...(input.collectionVariables||{})};
      const __local={...input.localVariables};
      const __logs=[]; const __tests=[];
      const __request=input.request ? {...input.request,headers:{...(input.request.headers||{})}} : null;
      const __headerOverrides={};
      const __has=(o,k)=>Object.prototype.hasOwnProperty.call(o,String(k));
      const __allVars=()=>({...__collection,...__environment,...__local});
      const __get=(key)=>__has(__local,key)?__local[String(key)]:__has(__environment,key)?__environment[String(key)]:__collection[String(key)];
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
      if(__request)__request.headers=Object.assign(__headerMethods,__request.headers);
      const __status=input.response?.statusCode;
      const pm={
        environment:__envScope,
        collectionVariables:__collectionScope,
        variables:{
          get:__get,
          set:(k,v)=>{__local[String(k)]=String(v)},
          unset:(k)=>{delete __local[String(k)]},
          has:(k)=>__has(__local,k)||__has(__environment,k)||__has(__collection,k),
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
          to:{have:{status:(n)=>{if(__status!==n)throw Error('Expected status '+n+', received '+__status)}}}
        }:null,
        test:(name,fn)=>{try{fn();__tests.push({name:String(name),passed:true})}catch(e){__tests.push({name:String(name),passed:false,error:String(e&&e.message||e)})}},
        expect:(actual)=>({to:{
          equal:(expected)=>{if(actual!==expected)throw Error('Expected '+JSON.stringify(expected)+' but received '+JSON.stringify(actual))},
          have:{property:(name)=>{if(actual==null||!Object.prototype.hasOwnProperty.call(actual,name))throw Error('Expected property: '+name)}},
          be:{
            true:()=>{if(actual!==true)throw Error('Expected true')},
            false:()=>{if(actual!==false)throw Error('Expected false')},
            get null(){if(actual!==null)throw Error('Expected null but received '+JSON.stringify(actual));return true},
            get undefined(){if(actual!==undefined)throw Error('Expected undefined but received '+JSON.stringify(actual));return true}
          },
          not:{be:{
            get null(){if(actual===null)throw Error('Expected value not to be null');return true},
            get undefined(){if(actual===undefined)throw Error('Expected value not to be undefined');return true}
          }}
        }}),
        require:(name)=>require(name)
      };
      const require=(name)=>{
        if(name==='crypto-js') {
          if(!globalThis.CryptoJS)throw Error('crypto-js is not loaded');
          return globalThis.CryptoJS;
        }
        if(name==='pakpost:utils')return {now:()=>Date.now(),pick:(obj,keys)=>Object.fromEntries(keys.filter(k=>k in obj).map(k=>[k,obj[k]]))};
        throw Error('Package not available in Pakpost: '+name);
      };
      const console={
        log:(...args)=>__logs.push(args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')),
        warn:(...args)=>__logs.push('WARN: '+args.join(' ')),
        error:(...args)=>__logs.push('ERROR: '+args.join(' '))
      };
      let __scriptError=null;
      try{(function(){
`;
    sourceStartLine=prefix.split('\n').length;
    const suffix=String.raw`
})();}catch(e){__scriptError={name:String(e?.name||'Error'),message:String(e?.message||e),stack:String(e?.stack||'')}}
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
    const output=vm.dump(result.value);result.value.dispose();
    const data=JSON.parse(output);
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
