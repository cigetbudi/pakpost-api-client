// Request/response formatting and code preview. No React state or global persistence.
export function createRequestPresentationActions({
  binaryFile, body, buildRedactedCodeRequest, buildRequestCommand,
  buildRequestPreview, currentAuth, formFields, format, formatSource,
  getMessage, hasJsonComments, languageFromMime, method, params, result,
  rows, setBody, setFormat, setNotice, setPrettyResponse,
  setResponsePretty, url, varsFromEnv,
}) {
  const selectFormat=(v)=>{setFormat(v);};
  async function beautifyBody(){
    try{if(languageFromMime(format)==='json'&&hasJsonComments(body))throw Error('Remove JSON comments before Beautify (to avoid losing them).');setBody(await formatSource(body,languageFromMime(format)));setNotice('Body formatted');}
    catch(e){setNotice(`Cannot format: ${getMessage(e)}`)}
  }
  async function beautifyResult(){
    if(!result||result.error)return;
    try{setPrettyResponse(await formatSource(result.body||'',languageFromMime(result.headers?.['Content-Type']||result.headers?.['content-type']||'')));setResponsePretty(true);}
    catch(e){setNotice(`Cannot format response: ${getMessage(e)}`)}
  }
  const commandRequest = () => ({method,url,rows,params,body,format,formFields,binaryFile,auth:currentAuth()});
  function buildOutgoing(vars=varsFromEnv()) {
    return buildRequestCommand(commandRequest(), vars);
  }
  function buildCodeRequest(allowSecrets=false){
    if (allowSecrets) return buildOutgoing(varsFromEnv(true));
    return buildRedactedCodeRequest({request:commandRequest(),variableMap:varsFromEnv(false),allVariableMap:varsFromEnv(false)});
  }
  function codePreviewRequest(){
    return buildRequestPreview(commandRequest());
  }
  return { selectFormat, beautifyBody, beautifyResult,
    commandRequest, buildOutgoing, buildCodeRequest, codePreviewRequest };
}
