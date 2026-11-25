import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectBundleMetrics} from '../../scripts/performance-audit.mjs';
test('manifest includes transitive static chunks without counting dynamic imports as startup',()=>{
  const root=mkdtempSync(join(tmpdir(),'pakpost-manifest-'));
  try{
    mkdirSync(join(root,'assets'));mkdirSync(join(root,'.vite'));
    writeFileSync(join(root,'index.html'),'<script type="module" src="/assets/index.js"></script>');
    for(const file of ['index','react','shared','Editors-abc','vendor-editor'])writeFileSync(join(root,'assets',file+'.js'),'console.log('+JSON.stringify(file)+')');
    writeFileSync(join(root,'.vite','manifest.json'),JSON.stringify({
      'index.html':{file:'assets/index.js',isEntry:true,imports:['_react'],dynamicImports:['src/Editors.jsx']},
      _react:{file:'assets/react.js',imports:['_shared']},_shared:{file:'assets/shared.js'},
      'src/Editors.jsx':{file:'assets/Editors-abc.js',isDynamicEntry:true,imports:['_editor','_react']},_editor:{file:'assets/vendor-editor.js'}
    }));
    const m=collectBundleMetrics(root);assert.deepEqual(new Set(m.initialAssets),new Set(['assets/index.js','assets/react.js','assets/shared.js']));
    assert.equal(m.editorChunkGzipBytes,m.allJsGzipBytes-m.initialJsGzipBytes);
    assert.equal(m.largestJsChunks.length,5);
  }finally{rmSync(root,{recursive:true,force:true});}
});
