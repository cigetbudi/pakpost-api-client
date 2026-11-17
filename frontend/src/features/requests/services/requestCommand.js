import { applyAuthorization } from '../../authorization.js';
import { bodyFormat, buildCommand, languageFromMime, resolveRows, resolveVars } from '../../requestTools.js';
import { stripJsonComments } from '../../jsonComments.js';
import { isEnabled } from '../../requestMetadata.js';

/** Shared transport command: used by Send, codegen and script preview. */
export function buildRequestCommand(request, vars) {
  const { method, url, rows, params, body, format, formFields, binaryFile, auth } = request;
  const preparedBody = languageFromMime(format) === 'json' ? stripJsonComments(body) : body;
  const command = buildCommand({ method, url, headers: rows, body: preparedBody,
    format, fields: formFields, fileBase64: binaryFile.base64, fileName: binaryFile.name }, vars);
  const parsed = new URL(command.url);
  resolveRows(params, vars).forEach(param => parsed.searchParams.append(param.key, param.value));
  command.url = parsed.toString();
  return applyAuthorization(command, auth, vars);
}

/** Codegen never includes literal bearer/basic/API credentials. */
export function maskRequestSecrets(request) {
  for (const key of Object.keys(request.headers || {})) {
    if (/(authorization|cookie|token|secret|api[-_]?key)/i.test(key))
      request.headers[key] = '{{REDACTED_SECRET}}';
  }
  return request;
}

export function buildRequestPreview(request) {
  const { method, url, rows, params, body, format, formFields, binaryFile, auth } = request;
  const fmt = bodyFormat(format);
  const query = params.filter(x => x.key.trim() && isEnabled(x))
    .map(x => `${encodeURIComponent(x.key)}=${encodeURIComponent(x.value || '')}`).join('&');
  const target = url + (query ? (url.includes('?') ? '&' : '?') + query : '');
  const headers = Object.fromEntries(rows.filter(x => x.key.trim() && isEnabled(x))
    .map(x => [x.key.trim(), x.value]));
  if (fmt.mode === 'raw' && body && !rows.some(x => x.key?.trim().toLowerCase() === 'content-type' && x.enabled === false)
    && !Object.keys(headers).some(x => x.toLowerCase() === 'content-type')) headers['Content-Type'] = fmt.mime;
  if (auth.authType === 'bearer' && auth.bearerToken.trim()) headers.Authorization = 'Bearer {{REDACTED_SECRET}}';
  if (auth.authType === 'basic') headers.Authorization = 'Basic {{REDACTED_SECRET}}';
  if (auth.authType === 'apiKey' && auth.apiKeyIn === 'header' && auth.apiKeyName.trim())
    headers[auth.apiKeyName.trim()] = '{{REDACTED_SECRET}}';
  const queryAuth = auth.authType === 'apiKey' && auth.apiKeyIn === 'query' && auth.apiKeyName.trim()
    ? `${target}${target.includes('?') ? '&' : '?'}${encodeURIComponent(auth.apiKeyName.trim())}={{REDACTED_SECRET}}` : target;
  return {method, url: queryAuth, headers: maskRequestSecrets({headers}).headers,
    body: languageFromMime(format) === 'json' ? stripJsonComments(body) : body,
    bodyMode: fmt.mode, contentType: format,
    formFields: formFields.map(x => ({ key: x.key, value: x.value, fileName: x.fileName, base64: x.fileBase64 })),
    fileName: binaryFile.name};
}

export function buildRedactedCodeRequest({ request, variableMap, allVariableMap }) {
  const command = buildRequestCommand(request, variableMap);
  maskRequestSecrets(command);
  const { auth } = request;
  if (auth.authType === 'apiKey' && auth.apiKeyIn === 'query' && auth.apiKeyName.trim()) {
    try {
      const target = new URL(command.url);
      target.searchParams.set(resolveVars(auth.apiKeyName.trim(), allVariableMap).value, '{{REDACTED_SECRET}}');
      command.url = target.toString();
    } catch { /* Invalid URLs are handled by the original request validator. */ }
  }
  return command;
}
