import React from 'react';
import {
  ArrowDownToLine,
  Bolt,
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
}) {
  const hasResponse = !!result && !result.error;
  const headerCount = hasResponse ? Object.keys(result.headers || {}).length : 0;
  const bodySize = hasResponse ? new Blob([result.body || '']).size : 0;

  return (
    <section className="pp-response-pane">
      <div className="pp-pane-heading pp-response-heading">
        <span className="pp-pane-title"><Bolt size={15} /> Response</span>
        {hasResponse ? (
          <div className="pp-response-metrics">
            <span className={`pp-status ${statusTone(result.statusCode)}`}>
              <span className="pp-status-dot" />
              {result.statusCode} {result.reasonPhrase}
            </span>
            <span><Clock3 size={13} /> {result.elapsedMs} ms</span>
            <span><ArrowDownToLine size={13} /> {bodySize.toLocaleString()} B</span>
          </div>
        ) : <span className="pp-pane-meta">Awaiting response</span>}
      </div>

      <div className="pp-panel-tabs">
        <button className={resTab === 'body' ? 'active' : ''} onClick={() => onResTabChange('body')}>Body</button>
        <button className={resTab === 'headers' ? 'active' : ''} onClick={() => onResTabChange('headers')}>
          Headers{hasResponse && <span className="pp-tiny-count">{headerCount}</span>}
        </button>
        <div className="pp-panel-tabs-spacer" />
        <button className="pp-copy-response" disabled={!hasResponse} onClick={onBeautify} title="Beautify response">
          <WandSparkles size={14} /> Beautify
        </button>
        <button className="pp-copy-response" disabled={!hasResponse} onClick={() => onResponsePrettyChange(value => !value)} title="Toggle raw/pretty">
          {responsePretty ? 'Pretty' : 'Raw'}
        </button>
        <button className="pp-copy-response" disabled={!hasResponse} onClick={onSaveExample} title="Save response example">
          <Save size={14} /> Save example
        </button>
        <button className="pp-copy-response" disabled={!hasResponse} onClick={onCopy} title="Copy response">
          <Copy size={14} /> Copy
        </button>
      </div>

      <div className="pp-panel-body pp-response-body">
        {!result ? (
          <div className="pp-response-empty">
            <div className="pp-response-empty-symbol"><Terminal size={28} /></div>
            <strong>{loading ? 'Sending request…' : 'Ready to send a request'}</strong>
            <p>{loading ? 'The server is processing your request.' : 'Enter a URL, configure your request, and hit Send. Your response will appear here.'}</p>
            <span>⌘ / Ctrl + Enter</span>
          </div>
        ) : result.error ? (
          <div className="pp-response-error">
            <div><X size={18} /></div>
            <strong>Request failed</strong>
            <p>{result.error}</p>
          </div>
        ) : (
          <>
            <div className="pp-response-code">
              <Editor
                readOnly
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

      <div className="pp-pane-footer">
        <span>{hasResponse ? `HTTP ${result.statusCode}` : 'No response yet'}</span>
        <span className="pp-footer-tail">
          {exampleCount ? `${exampleCount} example${exampleCount > 1 ? 's' : ''} saved` :
            (result?.truncated ? 'Truncated' : 'Raw / JSON preview')}
        </span>
      </div>
    </section>
  );
}
