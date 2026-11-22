import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPerformanceBudget } from '../../scripts/performance-budget.mjs';

const metrics={
  initialJsGzipBytes: 165*1024,
  initialCssGzipBytes:30*1024,
  editorChunkGzipBytes:205*1024,
  consoleChunkGzipBytes:2*1024,
  initialAssets:['assets/index-abc.js','assets/index-def.css']
};
test('baseline fits initial and on-demand bundle budgets',()=>{
  assert.deepEqual(checkPerformanceBudget(metrics),[]);
});
test('oversize initial JS fails while lazy total JS is not treated as startup',()=>{
  assert.match(checkPerformanceBudget({...metrics,initialJsGzipBytes:310*1024}).join(),/Initial JS/);
  assert.deepEqual(checkPerformanceBudget({...metrics,allJsGzipBytes:2*1024*1024}),[]);
});
test('lazy Editor loaded as an entry is detected',()=>{
  assert.match(checkPerformanceBudget({...metrics,initialAssets:[...metrics.initialAssets,'assets/Editors-x.js']}).join(),/entry asset/);
});
test('missing or corrupted chunk measurements do not accidentally pass',()=>{
  assert.ok(checkPerformanceBudget({...metrics,editorChunkGzipBytes:0}).length>0);
  assert.ok(checkPerformanceBudget({...metrics,initialCssGzipBytes:NaN}).length>0);
});
