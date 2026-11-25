import {validateScriptInput} from './sandboxLimits.js';
export async function runSandbox(code,phase,variables,request,response,localVariables={},collectionVariables={},iterationData={},iterationInfo={}) {
  if(!code?.trim())return {variables:{...collectionVariables,...variables,...iterationData,...localVariables},environmentVariables:{...variables},collectionVariables:{...collectionVariables},localVariables:{...localVariables},logs:[],tests:[],error:null};
  const input={code,phase,variables,request,response,localVariables,collectionVariables,iterationData,iterationInfo};
  validateScriptInput(input);
  const worker=new Worker(new URL('./sandbox.worker.js',import.meta.url),{type:'module'});
  const id=Date.now().toString(36);
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{
      if(settled)return;
      settled=true;clearTimeout(timeout);worker.terminate();
      if(error)reject(error);else resolve(value);
    };
    const timeout=setTimeout(()=>finish(new Error('Script worker timed out.')),9000);
    worker.onmessage=({data})=>{
      if(data?.id!==id)return;
      data.ok ? finish(null,data.data) : finish(new Error(data.error));
    };
    worker.onerror=()=>finish(new Error('Sandbox worker crashed'));
    worker.onmessageerror=()=>finish(new Error('Sandbox worker message could not be decoded'));
    try{worker.postMessage({id,...input});}catch{finish(new Error('Sandbox worker input could not be sent'));}
  });
}
