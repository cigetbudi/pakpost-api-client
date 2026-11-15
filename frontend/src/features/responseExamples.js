const uid=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
  ? crypto.randomUUID()
  : `example-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const MAX_EXAMPLES=15;
const MAX_BODY=64000;

function safeObject(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}

function safeHeaders(headers){
  const input=safeObject(headers);
  const out={};
  for(const [key,value] of Object.entries(input)){
    if(!String(key||'').trim())continue;
    const sensitive=/^(set-cookie|cookie|authorization|proxy-authorization|x-api-key|x-access-token|x-auth-token|x-client-secret|x-signature)$/i.test(String(key));
    out[String(key)]=sensitive?'[REDACTED]':String(value??'');
  }
  return out;
}

export function summarizeResponseBody(body){
  const text=String(body||'').trim();
  if(!text)return '';
  try{
    const parsed=JSON.parse(text);
    const candidate=[parsed.responseDesc,parsed.message,parsed.detail,parsed.title,parsed.error,parsed.statusDesc,parsed.statusText]
      .find(value=>typeof value==='string'&&value.trim());
    return candidate?candidate.trim().slice(0,120):'';
  }catch{
    const line=text.split(/\r?\n/).find(Boolean)||'';
    return line.trim().slice(0,120);
  }
}

export function suggestExampleName(result){
  const status=Number(result?.statusCode||0);
  const reason=String(result?.reasonPhrase||'').trim();
  const summary=summarizeResponseBody(result?.body);
  const lowered=summary.toLowerCase();
  if(summary){
    if(/^success\b/i.test(summary))return summary;
    if(/^(failed?|error|invalid|duplicate|used|expired|forbidden|unauthorized|not found|over)/i.test(lowered)){
      return /^failed\b/i.test(summary)?summary:`Failed - ${summary}`;
    }
    if(status>=400)return `Failed - ${summary}`;
    return summary;
  }
  if(status>=200&&status<300)return reason&&reason.toLowerCase()!=='ok'?reason:'Success';
  if(status>=400)return reason?`Failed - ${reason}`:`Failed - HTTP ${status}`;
  return reason||`Example ${status||''}`.trim();
}

export function sanitizeResponseExamples(list){
  if(!Array.isArray(list))return [];
  return list.slice(0,MAX_EXAMPLES).map(example=>({
    id:String(example?.id||uid()),
    name:String(example?.name||'Example').trim().slice(0,140)||'Example',
    description:String(example?.description||'').slice(0,1000),
    statusCode:Math.max(0,Math.min(999,Number(example?.statusCode||0)||0)),
    reasonPhrase:String(example?.reasonPhrase||'').slice(0,120),
    headers:safeHeaders(example?.headers),
    body:String(example?.body||'').slice(0,MAX_BODY),
    contentType:String(example?.contentType||example?.headers?.['content-type']||example?.headers?.['Content-Type']||'text/plain').slice(0,200),
    elapsedMs:Math.max(0,Number(example?.elapsedMs||0)||0),
    isBinary:!!example?.isBinary,
    truncated:!!example?.truncated,
    createdAt:String(example?.createdAt||new Date().toISOString()),
  }));
}

export function createResponseExample(result,{name,description=''}={}){
  const headers=safeHeaders(result?.headers);
  return sanitizeResponseExamples([{
    id:uid(),
    name:String(name||suggestExampleName(result)),
    description,
    statusCode:Number(result?.statusCode||0)||0,
    reasonPhrase:String(result?.reasonPhrase||''),
    headers,
    body:String(result?.body||''),
    contentType:String(headers['content-type']||headers['Content-Type']||'text/plain'),
    elapsedMs:Number(result?.elapsedMs||0)||0,
    isBinary:!!result?.isBinary,
    truncated:!!result?.truncated||String(result?.body||'').length>MAX_BODY,
    createdAt:new Date().toISOString(),
  }])[0];
}

export function statusTone(statusCode){
  const code=Number(statusCode||0);
  if(code>=500)return 'bad';
  if(code>=400)return 'bad';
  if(code>=300)return 'warn';
  if(code>=200)return 'good';
  return 'neutral';
}

export function exampleToResult(example){
  if(!example)return null;
  return {
    statusCode:Number(example.statusCode||0)||0,
    reasonPhrase:String(example.reasonPhrase||''),
    headers:safeHeaders(example.headers),
    body:String(example.body||''),
    elapsedMs:Number(example.elapsedMs||0)||0,
    isBinary:!!example.isBinary,
    truncated:!!example.truncated,
  };
}

export function upsertResponseExample(list,example){
  const next=sanitizeResponseExamples(list);
  const existing=next.findIndex(item=>item.id===example.id || item.name.toLowerCase()===example.name.toLowerCase());
  if(existing>=0)next.splice(existing,1,example);
  else next.unshift(example);
  return sanitizeResponseExamples(next);
}
