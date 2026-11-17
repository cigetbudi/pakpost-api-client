import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {appendConsoleEvent,clearConsoleEvents,subscribeConsoleEvents,redactConsoleMessage} from '../src/features/pakpostConsoleStore.js';
test('redacts common secrets',()=>{
  assert.doesNotMatch(redactConsoleMessage('Bearer abc123'),/abc123/);
  assert.doesNotMatch(redactConsoleMessage('password=supersecret'),/supersecret/);
  assert.doesNotMatch(redactConsoleMessage('https://example.com/?access_token=secret'),/access_token=secret/);
});
test('console is memory bounded',()=>{
  let items=[];const unsub=subscribeConsoleEvents(next=>items=next);
  for(let i=0;i<550;i++)appendConsoleEvent({executionId:'run',level:'info',message:`item-${i}`});
  assert.equal(items.length,500);
  assert.equal(items.at(-1).message,'item-549');
  clearConsoleEvents();assert.equal(items.length,0);unsub();
});
