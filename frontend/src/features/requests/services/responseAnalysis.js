// Deliberately bounded, non-evaluating JSONPath engine. This is not full RFC 9535.
const MAX=1000, MAX_VISITS=50000, MAX_BODY=1048576;
const own=(o,k)=>o!==null&&typeof o==='object'&&Object.hasOwn(o,k);
const object=v=>v!==null&&typeof v==='object';
const unsupported=()=>Error('Supported: keys, indexes, wildcards, unions, slices, recursive descent, and simple filters. No script expressions.');
const integer=/^-?(?:0|[1-9]\d*)$/;
function number(text){const n=Number(text);if(!integer.test(text)||!Number.isSafeInteger(n))throw unsupported();return n;}
function quoted(text){
  if(text[0]==='"')return JSON.parse(text);
  // Decode JSON escapes and single quoted property names without evaluating code.
  if(text[0]!=="'"||text.at(-1)!=="'")throw unsupported();
  let json='"';
  for(let i=1;i<text.length-1;i++){
    const c=text[i];
    if(c==='\\'){
      const next=text[++i];if(next===undefined||i===text.length-1)throw unsupported();
      json+=next==="'"?"'":'\\'+next;
    }else if(c==="'")throw unsupported();
    else json+=c==='"'?'\\"':c;
  }
  return JSON.parse(json+'"');
}
function splitSelectors(text){
  const out=[];let start=0,quote='',escaped=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';}
    else if(c==='"'||c==="'")quote=c;
    else if(c===','){out.push(text.slice(start,i).trim());start=i+1;}
  }
  if(quote)throw unsupported();out.push(text.slice(start).trim());return out;
}
function bracket(text){
  let quote='',escaped=false,depth=0;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'")quote=c;
    else if(c==='[')depth++;
    else if(c===']'&&--depth===0)return [text.slice(1,i),i+1];
  }
  throw unsupported();
}
function filterSelector(text){
  // Simple relative member paths, existence, and comparisons to scalar literals.
  // No coercion, regex, functions, logical expressions or arbitrary evaluation.
  let rest=text.slice(1).trim();
  if(rest.startsWith('(')&&rest.endsWith(')'))rest=rest.slice(1,-1).trim();
  if(!rest.startsWith('@'))throw unsupported();rest=rest.slice(1);
  const keys=[];
  while(rest.startsWith('.')||rest.startsWith('[')){
    if(rest.startsWith('.')){
      const m=/^\.([A-Za-z_$][\w$-]*)/.exec(rest);if(!m)throw unsupported();keys.push(m[1]);rest=rest.slice(m[0].length);
    }else{
      const [content,n]=bracket(rest);const selector=parseSelector(content.trim());
      if(!['key','index'].includes(selector.kind))throw unsupported();keys.push(selector.value);rest=rest.slice(n);
    }
    if(keys.length>40)throw unsupported();
  }
  rest=rest.trim();let op='',expected;
  if(rest){const m=/^(==|!=|<=|>=|<|>)\s*(.+)$/.exec(rest);if(!m)throw unsupported();op=m[1];const literal=m[2].trim();
    expected=literal.startsWith("'")?quoted(literal):JSON.parse(literal);if(object(expected))throw unsupported();}
  return {kind:'filter',keys,op,expected};
}
function parseSelector(text){
  if(text==='*')return {kind:'wildcard'};
  if(text.startsWith('?'))return filterSelector(text);
  if(text[0]==='"'||text[0]==="'"){const value=quoted(text);if(typeof value!=='string')throw unsupported();return {kind:'key',value};}
  if(integer.test(text))return {kind:'index',value:number(text)};
  if(text.includes(':')){
    const parts=text.split(':');if(parts.length<2||parts.length>3)throw unsupported();
    const [start,end,step=1]=parts.map(p=>p.trim()===''?undefined:number(p.trim()));
    if(step===0)throw Error('Slice step cannot be zero.');return {kind:'slice',start,end,step};
  }
  throw unsupported();
}
function parsePath(path){
  let rest=path.slice(1);const segments=[];
  while(rest){
    if(segments.length>=40)throw Error('Path is too deep.');
    let recursive=false;
    if(rest.startsWith('..')){recursive=true;rest=rest.slice(2);}
    else if(rest.startsWith('.')){rest=rest.slice(1);if(rest.startsWith('['))throw unsupported();}
    else if(!rest.startsWith('['))throw unsupported();
    let selectors;
    if(rest.startsWith('[')){
      const [content,n]=bracket(rest);const text=content.trim();
      selectors=(text.startsWith('?')?[text]:splitSelectors(text)).map(parseSelector);rest=rest.slice(n);
    }else{
      const m=/^(\*|[A-Za-z_$][\w$-]*)/.exec(rest);if(!m)throw unsupported();
      selectors=[m[0]==='*'?{kind:'wildcard'}:{kind:'key',value:m[0]}];rest=rest.slice(m[0].length);
    }
    segments.push({recursive,selectors});
  }
  return segments;
}
function get(node,key){
  if(typeof key==='number'){if(!Array.isArray(node))return [false];key=key<0?node.length+key:key;if(key<0||key>=node.length)return [false];}
  else if(Array.isArray(node))return [false];
  return own(node,key)?[true,node[key]]:[false];
}
function matches(node,{keys,op,expected}){
  for(const key of keys){const [found,value]=get(node,key);if(!found)return false;node=value;}
  if(!op)return true;
  if(op==='==')return node===expected;
  if(op==='!=')return node!==expected;
  if(typeof node!==typeof expected||!['number','string'].includes(typeof node))return false;
  return op==='<'?node<expected:op==='>'?node>expected:op==='<='?node<=expected:node>=expected;
}
export function parseAnalysisJson(body){
  if(typeof body!=='string'||body.length>MAX_BODY)throw Error('Response exceeds analysis limit (1 MiB).');
  const root=JSON.parse(body),stack=[[root,0]];let count=0;
  while(stack.length){const [node,depth]=stack.pop();if(++count>MAX_VISITS||depth>100)throw Error('JSON analysis complexity limit exceeded.');
    if(object(node)){for(const value of Object.values(node))stack.push([value,depth+1]);}}
  return root;
}
export function selectJsonPath(body,path='$') {
  if(typeof body!=='string'||body.length>MAX_BODY)throw Error('Response exceeds analysis limit (1 MiB).');
  if(typeof path!=='string'||path.length>512||path[0]!=='$')throw Error('Enter a JSONPath beginning with $.');
  const segments=parsePath(path);let nodes=[parseAnalysisJson(body)],visits=0;
  const visit=()=>{if(++visits>MAX_VISITS)throw Error('JSONPath traversal limit exceeded.');};
  for(const {recursive,selectors} of segments){
    const next=[];const add=value=>{if(next.length>=MAX)throw Error('Too many matches (maximum 1000).');next.push(value);};
    const apply=node=>{
      visit();if(!object(node))return;
      for(const s of selectors){
        if(s.kind==='wildcard'||s.kind==='filter'){
          for(const k of Object.keys(node)){visit();const value=node[k];if(s.kind==='wildcard'||matches(value,s))add(value);}
        }else if(s.kind==='slice'){
          if(!Array.isArray(node))continue;const len=node.length,forward=s.step>0;
          const clamp=n=>Math.min(forward?len:len-1,Math.max(forward?0:-1,n<0?len+n:n));
          const start=s.start===undefined?(forward?0:len-1):clamp(s.start);
          const end=s.end===undefined?(forward?len:-1):clamp(s.end);
          for(let i=start;forward?i<end:i>end;i+=s.step){visit();add(node[i]);}
        }else{const [found,value]=get(node,s.value);if(found)add(value);}
      }
    };
    for(const node of nodes){
      if(!recursive){apply(node);continue;}
      const stack=[node];while(stack.length){const current=stack.pop();apply(current);if(object(current)){const children=Object.values(current);for(let i=children.length-1;i>=0;i--){visit();if(object(children[i]))stack.push(children[i]);}}}
    }
    nodes=next;
  }
  let size=2;
  for(const node of nodes){size+=JSON.stringify(node).length+1;if(size>MAX_BODY)throw Error('JSONPath output exceeds analysis limit.');}
  return nodes;
}
export function compareJsonResponses(before,after){
  if([before,after].some(v=>typeof v!=='string'||v.length>MAX_BODY))throw Error('Each response must be under 1 MiB.');
  const changes=[];let visited=0;
  function walk(a,b,path,depth=0){
    if(++visited>20000||changes.length>=500||path.length>4096||depth>100)throw Error('Diff exceeds analysis limit.');
    if(Object.is(a,b))return;
    const ao=object(a),bo=object(b);
    if(ao&&bo&&Array.isArray(a)===Array.isArray(b)){
      for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
        const p=path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1');
        if(!Object.hasOwn(a,k))changes.push({path:p,kind:'added',after:b[k]});
        else if(!Object.hasOwn(b,k))changes.push({path:p,kind:'removed',before:a[k]});
        else walk(a[k],b[k],p,depth+1);
        if(changes.length>=500)throw Error('Diff exceeds 500 changes.');
      }
    }else changes.push({path:path||'/',kind:'changed',before:a,after:b});
  }
  walk(parseAnalysisJson(before),parseAnalysisJson(after),'');return changes;
}
