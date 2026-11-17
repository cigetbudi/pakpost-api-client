// Presentation-only composition: state, API calls and mutation stay in App until their controllers are extracted.
// Each dependency is explicit so this component can be tested independently.
export function RequestWorkbench(props) {
  const {
    AUTH_OPTIONS, ChevronRight, Code2, Columns2, History, KeyValueEditor, LayoutPanelTop,
    Link2, METHODS, Pencil, RequestBody, ResponsePane, RetroSelect, Save,
    ScriptEditor, Send, ShieldCheck, Suspense, TextEditor, VariableAwareInput, VariableUrlInput,
    activeRequestName, activeTabId, apiKeyIn, apiKeyName, apiKeyValue, authType, basicPassword,
    basicUsername, bearerToken, beautifyBody, beautifyResult, beginRequestRename, binaryFile, body,
    busyAction, canEditCloud, cancelRequestRename, draggingRef, editingRequestName, finishRequestRename, formFields,
    format, headerCount, importCurlIntoCurrent, isCurl, isDarkAppearance, isReadOnlyCloudTab, loading,
    method, onSplitterEnd, onSplitterMove, openSaveAs, openSaveExampleDialog, openTabs, panesRef,
    params, postScript, preScript, reqTab, requestNameInputRef, resTab, resetSandboxRequest,
    responseExamples, responsePretty, responseText, responseType, result, rows, saveCurrent,
    scriptDiagnostic, scriptError, scriptJump, scriptLog, scriptTests, selectFormat, selectedWs,
    sendRequest, setApiKeyIn, setApiKeyName, setApiKeyValue, setAuthType, setBasicPassword, setBasicUsername,
    setBearerToken, setBinaryFile, setBody, setCurrentRequestName, setFormFields, setMethod, setNotice,
    setOpenTabs, setParams, setPostScript, setPreScript, setReqTab, setResTab, setResponsePretty,
    setRows, setScriptDiagnostic, setScriptError, setScriptJump, setSplit, setUrl, split,
    splitPercent, theme, url, variableUi,
  } = props;
  return <>
<div key={activeTabId} className="pp-tester pp-fade-content">
          <div className="pp-crumb"><span>REST</span><ChevronRight size={13}/>{editingRequestName ? <input
            ref={requestNameInputRef}
            className="pp-inline-request-name"
            aria-label="Request name"
            title="Press Enter to finish, Ctrl/Cmd+S to save, Escape to cancel"
            value={activeRequestName}
            maxLength={120}
            spellCheck={false}
            onChange={event=>setCurrentRequestName(event.target.value)}
            onBlur={finishRequestRename}
            onKeyDown={event=>{
              if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}
              if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelRequestRename();}
            }}
          /> : <button type="button" className="pp-editable-request-name" onClick={beginRequestRename} title="Rename request" aria-label={`Rename ${activeRequestName}`}><span>{activeRequestName}</span><Pencil size={13}/></button>}<span className="pp-crumb-sub">HTTP request</span>
            {isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)&&<span className="pp-sandbox-badge" title="QA sandbox: changes and scripts are session-only. Cloud is read-only."><ShieldCheck size={13}/> Sandbox · Cloud read-only</span>}
            <div className="pp-crumb-spacer"/><div className="pp-layout-actions"><span>Layout</span><button className={split === 'horizontal' ? 'active' : ''} onClick={() => setSplit('horizontal')} title="Request above response"><LayoutPanelTop size={16}/></button><button className={split === 'vertical' ? 'active' : ''} onClick={() => setSplit('vertical')} title="Request to left of response"><Columns2 size={16}/></button></div></div>
          <div className="pp-url-bar"><div className="pp-url-entry"><div className="pp-method-wrap"><RetroSelect className={`pp-method ${method.toLowerCase()}`} ariaLabel="HTTP method" value={method} options={METHODS.map(m=>({value:m,label:m,method:true}))} onChange={v=>{setMethod(v);setOpenTabs(t=>t.map(x=>x.id===activeTabId?{...x,method:v}:x));}}/></div><div className="pp-url-input"><Link2 size={16}/><VariableUrlInput value={url} onChange={setUrl} {...variableUi} onSend={sendRequest} onPaste={e=>{const raw=e.clipboardData.getData('text');if(isCurl(raw)){e.preventDefault();importCurlIntoCurrent(raw)}}}/></div></div><button className="pp-send" disabled={loading} onClick={sendRequest}>{loading ? <span className="spinner"/> : <Send size={15}/>} {loading ? 'Sending' : 'Send'} <span className="pp-send-shortcut">↵</span></button>{isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)&&<button type="button" className="pp-sandbox-reset" onClick={resetSandboxRequest} disabled={loading||busyAction} title="Discard sandbox changes and reload the request from Cloud"><History size={14}/> Reset</button>}
            <button className="pp-save-action" onClick={saveCurrent} disabled={busyAction||isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)} title={isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)?"Cloud save disabled in QA sandbox. Use Save as… for a Local copy.":"Save changes (Ctrl/Cmd+S)"}><Save size={15}/><span>Save</span></button><button className="pp-save-as-action" onClick={()=>openSaveAs()} title={isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)?"Save sandbox request as a separate Local copy":"Save as a new request"}>Save as…</button></div>
          <div className={`pp-panes pp-${split}`} ref={panesRef} style={{ '--pp-split': `${splitPercent}%` }}>
            <section className="pp-request-pane">
              <div className="pp-pane-heading"><span className="pp-pane-title"><Code2 size={15}/> Request</span><span className="pp-pane-meta">{method} · {headerCount} headers</span></div>
              <div className="pp-panel-tabs">
                {[[ 'params','Params' ],[ 'headers','Headers' ],[ 'body','Body' ],[ 'auth','Authorization' ],[ 'scripts','Scripts' ]].map(([id, name]) => <button key={id} className={reqTab === id ? 'active' : ''} onClick={() => setReqTab(id)}>{name}{id === 'headers' && headerCount > 0 && <span className="pp-tiny-count">{headerCount}</span>}</button>)}
              </div>
              <div className="pp-panel-body pp-request-body">
                {reqTab === 'params' && <KeyValueEditor kind="params" rows={params} onChange={setParams} variableUi={variableUi}/>}
                {reqTab === 'headers' && <KeyValueEditor kind="headers" rows={rows} onChange={setRows} variableUi={variableUi}/>}
                {reqTab === 'body' && <Suspense fallback={<div className="pp-feature-loading" role="status">Opening Body…</div>}><RequestBody format={format} selectFormat={selectFormat} beautifyBody={beautifyBody} body={body} setBody={setBody} theme={theme} variableUi={variableUi} formFields={formFields} setFormFields={setFormFields} binaryFile={binaryFile} setBinaryFile={setBinaryFile} setNotice={setNotice} TextEditor={TextEditor} /></Suspense>}
                {reqTab === 'auth' && <><div className="pp-form-caption"><span>REQUEST AUTHORIZATION</span><span>Applied when sending the request</span></div><div className="pp-auth-form pp-request-auth"><div className="pp-auth-select"><span>Auth type</span><RetroSelect ariaLabel="Auth type" value={authType} onChange={setAuthType} options={AUTH_OPTIONS}/></div>
                  {authType==='bearer'&&<label>Token<VariableAwareInput placeholder="{{AuthToken}} or paste bearer token" ariaLabel="Bearer token" value={bearerToken} onChange={value=>setBearerToken(value)} {...variableUi}/></label>}
                  {authType==='basic'&&<><label>Username<VariableAwareInput placeholder="{{username}} or username" ariaLabel="Basic auth username" value={basicUsername} onChange={value=>setBasicUsername(value)} {...variableUi}/></label><label>Password<VariableAwareInput placeholder="{{password}} or password" ariaLabel="Basic auth password" value={basicPassword} onChange={value=>setBasicPassword(value)} {...variableUi}/></label></>}
                  {authType==='apiKey'&&<><label>Key<VariableAwareInput placeholder="X-API-Key" ariaLabel="API key name" value={apiKeyName} onChange={value=>setApiKeyName(value)} {...variableUi}/></label><label>Value<VariableAwareInput placeholder="{{apiKey}}" ariaLabel="API key value" value={apiKeyValue} onChange={value=>setApiKeyValue(value)} {...variableUi}/></label><div className="pp-auth-select"><span>Add to</span><RetroSelect ariaLabel="API Key location" value={apiKeyIn} onChange={setApiKeyIn} options={[{value:'header',label:'Header'},{value:'query',label:'Query Param'}]}/></div></>}
                  {authType==='none'?<p>No automatic authorization. Custom Authorization headers remain available in Headers.</p>:<p>Use {'{{variable}}'} for credentials. Workspace saves only variable references for secrets; raw credentials are never written to Neon. Values are visible here by design—avoid screen sharing sensitive tokens.</p>}
                </div></>}
                {reqTab === 'scripts' && <Suspense fallback={<div className="pp-feature-loading" role="status">Opening Scripts…</div>}><ScriptEditor preScript={preScript} setPreScript={setPreScript} postScript={postScript} setPostScript={setPostScript} scriptDiagnostic={scriptDiagnostic} setScriptDiagnostic={setScriptDiagnostic} scriptError={scriptError} setScriptError={setScriptError} scriptJump={scriptJump} setScriptJump={setScriptJump} scriptLog={scriptLog} scriptTests={scriptTests} theme={theme} TextEditor={TextEditor} /></Suspense>}
              </div>
              <div className="pp-pane-footer"><ShieldCheck size={14}/><span>{isReadOnlyCloudTab(openTabs.find(t=>t.id===activeTabId),canEditCloud,selectedWs)?"Sandbox: edits and post-scripts do not change Cloud. Real API calls still execute.":"Public API tester · No sign-in needed"}</span><span className="pp-footer-tail">Proxy protected</span></div>
            </section>
            <div role="separator" aria-label="Resize request and response panels" aria-orientation={split === 'vertical' ? 'vertical' : 'horizontal'} className="pp-splitter" onPointerDown={e => { draggingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={onSplitterMove} onPointerUp={onSplitterEnd} onPointerCancel={onSplitterEnd}><span className="pp-splitter-handle"/></div>
            <ResponsePane
              result={result}
              loading={loading}
              resTab={resTab}
              onResTabChange={setResTab}
              responsePretty={responsePretty}
              onResponsePrettyChange={setResponsePretty}
              responseText={responseText}
              responseType={responseType}
              exampleCount={responseExamples.length}
              onBeautify={beautifyResult}
              onSaveExample={openSaveExampleDialog}
              onCopy={() => { navigator.clipboard?.writeText(responseText); setNotice('Response copied'); }}
              isDark={isDarkAppearance(theme)}
              Editor={TextEditor}
            />
          </div>
        </div>
  </>;
}
