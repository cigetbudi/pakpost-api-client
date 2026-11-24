import {ResponseAnalysis} from './ResponseAnalysis.jsx';
import {useEffect, useState} from 'react';
import {Spinner} from '../ui/AsyncFeedback.jsx';
import React from 'react';
import {
  ArrowDownToLine,
  Bolt,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Clock3,
  Copy,
  Save,
  Terminal,
  WandSparkles,
  X,
} from 'lucide-react';
import { statusTone } from '../../features/requests/services/responseExamples.js';
import { languageFromMime } from '../../features/requests/services/requestTools.js';

/**
 * Read-only response view. All state lives in the workbench owner; this
 * component only renders the response and forwards user-initiated actions.
 * Passing the lazy Editor avoids downloading CodeMirror during startup.
 */
export function ResponsePane({
  mode = 'expanded',
  onModeChange,
  result,
  loading,
  resTab,
  onResTabChange,
  responsePretty,
  onResponsePrettyChange,
  responseText,
  responseType,
  exampleCount,
  onBeautify,
  onSaveExample,
  onCopy,
  isDark,
  Editor,
  variableUi,
}) {
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{
    if(!loading){setElapsed(0);return;}
    const start=performance.now();setElapsed(0);
    const timer=setInterval(()=>setElapsed(Math.floor((performance.now()-start)/100)/10),100);
    return()=>clearInterval(timer);
  },[loading]);
  const hasResponse = !!result && !result.error;
  const headerCount = hasResponse ? Object.keys(result.headers || {}).length : 0;
  const bodySize = hasResponse ? new Blob([result.body || '']).size : 0;

  return (
    <section className="pp-response-pane">
      <div className="pp-pane-heading pp-response-heading">
        <button type="button" className="pp-pane-title pp-response-toggle" aria-expanded={mode !== 'collapsed'} onClick={()=>onModeChange?.(mode === 'collapsed' ? 'expanded' : 'collapsed')} title={mode === 'collapsed' ? 'Expand response' : 'Collapse response'}>
          {mode === 'collapsed' ? <ChevronRight size={15}/> : <ChevronDown size={15}/>} <Bolt size={14}/> Response
        </button>
        {hasResponse ? (
          <div className="pp-response-metrics">
            <span className={`pp-status ${statusTone(result.statusCode)}`}>
              <span className="pp-status-dot" />
              {result.statusCode} {result.reasonPhrase}
            </span>
            <span><Clock3 size={13} /> {result.elapsedMs} ms</span>
            <span><ArrowDownToLine size={13} /> {bodySize.toLocaleString()} B</span>
          </div>
        ) : <span className="pp-pane-meta">{loading ? <><Spinner size={13}/> Sending · {elapsed.toFixed(1)} s</> : result?.error ? (result.cancelled?'Cancelled':'Request failed') : 'Awaiting response'}</span>}
        <button type="button" className="pp-response-focus" aria-label={mode === 'maximized' ? 'Restore response panel' : 'Maximize response panel'} title={mode === 'maximized' ? 'Restore response panel' : 'Maximize response panel'} onClick={()=>onModeChange?.(mode === 'maximized' ? 'expanded' : 'maximized')}>
          {mode === 'maximized' ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
        </button>
      </div>

      {mode !== 'collapsed' && <>
      <div className="pp-panel-tabs">
        <button className={resTab === 'body' ? 'active' : ''} aria-pressed={resTab === 'body'} onClick={() => onResTabChange('body')}>Body</button>
        <button className={resTab === 'headers' ? 'active' : ''} aria-pressed={resTab === 'headers'} onClick={() => onResTabChange('headers')}>
          Headers{hasResponse && <span className="pp-tiny-count">{headerCount}</span>}
        </button>
        <button aria-pressed={resTab === 'analysis'} className={resTab === 'analysis' ? 'active' : ''} onClick={()=>onResTabChange('analysis')}>Analysis</button>
        <div className="pp-panel-tabs-spacer" />
        <button className="pp-copy-response" disabled={!hasResponse||resTab==='analysis'} onClick={onBeautify} title="Beautify response">
          <WandSparkles size={14} /> Beautify
        </button>
        <button className="pp-copy-response" disabled={!hasResponse||resTab==='analysis'} onClick={() => onResponsePrettyChange(value => !value)} title="Toggle raw/pretty">
          {responsePretty ? 'Pretty' : 'Raw'}
        </button>
        <button className="pp-copy-response" disabled={!hasResponse} onClick={onSaveExample} title="Save response example">
          <Save size={14} /> Save example
        </button>
        <button className="pp-copy-response" disabled={!hasResponse||resTab==='analysis'} onClick={onCopy} title="Copy response">
          <Copy size={14} /> Copy
        </button>
      </div>

      <div className="pp-panel-body pp-response-body" style={resTab==='analysis'?{display:'none'}:undefined}>
        {!result ? (
          <div className="pp-response-empty">
            <div className="pp-response-empty-symbol">{loading?<Spinner size={28}/>:<Terminal size={28}/>}</div>
            <strong>{loading ? 'Sending request…' : 'Ready to send a request'}</strong>
            <p>{loading ? 'Waiting for the request to finish.' : 'Enter a URL, configure your request, and hit Send. Your response will appear here.'}</p>
            <span>⌘ / Ctrl + Enter</span>
          </div>
        ) : result.error ? (
          <div className="pp-response-error">
            <div><X size={18} /></div>
            <strong>{result.cancelled ? 'Request cancelled' : 'Request failed'}</strong>
            <p>{result.error}</p>
          </div>
        ) : (
          <>
            <div className="pp-response-code" hidden={resTab==='analysis'}>
              <Editor
                readOnly
                outputTools
                value={responseText}
                lang={resTab === 'headers' ? 'json' : languageFromMime(responseType)}
                theme={isDark ? 'dark' : 'light'}
                minHeight="250px"
              />
            </div>
            {result.truncated && <div className="pp-response-warning">Output truncated to 1 MB.</div>}
            {result.isBinary && <div className="pp-response-warning">Binary content displayed as Base64.</div>}
          </>
        )}
      </div>

      </>}
      <div style={{display:mode!=='collapsed'&&resTab==='analysis'?'flex':'none',flex:1,minHeight:0,overflow:'auto'}}><ResponseAnalysis result={result} variableUi={variableUi}/></div>
      {mode!=='collapsed'&&<div className="pp-pane-footer">
        <span>{hasResponse ? `HTTP ${result.statusCode}` : 'No response yet'}</span>
        <span className="pp-footer-tail">
          {exampleCount ? `${exampleCount} example${exampleCount > 1 ? 's' : ''} saved` :
            (result?.truncated ? 'Truncated' : 'Raw / JSON preview')}
        </span>
      </div>}
    </section>
  );
}
