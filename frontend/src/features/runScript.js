export async function runSandbox(code,phase,variables,request,response,localVariables={}) {
  if(!code?.trim())return {variables,logs:[],tests:[],error:null};
  const worker=new Worker(new URL('./sandbox.worker.js',import.meta.url),{type:'module'});
  const id=Date.now().toString(36);
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Script worker timed out.'))},9000);
    worker.onmessage=({data})=>{
      if(data.id!==id)return;
      clearTimeout(timeout);worker.terminate();
      data.ok ? resolve(data.data) : reject(new Error(data.error));
    };
    worker.onerror=(error)=>{clearTimeout(timeout);worker.terminate();reject(new Error(error.message||'Sandbox worker crashed'))};
    worker.postMessage({id,code,phase,variables,request,response,localVariables});
  });
}
