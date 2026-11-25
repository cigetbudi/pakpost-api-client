#!/usr/bin/env node
// Dependency-free artifact audit. Reads Vite build output, never source or secrets.
import {readFileSync,readdirSync,writeFileSync,statSync,existsSync} from 'node:fs';
import {resolve,join,relative,extname} from 'node:path';
import {gzipSync} from 'node:zlib';

export function collectBundleMetrics(distDir) {
  const entry=join(distDir,'index.html');
  if(!existsSync(entry))throw new Error(`Missing ${entry}. Run bun run build first.`);
  const html=readFileSync(entry,'utf8');
  const files=[];
  const walk=(dir)=>{for(const item of readdirSync(dir,{withFileTypes:true})){
    const name=join(dir,item.name);
    if(item.isDirectory())walk(name);
    else if(item.isFile()&&['.js','.css'].includes(extname(item.name))){
      const size=statSync(name).size;
      files.push({name:relative(distDir,name).replaceAll('\\','/'),bytes:size,gzipBytes:gzipSync(readFileSync(name),{level:9}).length});
    }
  }};
  walk(distDir);
  // Vite emits entry <script type="module" ...> plus optional modulepreload links.
  const initialUrls=new Set();
  for(const tag of html.match(/<(?:script|link)\b[^>]*>/gi)||[]){
    if(!(/type=["']module["']/i.test(tag)||/rel=["'](?:modulepreload|stylesheet)["']/i.test(tag)))continue;
    const path=tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    if(path)initialUrls.add(path.split('?')[0].replace(/^\//,''));
  }
  // Walk static imports transitively. Dynamic imports are deliberately excluded.
  const manifestPath=join(distDir,'.vite','manifest.json');
  const editorUrls=new Set();
  if(existsSync(manifestPath)){
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    const addStatic=(key,urls,seen)=>{
      if(seen.has(key))return;
      seen.add(key);
      const chunk=manifest[key];
      if(!chunk)throw Error(`Missing manifest import: ${key}`);
      if(chunk.file)urls.add(chunk.file);
      for(const css of chunk.css||[])urls.add(css);
      for(const dependency of chunk.imports||[])addStatic(dependency,urls,seen);
    };
    const entries=Object.keys(manifest).filter(key=>manifest[key].isEntry);
    if(!entries.length)throw Error('No entry found in Vite manifest');
    for(const key of entries)addStatic(key,initialUrls,new Set());
    for(const key of Object.keys(manifest).filter(key=>/(?:^|\/)Editors\.jsx$/.test(key)))addStatic(key,editorUrls,new Set());
  }
  const initial=files.filter(f=>initialUrls.has(f.name));
  const js=files.filter(f=>f.name.endsWith('.js'));
  const css=files.filter(f=>f.name.endsWith('.css'));
  const sum=(items,field)=>items.reduce((n,f)=>n+f[field],0);
  return {
    generatedAt:new Date().toISOString(),
    initialJsGzipBytes:sum(initial.filter(f=>f.name.endsWith('.js')),'gzipBytes'),
    initialCssGzipBytes:sum(initial.filter(f=>f.name.endsWith('.css')),'gzipBytes'),
    allJsGzipBytes:sum(js,'gzipBytes'),
    allCssGzipBytes:sum(css,'gzipBytes'),
    consoleChunkGzipBytes:sum(js.filter(f=>/PakpostConsole/i.test(f.name)),'gzipBytes'),
    editorChunkGzipBytes:sum(js.filter(f=>!initialUrls.has(f.name)&&(editorUrls.has(f.name)||/(?:^|\/)Editors-[^/]+\.js$/i.test(f.name))),'gzipBytes'),
    largestJsChunks:js.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,5),
    toolsChunkGzipBytes:sum(js.filter(f=>/(?:^|\/)WorkbenchSidebars-[^/]+\.js$/i.test(f.name)),'gzipBytes'),
    initialAssets:initial.map(f=>f.name),
    jsFiles:js.length,
    cssFiles:css.length
  };
}

function parseArgs(argv){
  const options={dist:'dist',save:null,compare:null};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(['--dist','--save','--compare'].includes(key)){
      if(!argv[i+1])throw Error(`Missing value for ${key}`);
      options[key.slice(2)]=argv[++i];
    } else throw Error(`Unknown option: ${key}`);
  }
  return options;
}

const KiB=n=>(n/1024).toFixed(1)+' KiB';
export function reportBundleMetrics(metrics,baseline=null){
  const lines=[
    'PakPost build performance audit (gzip, not browser memory/runtime measurements)',
    `  Initial JS:       ${KiB(metrics.initialJsGzipBytes)}`,
    `  Initial CSS:      ${KiB(metrics.initialCssGzipBytes)}`,
    `  Total JS chunks:  ${KiB(metrics.allJsGzipBytes)} (${metrics.jsFiles} files)`,
    `  Console chunk:    ${KiB(metrics.consoleChunkGzipBytes)} (loads on demand)`,
    `  Editor chunk:     ${KiB(metrics.editorChunkGzipBytes||0)} (loads on Body / Scripts / Response)`,
    `  Tools chunk:      ${KiB(metrics.toolsChunkGzipBytes||0)} (loads on Code / Import-Export)`,
    ...(metrics.largestJsChunks||[]).map(f=>`  Chunk: ${f.name} — ${KiB(f.bytes)} raw / ${KiB(f.gzipBytes)} gzip`),
    `  Entry assets:     ${metrics.initialAssets.join(', ')||'not detected'}`
  ];
  if(metrics.initialJsGzipBytes>300*1024)lines.push('  NOTE: Initial JS exceeds the provisional 300 KiB target. Profile before adjusting the budget.');
  if(metrics.consoleChunkGzipBytes===0)lines.push('  NOTE: No named Console chunk detected; inspect Vite output to confirm lazy loading.');
  if(!metrics.editorChunkGzipBytes)lines.push('  NOTE: No named Editor chunk detected; inspect Vite output to confirm code splitting.');
  if(baseline){
    const delta=metrics.initialJsGzipBytes-(baseline.initialJsGzipBytes||0);
    const sign=delta>=0?'+':'';
    lines.push(`  Initial JS vs baseline: ${sign}${KiB(delta)}`);
    if(delta>15*1024)lines.push('  WARNING: Initial JS grew by more than 15 KiB gzip. Investigate new eager dependencies.');
  }
  return lines.join('\n');
}

if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
  try{
    const options=parseArgs(process.argv.slice(2));
    const metrics=collectBundleMetrics(resolve(options.dist));
    const baseline=options.compare?JSON.parse(readFileSync(resolve(options.compare),'utf8')):null;
    console.log(reportBundleMetrics(metrics,baseline));
    if(options.save){writeFileSync(resolve(options.save),JSON.stringify(metrics,null,2)+'\n');console.log(`  Baseline saved: ${options.save}`);}
  } catch(error){console.error('Performance audit:',error.message);process.exitCode=1;}
}
