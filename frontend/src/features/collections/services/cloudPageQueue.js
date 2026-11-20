const MAX_CONCURRENT_PAGES=3;
let active=0;
const queued=[];
const cancelled=()=>Object.assign(new Error('Request cancelled'),{name:'AbortError'});

function pump(){
  while(active<MAX_CONCURRENT_PAGES&&queued.length){
    const item=queued.shift();
    item.signal?.removeEventListener('abort',item.cancel);
    if(item.signal?.aborted){item.reject(cancelled());continue;}
    active++;
    Promise.resolve().then(item.run).then(item.resolve,item.reject).finally(()=>{
      active--;pump();
    });
  }
}

export function withCloudPageSlot(run,signal){
  if(signal?.aborted)return Promise.reject(cancelled());
  return new Promise((resolve,reject)=>{
    const item={run,resolve,reject,signal,cancel:null};
    item.cancel=()=>{
      const index=queued.indexOf(item);
      if(index>=0){queued.splice(index,1);reject(cancelled());}
    };
    signal?.addEventListener('abort',item.cancel,{once:true});
    queued.push(item);pump();
  });
}
