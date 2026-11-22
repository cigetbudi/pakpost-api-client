// Request renaming, snapshot/restore and cURL import. No network requests.
export function createRequestDraftEditorActions(dependencies) {
  const {
    EMPTY_HEADER, activeTabRef, binaryFile, body, cancelledRequestNameRef,
    currentAuth, documentation, draftsRef, formFields, format,
    getMessage, method, openTabs, originalRequestNameRef, params,
    parseCurl, postScript, preScript, prettyResponse, reqTab,
    resTab, responseExamples, responsePretty, result, rows,
    sanitizeResponseExamples, scriptDiagnostic, scriptError, scriptLog, scriptTests,
    setApiKeyIn, setApiKeyName, setApiKeyValue, setAuthType, setBasicPassword,
    setBasicUsername, setBearerToken, setBinaryFile, setBody, setDocumentation,
    setEditingRequestName, setFormFields, setFormat, setMethod, setNotice,
    setOpenTabs, setParams, setPostScript, setPreScript, setPrettyResponse,
    setReqTab, setResTab, setResponseExamples, setResponsePretty, setResult,
    setRows, setScriptDiagnostic, setScriptError, setScriptJump, setScriptLog,
    setScriptTests, setUrl, url,
  } = dependencies;

  function beginRequestRename() {
      const current=openTabs.find(tab=>tab.id===activeTabRef.current);
      originalRequestNameRef.current=current?.name||'Untitled Request';
      cancelledRequestNameRef.current=false;
      setEditingRequestName(true);
    }
  function setCurrentRequestName(nextName) {
      setOpenTabs(tabs=>tabs.map(tab=>tab.id===activeTabRef.current?{...tab,name:nextName}:tab));
    }
  function finishRequestRename() {
      if(cancelledRequestNameRef.current){cancelledRequestNameRef.current=false;return;}
      const current=openTabs.find(tab=>tab.id===activeTabRef.current);
      const trimmed=(current?.name||'').trim();
      setCurrentRequestName(trimmed||originalRequestNameRef.current||'Untitled Request');
      setEditingRequestName(false);
    }
  function cancelRequestRename() {
      cancelledRequestNameRef.current=true;
      setCurrentRequestName(originalRequestNameRef.current);
      setEditingRequestName(false);
    }
  function snapshot() { return { method, url, rows: rows.map(r => ({ ...r })), body, documentation, responsePretty, prettyResponse, format, formFields:formFields.map(r=>({...r})),binaryFile:{...binaryFile},preScript,postScript,responseExamples:sanitizeResponseExamples(responseExamples),scriptLog,scriptTests,scriptError,scriptDiagnostic, reqTab, resTab, result, params: params.map(p => ({ ...p })), ...currentAuth() }; }
  function restoreDraft(next) {
      setMethod(next.method||'GET');setUrl(next.url||'');setRows(next.rows||[{...EMPTY_HEADER}]);setBody(next.body||'');setDocumentation(next.documentation||'');
      setFormat(next.format||'application/json');setFormFields(next.formFields||[{key:'',value:''}]);
      setBinaryFile(next.binaryFile||{name:'',base64:''});
      setPreScript(next.preScript||'');setPostScript(next.postScript||'');setResponseExamples(sanitizeResponseExamples(next.responseExamples));
      setScriptLog(next.scriptLog||[]);setScriptTests(next.scriptTests||[]);setScriptError(next.scriptError||'');
      setScriptDiagnostic(next.scriptDiagnostic||null);setScriptJump(null);
      setReqTab(next.reqTab||'params');setResTab(next.resTab||'body');setResult(next.result||null);setResponsePretty(next.responsePretty??true);setPrettyResponse(next.prettyResponse||'');
      setParams(next.params||[{...EMPTY_HEADER}]);setAuthType(next.authType||'none');setBearerToken(next.bearerToken||'');
      setBasicUsername(next.basicUsername||'');setBasicPassword(next.basicPassword||'');
      setApiKeyName(next.apiKeyName||'X-API-Key');setApiKeyValue(next.apiKeyValue||'');setApiKeyIn(next.apiKeyIn||'header');
    }
  function stashActive() { draftsRef.current[activeTabRef.current] = snapshot(); }
  function importCurlIntoCurrent(value){
      try{
        const parsed=parseCurl(value);
        setMethod(parsed.method);setUrl(parsed.url);setRows(parsed.rows);setBody(parsed.body);setFormat(parsed.format);
        setParams(parsed.params);setFormFields(parsed.formFields);setBinaryFile({name:'',base64:''});
        setAuthType(parsed.authType);setBearerToken(parsed.bearerToken);
        setBasicUsername(parsed.basicUsername||'');setBasicPassword(parsed.basicPassword||'');
        setApiKeyName(parsed.apiKeyName||'X-API-Key');setApiKeyValue(parsed.apiKeyValue||'');setApiKeyIn(parsed.apiKeyIn||'header');
        setResult(null);setPrettyResponse('');
        setReqTab(parsed.body||parsed.formFields.some(r=>r.key)?'body':'params');
        setOpenTabs(t=>t.map(x=>x.id===activeTabRef.current?{...x,method:parsed.method,name:parsed.name,status:undefined}:x));
        setNotice(`cURL imported: ${parsed.method} ${parsed.url}. Review before sending.`);
      }catch(e){setNotice(`cURL import failed: ${getMessage(e)}`);}
    }

  return { beginRequestRename, setCurrentRequestName, finishRequestRename, cancelRequestRename, snapshot, restoreDraft, stashActive, importCurlIntoCurrent };
}
