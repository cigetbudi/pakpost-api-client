import { runSandbox } from './runScript.js';
import { postmanRequestSnapshot } from './postmanCompat.js';
import { languageFromMime, syntaxProblem } from './requestTools.js';
import { stripJsonComments } from './jsonComments.js';
import { scriptConsoleLevel } from '../../console/services/pakpostConsoleStore.js';
import { resolvedScriptVariables } from '../../collections/services/collectionVariableSession.js';

/**
 * Execute one HTTP request and its Postman-style scripts without React state.
 * The caller owns scope isolation, persistence policy, HTTP transport and UI.
 * A failed pre-script aborts Send; a failed post-script keeps the HTTP response.
 */
export async function executeWorkbenchRequest({
  request, environmentValues, collectionValues, loadCollectionValues,
  saveCollectionValues, saveEnvironmentValues, buildOutgoing, dispatch, isCurrent = () => true,
  trace = () => {}, sandbox = runSandbox,
}) {
  const { method, url, rows, body, format, preScript, postScript, formFields, binaryFile } = request;
  const logs = [], tests = [];
  let variables = { ...environmentValues };
  let collectionVars = { ...collectionValues };
  const fail = (error, diagnostic) => {
    const fault = new Error(error);
    fault.scriptDiagnostic = diagnostic || null;
    fault.executionLogs = logs;
    fault.executionTests = tests;
    return fault;
  };
  try {
    if (loadCollectionValues) {
      try { collectionVars = await loadCollectionValues(collectionVars); }
      catch { trace('warn', 'collection', 'Saved Collection Variables unavailable; continuing with session values'); }
    }
    if (!isCurrent()) throw new Error('Request cancelled: account changed');
    const pre = await sandbox(preScript, 'pre', variables, postmanRequestSnapshot({
      method, url,
      headers: Object.fromEntries(rows.filter(x => x.key?.trim() && x.enabled !== false).map(x => [x.key.trim(), x.value])),
      body: languageFromMime(format) === 'json' ? stripJsonComments(body) : body, format,
    }, resolvedScriptVariables(collectionVars, variables)), null, {}, collectionVars);
    if (pre.error) {
      pre.logs?.forEach(line => trace(scriptConsoleLevel(line), 'pre-script', line));
      logs.push(...(pre.logs || []).map(line => 'PRE: ' + line));
      trace('error', 'pre-script', pre.error, { line: pre.diagnostic?.line, column: pre.diagnostic?.column });
      throw fail(`Pre-request script: ${pre.error}`, pre.diagnostic);
    }
    if (!isCurrent()) throw new Error('Request cancelled: account changed');
    trace('info', 'pre-script', 'Pre-request script completed');
    pre.logs.forEach(line => trace(scriptConsoleLevel(line), 'pre-script', line));
    collectionVars = pre.collectionVariables || collectionVars;
    saveCollectionValues(collectionVars);
    variables = pre.variables;
    logs.push(...pre.logs.map(line => 'PRE: ' + line));
    tests.push(...pre.tests);
    await saveEnvironmentValues(pre.environmentVariables || variables);
    const command = buildOutgoing(variables);
    for (const [name, value] of Object.entries(pre.requestHeaderOverrides || {})) {
      const previous = Object.keys(command.headers).find(key => key.toLowerCase() === name.toLowerCase());
      if (previous) delete command.headers[previous];
      command.headers[name] = value;
    }
    if (command.bodyMode === 'multipart' && formFields.some(x => x.fileName && !x.fileBase64))
      throw new Error('Reattach saved multipart file before sending.');
    if (command.bodyMode === 'binary' && !binaryFile.base64)
      throw new Error('Choose a binary file before sending.');
    if (command.bodyMode === 'raw') {
      const problem = syntaxProblem(command.body, languageFromMime(format));
      if (problem) throw new Error('Request body is invalid: ' + problem.message);
    }
    if (!isCurrent()) throw new Error('Request cancelled: account changed');
    trace('info', 'network', 'HTTP request dispatched', { method: command.method || method, transport: request.interceptorMode });
    const response = await dispatch(command);
    trace(response.statusCode >= 400 ? 'warn' : 'info', 'network', 'HTTP response received',
      { status: response.statusCode, elapsedMs: response.elapsedMs });
    let scriptError = '', scriptDiagnostic = null;
    try {
      if (!isCurrent()) throw new Error('Request cancelled: account changed');
      const post = await sandbox(postScript, 'post', pre.environmentVariables || environmentValues,
        command, response, pre.localVariables || {}, collectionVars);
      logs.push(...post.logs.map(line => 'POST: ' + line));
      tests.push(...post.tests);
      post.logs.forEach(line => trace(scriptConsoleLevel(line), 'post-script', line));
      post.tests.forEach(test => trace(test.passed === false ? 'error' : 'info', 'test',
        test.name || 'Assertion completed', { passed: test.passed }));
      if (post.error) {
        scriptError = post.error;
        scriptDiagnostic = post.diagnostic || null;
        logs.push('SCRIPT ERROR: ' + post.error);
        trace('error', 'post-script', post.error, { line: post.diagnostic?.line, column: post.diagnostic?.column });
      } else {
        if (isCurrent()) saveCollectionValues(post.collectionVariables || collectionVars);
        if (isCurrent()) await saveEnvironmentValues(post.environmentVariables || post.variables);
      }
    } catch (scriptFailure) {
      scriptError = scriptFailure?.message || String(scriptFailure);
      scriptDiagnostic = scriptFailure?.scriptDiagnostic || null;
      logs.push('SCRIPT ERROR: ' + scriptError);
      trace('error', 'post-script', scriptError, { line: scriptDiagnostic?.line, column: scriptDiagnostic?.column });
    }
    return { response, command, logs, tests, scriptError, scriptDiagnostic };
  } catch (error) {
    if (!error.executionLogs) error.executionLogs = logs;
    if (!error.executionTests) error.executionTests = tests;
    throw error;
  }
}
