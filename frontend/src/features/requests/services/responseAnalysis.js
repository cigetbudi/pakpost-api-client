// Bounded, non-evaluating JSONPath subset. No script/filter evaluation.
const MAX=1000;
export function selectJsonPath(body,path='$') {
  if(typeof body!=='string'||body.length>1048576)throw Error('Response exceeds analysis limit (1 MiB).');
  if(typeof path!=='string'||path.length>512||path[0]!=='$')throw Error('Enter a JSONPath beginning with $.');
  let nodes=[JSON.parse(body)], rest=path.slice(1), depth=0;
  while(rest.length){
    if(++depth>40)throw Error('Path is too deep.');
    const match=/^(?:\.([A-Za-z_$][\w$-]*|\*)|\[(\d+|\*|"(?:[^"\\]|\\.)*")\])/.exec(rest);
    if(!match)throw Error('Supported: $.key, [0], [*], .*, ["key"]. Filters and recursive descent are not supported.');
    const raw=match[1]??match[2];const wildcard=raw==='*';const key=raw.startsWith('"')?JSON.parse(raw):raw;
    const next=[];
    for(const node of nodes){
      if(node===null||typeof node!=='object')continue;
      if(wildcard){for(const value of Object.values(node)){if(next.length>=MAX)throw Error('Too many matches (maximum 1000).');next.push(value);}}
      else if(Object.prototype.hasOwnProperty.call(node,key)){if(next.length>=MAX)throw Error('Too many matches (maximum 1000).');next.push(node[key]);}
    }
    nodes=next;rest=rest.slice(match[0].length);
  }
  return nodes;
}
export function compareJsonResponses(before,after){
  if([before,after].some(v=>typeof v!=='string'||v.length>1048576))throw Error('Each response must be under 1 MiB.');
  const changes=[];let visited=0;
  function walk(a,b,path){
    if(++visited>20000||changes.length>=500||path.length>4096)throw Error('Diff exceeds analysis limit.');
    if(Object.is(a,b))return;
    const ao=a!==null&&typeof a==='object',bo=b!==null&&typeof b==='object';
    if(ao&&bo&&Array.isArray(a)===Array.isArray(b)){
      for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
        const p=path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1');
        if(!Object.hasOwn(a,k))changes.push({path:p,kind:'added',after:b[k]});
        else if(!Object.hasOwn(b,k))changes.push({path:p,kind:'removed',before:a[k]});
        else walk(a[k],b[k],p);
        if(changes.length>=500)throw Error('Diff exceeds 500 changes.');
      }
    }else changes.push({path:path||'/',kind:'changed',before:a,after:b});
  }
  walk(JSON.parse(before),JSON.parse(after),'');return changes;
}
