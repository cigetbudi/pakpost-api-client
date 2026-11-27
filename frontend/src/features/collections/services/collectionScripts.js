/** Shared collection source, kept separate from request scripts and variable scopes. */
export function collectionScripts(source) {
  const preScript=String(source?.preScript??'');
  const postScript=String(source?.postScript??'');
  if(preScript.length>64000||postScript.length>64000)throw Error('Collection scripts exceed 64000 characters each.');
  return {preScript,postScript};
}

/** Execute in one QuickJS phase. Request lexical declarations can shadow
 * collection helpers without colliding with their declarations. */
export function composeCollectionScript(collectionCode='',requestCode='') {
  if(!collectionCode.trim())return {code:requestCode,offset:0,collectionLines:0};
  if(!requestCode.trim())return {code:collectionCode,offset:0,collectionLines:collectionCode.split('\n').length};
  const collectionLines=collectionCode.split('\n').length;
  return {code:collectionCode+'\n;(function(){\n'+requestCode+'\n}).call(this);',offset:collectionLines+1,collectionLines};
}

/** Diagnostics in the combined program must not jump to the wrong request line. */
export async function runCollectionPhase(sandbox,collectionCode,requestCode,...args) {
  const {code,offset,collectionLines}=composeCollectionScript(collectionCode,requestCode);
  const result=await sandbox(code,...args);
  if(!result.error||!collectionLines)return result;
  const diagnostic=result.diagnostic;
  if(!diagnostic?.line)return {...result,error:'Collection / request script: '+result.error};
  if(diagnostic.line<=collectionLines){
    return {...result,error:'Collection script: '+result.error,
      diagnostic:{...diagnostic,line:null,column:null,message:'Collection script, line '+diagnostic.line+': '+diagnostic.message}};
  }
  const line=diagnostic.line-offset;
  return {...result,error:result.error.replace(/\(line \d+/,`(line ${Math.max(1,line)}`),
    diagnostic:{...diagnostic,line:line>0?line:null,column:line>0?diagnostic.column:null}};
}

export function collectionPostmanEvents(source) {
  const scripts=collectionScripts(source);
  return [['prerequest',scripts.preScript],['test',scripts.postScript]]
    .filter(([,code])=>code.trim()).map(([listen,code])=>({listen,script:{type:'text/javascript',exec:code.split('\n')}}));
}
