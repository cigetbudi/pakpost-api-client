import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash, createHmac } from 'node:crypto';
import { SCRIPT_SNIPPETS } from '../../src/features/requests/services/scriptSnippets.js';

// Exercise the actual worker's pm.* facade in Node, without booting the WASM worker.
// The crypto adapter is a fixture backed by Node crypto, not a QuickJS integration test.
const worker = readFileSync(new URL('../../src/features/requests/services/sandbox.worker.js', import.meta.url), 'utf8');
const prefix = worker.split('const prefix=String.raw`')[1].split('`;')[0];
const suffix = worker.split('const suffix=String.raw`')[1].split('`;')[0];
const wordArray = buffer => ({ buffer, toString: encoding => buffer.toString(encoding ? String(encoding) : 'hex') });
const cryptoFixture = {
  enc: {
    Hex: 'hex',
    Utf8: { parse: text => wordArray(Buffer.from(text)), toString: () => 'utf8' },
    Base64: { parse: text => wordArray(Buffer.from(text, 'base64')), stringify: word => word.buffer.toString('base64'), toString: () => 'base64' },
  },
  SHA256: text => wordArray(createHash('sha256').update(text).digest()),
  HmacSHA256: (text, key) => wordArray(createHmac('sha256', key).update(text).digest()),
  HmacSHA512: (text, key) => wordArray(createHmac('sha512', key).update(text).digest()),
};
function execute(code, phase, label) {
  const status = Number(label.match(/^Check HTTP (\d+)$/)?.[1] || 200);
  const arrayData = /non-empty array|response array|first array item/i.test(label);
  const input = {
    phase, variables: { baseUrl: 'https://example.test', AuthToken: 'fake-token', apiKey: 'fake-key', username: 'user', password: 'pass', signingKey: 'fake-signing-key', plainText: 'hello', encodedText: 'aGVsbG8=', temporaryValue: 'temp' },
    collectionVariables: {}, localVariables: {}, iterationData: { customerId: '123' }, iterationInfo: { iteration: 0, iterationCount: 3 },
    request: { method: 'POST', url: { path: ['products'] }, body: { raw: '{"id":"{{customerId}}"}' }, headers: {} },
    response: phase === 'post' ? { statusCode: status, elapsedMs: 124, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-ID': 'test-id' }, body: JSON.stringify({ id: 123, customerId: '123', responseCode: '00', success: true, access_token: 'fake-response-token', nextCursor: 'next', data: arrayData ? [{ id: 123 }] : { id: 123 } }) } : null,
  };
  return JSON.parse(runInNewContext(prefix.replace('${initial}', JSON.stringify(input)) + code + suffix, { CryptoJS: cryptoFixture }, { timeout: 1000 }));
}
for (const [phase, snippets] of Object.entries(SCRIPT_SNIPPETS)) {
  test(`${phase}: labels are unique and snippets can be appended twice`, () => {
    assert.equal(new Set(snippets.map(([label]) => label)).size, snippets.length);
    for (const [label, source, group] of snippets) {
      assert.ok(group, label);
      assert.doesNotThrow(() => new Function(`${source}\n\n${source}`), label);
    }
  });
  for (const [label, source] of snippets) {
    test(`${phase}: ${label}`, () => {
      const result = execute(source, phase, label);
      assert.equal(result.scriptFault, null, JSON.stringify(result.scriptFault));
      for (const assertion of result.tests) assert.equal(assertion.passed, true, assertion.error);
    });
  }
}
