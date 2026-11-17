import { useState } from 'react';
import { sanitizeResponseExamples } from '../services/responseExamples.js';

/** Editable request data stays in React state; persist only via existing guarded recovery path. */
export function useRequestDraftEditor(recovered, emptyHeader) {
  const [method, setMethod] = useState(recovered.method || 'GET');
  const [url, setUrl] = useState(recovered.url ?? 'https://httpbin.org/get');
  const [rows, setRows] = useState(recovered.rows || [{ ...emptyHeader }]);
  const [body, setBody] = useState(recovered.body || '');
  const [documentation,setDocumentation]=useState(recovered.documentation||'');
  const [format, setFormat] = useState(recovered.format || 'application/json');
  const [formFields, setFormFields] = useState(recovered.formFields || [{key:'',value:''}]);
  const [binaryFile, setBinaryFile] = useState({name:recovered.binaryFile?.name || '',base64:''});
  const [preScript, setPreScript] = useState(recovered.preScript || '');
  const [postScript, setPostScript] = useState(recovered.postScript || '');
  const [responseExamples, setResponseExamples] = useState(sanitizeResponseExamples(recovered.responseExamples));
  const [scriptLog, setScriptLog] = useState(recovered.scriptLog || []);
  const [scriptTests, setScriptTests] = useState(recovered.scriptTests || []);
  const [scriptError, setScriptError] = useState(recovered.scriptError || '');
  const [scriptDiagnostic,setScriptDiagnostic] = useState(recovered.scriptDiagnostic || null);
  const [scriptJump,setScriptJump] = useState(null);
  const [responsePretty, setResponsePretty] = useState(true);
  const [prettyResponse, setPrettyResponse] = useState('');

  return {
    method, setMethod, url, setUrl, rows, setRows,
    body, setBody, documentation, setDocumentation, format, setFormat,
    formFields, setFormFields, binaryFile, setBinaryFile, preScript, setPreScript,
    postScript, setPostScript, responseExamples, setResponseExamples, scriptLog, setScriptLog,
    scriptTests, setScriptTests, scriptError, setScriptError, scriptDiagnostic, setScriptDiagnostic,
    scriptJump, setScriptJump, responsePretty, setResponsePretty, prettyResponse, setPrettyResponse,
  };
}
