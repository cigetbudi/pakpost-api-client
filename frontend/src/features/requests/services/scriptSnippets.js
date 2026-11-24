// [label, source, group] — snippets use the supported synchronous PakPost pm.* subset.
export const SCRIPT_SNIPPETS = {
  pre: [
    ["Set environment variable", `{
  pm.environment.set('timestamp', new Date().toISOString());
}`, "Variables"],
    ["Set local request variable", `{
  pm.variables.set('requestType', 'inquiry');
}`, "Variables"],
    ["Set collection variable", `{
  pm.collectionVariables.set('apiVersion', 'v1');
}`, "Variables"],
    ["Require a variable", `{
  // Change the variable name as needed.
  if (!pm.variables.get('baseUrl')) throw new Error('baseUrl is required');
}`, "Variables"],
    ["Read and resolve variable references", `{
  const resolved = pm.variables.replaceIn('{{baseUrl}}/products');
  pm.variables.set('resolvedUrl', resolved);
}`, "Variables"],
    ["Unset environment variable", `{
  // Removes this variable from the current environment.
  pm.environment.unset('temporaryValue');
}`, "Variables"],
    ["ISO 8601 timestamp", `{
  pm.variables.set('timestamp', new Date().toISOString());
}`, "Date & time"],
    ["Unix timestamp (seconds)", `{
  pm.variables.set('timestamp', Math.floor(Date.now() / 1000));
}`, "Date & time"],
    ["Unix timestamp (milliseconds)", `{
  pm.variables.set('timestampMs', Date.now());
}`, "Date & time"],
    ["Current UTC date", `{
  pm.variables.set('date', new Date().toISOString().slice(0, 10));
}`, "Date & time"],
    ["Set JSON Content-Type", `{
  pm.request.headers.upsert({ key: 'Content-Type', value: 'application/json' });
}`, "Request headers"],
    ["Set Accept header", `{
  pm.request.headers.upsert({ key: 'Accept', value: 'application/json' });
}`, "Request headers"],
    ["Set timestamp header", `{
  pm.request.headers.upsert({ key: 'X-Timestamp', value: new Date().toISOString() });
}`, "Request headers"],
    ["Read request method and path", `{
  pm.variables.set('requestMethod', pm.request.method);
  pm.variables.set('requestPath', '/' + pm.request.url.path.join('/'));
}`, "Request headers"],
    ["Bearer token header", `{
  // Use a variable containing your token, without the Bearer prefix.
  const token = pm.variables.get('AuthToken');
  if (!token) throw new Error('AuthToken is required');
  pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + token });
}`, "Authentication"],
    ["API key header", `{
  const apiKey = pm.variables.get('apiKey');
  if (!apiKey) throw new Error('apiKey is required');
  pm.request.headers.upsert({ key: 'X-API-Key', value: apiKey });
}`, "Authentication"],
    ["Basic Auth header", `{
  const CryptoJS = require('crypto-js');
  const username = pm.variables.get('username');
  const password = pm.variables.get('password');
  if (username == null || password == null) throw new Error('username and password are required');
  const credentials = CryptoJS.enc.Utf8.parse(username + ':' + password);
  pm.request.headers.upsert({ key: 'Authorization', value: 'Basic ' + CryptoJS.enc.Base64.stringify(credentials) });
}`, "Authentication"],
    ["HMAC SHA-256 (Hex)", `{
  const CryptoJS = require('crypto-js');
  const secret = pm.variables.get('signingKey');
  if (!secret) throw new Error('signingKey is required');
  const payload = pm.variables.replaceIn(pm.request.body?.raw || '');
  const signature = CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);
  pm.request.headers.upsert({ key: 'X-Signature', value: signature });
}`, "Crypto & signatures"],
    ["HMAC SHA-256 (Base64)", `{
  const CryptoJS = require('crypto-js');
  const secret = pm.variables.get('signingKey');
  if (!secret) throw new Error('signingKey is required');
  const payload = pm.variables.replaceIn(pm.request.body?.raw || '');
  const signature = CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Base64);
  pm.request.headers.upsert({ key: 'X-Signature', value: signature });
}`, "Crypto & signatures"],
    ["HMAC SHA-512 (Hex)", `{
  const CryptoJS = require('crypto-js');
  const secret = pm.variables.get('signingKey');
  if (!secret) throw new Error('signingKey is required');
  const payload = pm.variables.replaceIn(pm.request.body?.raw || '');
  const signature = CryptoJS.HmacSHA512(payload, secret).toString(CryptoJS.enc.Hex);
  pm.request.headers.upsert({ key: 'X-Signature', value: signature });
}`, "Crypto & signatures"],
    ["HMAC SHA-512 (Base64)", `{
  const CryptoJS = require('crypto-js');
  const secret = pm.variables.get('signingKey');
  if (!secret) throw new Error('signingKey is required');
  const payload = pm.variables.replaceIn(pm.request.body?.raw || '');
  const signature = CryptoJS.HmacSHA512(payload, secret).toString(CryptoJS.enc.Base64);
  pm.request.headers.upsert({ key: 'X-Signature', value: signature });
}`, "Crypto & signatures"],
    ["SHA-256 body digest", `{
  const CryptoJS = require('crypto-js');
  const body = pm.variables.replaceIn(pm.request.body?.raw || '');
  pm.variables.set('bodyHash', CryptoJS.SHA256(body).toString(CryptoJS.enc.Hex));
}`, "Crypto & signatures"],
    ["Encode text to Base64", `{
  const CryptoJS = require('crypto-js');
  const text = pm.variables.get('plainText');
  if (text == null) throw new Error('plainText is required');
  pm.variables.set('encodedText', CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(String(text))));
}`, "Crypto & signatures"],
    ["Decode Base64 to text", `{
  const CryptoJS = require('crypto-js');
  const encoded = pm.variables.get('encodedText');
  if (encoded == null) throw new Error('encodedText is required');
  pm.variables.set('plainText', CryptoJS.enc.Base64.parse(encoded).toString(CryptoJS.enc.Utf8));
}`, "Crypto & signatures"],
    ["Signed request (method, path, timestamp)", `{
  // Example only: adapt the canonical string to your API contract.
  const CryptoJS = require('crypto-js');
  const secret = pm.variables.get('signingKey');
  if (!secret) throw new Error('signingKey is required');
  const timestamp = new Date().toISOString();
  const path = '/' + pm.request.url.path.join('/');
  const body = pm.variables.replaceIn(pm.request.body?.raw || '');
  const payload = [pm.request.method, path, timestamp, body].join('\\n');
  const signature = CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Base64);
  pm.request.headers.upsert({ key: 'X-Timestamp', value: timestamp });
  pm.request.headers.upsert({ key: 'X-Signature', value: signature });
}`, "Crypto & signatures"],
    ["Read CSV / JSON iteration value", `{
  // Run with a data file containing customerId.
  if (!pm.iterationData.has('customerId')) throw new Error('Missing customerId in runner data');
  pm.variables.set('customerId', pm.iterationData.get('customerId'));
}`, "Runner data"],
    ["Get iteration number", `{
  pm.variables.set('iterationNumber', pm.info.iteration + 1);
}`, "Runner data"],
    ["Get total iterations", `{
  pm.variables.set('totalIterations', pm.info.iterationCount);
}`, "Runner data"],
    ["Log request method", `{
  console.log('Request method:', pm.request.method);
}`, "Debugging"],
    ["Log runner progress", `{
  console.log('Iteration', pm.info.iteration + 1, 'of', pm.info.iterationCount);
}`, "Debugging"],
  ],
  post: [
    ["Check HTTP 200", `{
  pm.test('HTTP 200', () => {
    pm.response.to.have.status(200);
  });
}`, "HTTP status"],
    ["Check HTTP 201", `{
  pm.test('HTTP 201', () => {
    pm.response.to.have.status(201);
  });
}`, "HTTP status"],
    ["Check HTTP 204", `{
  pm.test('HTTP 204', () => {
    pm.response.to.have.status(204);
  });
}`, "HTTP status"],
    ["Check HTTP 400", `{
  pm.test('HTTP 400', () => {
    pm.response.to.have.status(400);
  });
}`, "HTTP status"],
    ["Check HTTP 401", `{
  pm.test('HTTP 401', () => {
    pm.response.to.have.status(401);
  });
}`, "HTTP status"],
    ["Check HTTP 403", `{
  pm.test('HTTP 403', () => {
    pm.response.to.have.status(403);
  });
}`, "HTTP status"],
    ["Check HTTP 404", `{
  pm.test('HTTP 404', () => {
    pm.response.to.have.status(404);
  });
}`, "HTTP status"],
    ["Check HTTP 500", `{
  pm.test('HTTP 500', () => {
    pm.response.to.have.status(500);
  });
}`, "HTTP status"],
    ["Check any 2xx success", `{
  pm.test('Successful HTTP status', () => {
    pm.expect(pm.response.code >= 200 && pm.response.code < 300).to.equal(true);
  });
}`, "HTTP status"],
    ["Response time below 500 ms", `{
  pm.test('Response time below 500 ms', () => {
    pm.expect(pm.response.responseTime < 500).to.equal(true);
  });
}`, "Performance"],
    ["Response time below 2 seconds", `{
  pm.test('Response time below 2 seconds', () => {
    pm.expect(pm.response.responseTime < 2000).to.equal(true);
  });
}`, "Performance"],
    ["Content-Type is JSON", `{
  pm.test('Content-Type is JSON', () => {
    const type = pm.response.headers.get('Content-Type') || '';
    pm.expect(/(?:application\\/json|\\+json)(?:\\s*;|$)/i.test(type)).to.equal(true);
  });
}`, "Response headers"],
    ["Check a response header exists", `{
  pm.test('Has Content-Type header', () => {
    pm.expect(pm.response.headers.has('Content-Type')).to.equal(true);
  });
}`, "Response headers"],
    ["Check response header value", `{
  pm.test('Expected cache policy', () => {
    pm.expect(pm.response.headers.get('Cache-Control')).to.equal('no-store');
  });
}`, "Response headers"],
    ["Check valid JSON", `{
  pm.test('Response is valid JSON', () => {
    pm.response.json();
  });
}`, "JSON assertions"],
    ["Check JSON property", `{
  pm.test('Has data', () => {
    pm.expect(pm.response.json()).to.have.property('data');
  });
}`, "JSON assertions"],
    ["Check nested property", `{
  pm.test('Has data.id', () => {
    const data = pm.response.json();
    pm.expect(data.data).to.have.property('id');
  });
}`, "JSON assertions"],
    ["Check JSON field equals value", `{
  pm.test('Response code is 00', () => {
    pm.expect(pm.response.json().responseCode).to.equal('00');
  });
}`, "JSON assertions"],
    ["Check success flag", `{
  pm.test('Success is true', () => {
    pm.expect(pm.response.json().success).to.equal(true);
  });
}`, "JSON assertions"],
    ["Check non-empty array", `{
  pm.test('Data is a non-empty array', () => {
    const data = pm.response.json().data;
    pm.expect(Array.isArray(data) && data.length > 0).to.equal(true);
  });
}`, "JSON assertions"],
    ["Check field type", `{
  pm.test('id is a number', () => {
    pm.expect(typeof pm.response.json().id).to.equal('number');
  });
}`, "JSON assertions"],
    ["Check field is not null", `{
  pm.test('id is present', () => {
    const id = pm.response.json().id;
    pm.expect(id !== null && id !== undefined).to.equal(true);
  });
}`, "JSON assertions"],
    ["Check field against runner data", `{
  pm.test('Customer ID matches iteration data', () => {
    const expected = pm.iterationData.get('customerId');
    pm.expect(expected !== undefined).to.equal(true);
    pm.expect(String(pm.response.json().customerId)).to.equal(String(expected));
  });
}`, "JSON assertions"],
    ["Check response text contains value", `{
  pm.test('Body contains success', () => {
    pm.expect(pm.response.text().includes('success')).to.equal(true);
  });
}`, "Body assertions"],
    ["Check response body is not empty", `{
  pm.test('Body is not empty', () => {
    pm.expect(pm.response.text().length > 0).to.equal(true);
  });
}`, "Body assertions"],
    ["Chain response variable", `{
  const data = pm.response.json();
  if (data.id == null) throw new Error('Response id is missing');
  pm.collectionVariables.set('nextId', data.id);
}`, "Extract & chain"],
    ["Save nested ID to environment", `{
  const id = pm.response.json().data?.id;
  if (id == null) throw new Error('Response data.id is missing');
  pm.environment.set('customerId', id);
}`, "Extract & chain"],
    ["Save access token to local request variable", `{
  // Local variable scope; not a durable token store.
  const token = pm.response.json().access_token;
  if (typeof token !== 'string' || !token) throw new Error('access_token is missing');
  pm.variables.set('AuthToken', token);
}`, "Extract & chain"],
    ["Save response array to collection variable", `{
  const data = pm.response.json().data;
  if (!Array.isArray(data)) throw new Error('Expected data array');
  pm.collectionVariables.set('responseItems', JSON.stringify(data));
}`, "Extract & chain"],
    ["Save first array item ID", `{
  const id = pm.response.json().data?.[0]?.id;
  if (id == null) throw new Error('First item id is missing');
  pm.collectionVariables.set('nextId', id);
}`, "Extract & chain"],
    ["Save response header to local variable", `{
  const id = pm.response.headers.get('X-Request-ID');
  if (id == null) throw new Error('X-Request-ID is missing');
  pm.variables.set('responseRequestId', id);
}`, "Extract & chain"],
    ["Save pagination cursor", `{
  const cursor = pm.response.json().nextCursor;
  if (cursor == null) throw new Error('nextCursor is missing');
  pm.collectionVariables.set('nextCursor', cursor);
}`, "Extract & chain"],
    ["Log status and response time", `{
  console.log('HTTP', pm.response.code, 'Duration:', pm.response.responseTime, 'ms');
}`, "Debugging"],
    ["Log assertion context (no payload)", `{
  console.log('Iteration', pm.info.iteration + 1, 'HTTP', pm.response.code);
}`, "Debugging"],
  ],
};
export function postmanCompletions(context){
  const word=context.matchBefore(/\bpm(?:\.[\w]*)*$/);if(!word)return null;
  const methods=['pm.request','pm.request.url.path','pm.request.body.raw','pm.request.headers.get','pm.request.headers.upsert','pm.variables.get','pm.variables.set','pm.variables.replaceIn','pm.environment.get','pm.environment.set','pm.collectionVariables.get','pm.collectionVariables.set','pm.iterationData.get','pm.iterationData.has','pm.info.iteration','pm.info.iterationCount','pm.response.json','pm.response.text','pm.response.code','pm.response.headers.get','pm.response.responseTime','pm.test','pm.expect'];
  return {from:word.from,options:methods.filter(name=>name.startsWith(word.text)).map(label=>({label,type:'function'})),validFor:/^pm(?:\.[\w]*)*$/};
}
