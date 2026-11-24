import React from 'react';
import { RetroSelect } from '../../../components/ui/RetroSelect.jsx';
import {SCRIPT_SNIPPETS} from '../services/scriptSnippets.js';
import { AlertTriangle } from 'lucide-react';
import { isDarkAppearance } from '../../settings/services/appearance';

// Presentation only: script execution stays inside the isolated QuickJS worker.
export function ScriptEditor({ phase, onPhaseChange, preScript, setPreScript, postScript, setPostScript,
  scriptDiagnostic, setScriptDiagnostic, scriptError, setScriptError, scriptJump,
  setScriptJump, scriptLog, scriptTests, theme, TextEditor }) {
  const snippetMenu = (kind, value, update) => (
    <div className="pp-script-snippet">
      <span>Insert snippet</span>
      <RetroSelect
        ariaLabel={`Insert ${kind === 'pre' ? 'pre-request' : 'post-response'} snippet`}
        className="pp-script-snippet-select"
        value=""
        placeholder="Choose snippet…"
        options={SCRIPT_SNIPPETS[kind].map(([label, , group], index) => ({ label, group, value: String(index) }))}
        onChange={selected => {
          const snippet = SCRIPT_SNIPPETS[kind][Number(selected)];
          if (selected !== '' && snippet) update([value, snippet[1]].filter(Boolean).join('\n\n'));
        }}
      />
    </div>
  );
  return (
<div className="pp-script-panel">
                  {phase !== 'post' && <React.Fragment key="pre">
                  <div className="pp-script-label"><strong>Pre-request script</strong><span>Runs before resolving and sending HTTP request</span></div>
                  {snippetMenu('pre',preScript,value=>{setPreScript(value);setScriptDiagnostic(null);setScriptError('');})}
                  <TextEditor value={preScript} onChange={value=>{setPreScript(value);setScriptDiagnostic(previous=>previous?.phase==='pre'?null:previous);setScriptError('');}} lang="javascript" theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="180px" lint={false} allowComments scriptDiagnostics scriptDiagnostic={scriptDiagnostic?.phase==='pre'?scriptDiagnostic:null} jumpTo={scriptJump?.phase==='pre'?scriptJump:null}/>
                  </React.Fragment>}
                  {phase !== 'pre' && <React.Fragment key="post">
                  <div className="pp-script-label"><strong>Post-response script</strong><span>Runs after receiving the HTTP response</span></div>
                  {snippetMenu('post',postScript,value=>{setPostScript(value);setScriptDiagnostic(null);setScriptError('');})}
                  <TextEditor value={postScript} onChange={value=>{setPostScript(value);setScriptDiagnostic(previous=>previous?.phase==='post'?null:previous);setScriptError('');}} lang="javascript" theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="180px" lint={false} allowComments scriptDiagnostics scriptDiagnostic={scriptDiagnostic?.phase==='post'?scriptDiagnostic:null} jumpTo={scriptJump?.phase==='post'?scriptJump:null}/>
                  </React.Fragment>}
                  <p className="pp-script-note">Postman-compatible subset: require('crypto-js'), pm.request.url.path, pm.request.body.raw, pm.variables.get/set, pm.environment.get/set, pm.response.json(), pm.test(), console.log().
                  Scripts run in an isolated, time-limited QuickJS worker. External npm import is not enabled yet.</p>
                  {(scriptLog.length>0||scriptTests.length>0||scriptError)&&<div className="pp-script-console"><strong>Script results</strong>
                    {scriptLog.map((l,i)=><pre key={i}>{l}</pre>)}
                    {scriptTests.map((t,i)=><div key={i} className={t.passed?'pp-test-pass':'pp-test-fail'}>{t.passed?'✓':'✕'} {t.name}{t.error&&` — ${t.error}`}</div>)}
                    {scriptDiagnostic ? <button type="button" className="pp-script-diagnostic-item" disabled={!scriptDiagnostic.line}
                      title={scriptDiagnostic.line?'Jump to the failed script line':'Location unavailable'}
                      onClick={()=>{onPhaseChange?.(scriptDiagnostic.phase);setScriptJump({...scriptDiagnostic,serial:Date.now()});}}>
                      <AlertTriangle size={15}/><span><strong>{scriptDiagnostic.phase==='post'?'Post-response':'Pre-request'} · {scriptDiagnostic.name}</strong>
                        <span>{scriptDiagnostic.message}</span>
                        <small>{scriptDiagnostic.line?`Line ${scriptDiagnostic.line}${scriptDiagnostic.column?`, column ${scriptDiagnostic.column}`:''} · Click to navigate`:'Script location unavailable'}</small>
                      </span>
                    </button> : scriptError&&<div className="pp-inline-validation">{scriptError}</div>}
                  </div>}
                </div>
  );
}
