/** Collection relationships are independent of request folder paths. */
export const COLLECTION_MIME='application/x-pakpost-collection';
const MAX_DEPTH=12;
const parentOf=item=>item.parentCollectionId||null;
const orderOf=item=>Number.isFinite(Number(item.sortOrder))?Number(item.sortOrder):0;

export function arrangeCollections(collections,sourceId,targetId,placement){
  if(!['inside','before','after','root'].includes(placement))throw Error('Invalid collection placement');
  const result=collections.map(c=>({...c}));
  const byId=new Map(result.map(c=>[c.id,c]));
  const source=byId.get(sourceId);
  if(!source)throw Error('Source collection no longer exists');
  const target=placement==='root'?null:byId.get(targetId);
  if(placement!=='root'&&!target)throw Error('Destination collection no longer exists');
  if(source===target)throw Error('Cannot move a collection into itself');
  const parent=placement==='root'?null:placement==='inside'?target.id:parentOf(target);
  const visited=new Set([source.id]);let cursor=parent,depth=0;
  while(cursor){
    if(visited.has(cursor))throw Error('Cannot move a collection into its descendants');
    visited.add(cursor);
    const node=byId.get(cursor);if(!node)throw Error('Invalid collection hierarchy');
    if(++depth>=MAX_DEPTH)throw Error('Collection nesting limit exceeded');
    cursor=parentOf(node);
  }
  const height=(id,seen=new Set())=>{
    if(seen.has(id))throw Error('Invalid cyclic collection hierarchy');
    const next=new Set(seen);next.add(id);
    return 1+Math.max(0,...result.filter(c=>parentOf(c)===id).map(c=>height(c.id,next)));
  };
  if(depth+height(source.id)>MAX_DEPTH)throw Error('Collection subtree would exceed nesting limit');
  const positions=new Map(result.map((item,i)=>[item.id,i]));
  const siblingOrder=(a,b)=>orderOf(a)-orderOf(b)||positions.get(a.id)-positions.get(b.id);
  const oldParent=parentOf(source);
  const old=result.filter(c=>parentOf(c)===oldParent&&c.id!==sourceId).sort(siblingOrder);
  const siblings=result.filter(c=>parentOf(c)===parent&&c.id!==sourceId).sort(siblingOrder);
  const index=placement==='before'?siblings.findIndex(c=>c.id===targetId):
    placement==='after'?siblings.findIndex(c=>c.id===targetId)+1:siblings.length;
  if(index<0)throw Error('Destination is not a sibling');
  siblings.splice(index,0,source);
  siblings.forEach((c,i)=>{c.parentCollectionId=parent;c.sortOrder=i+1;});
  if(oldParent!==parent)old.forEach((c,i)=>{c.sortOrder=i+1;});
  return result;
}

/** Includes the collection itself, stopping at an orphan/cycle. */
export function collectionParentChain(collections,id){
  const byId=new Map((collections||[]).map(item=>[item.id,item]));
  const chain=[],visited=new Set();let current=id;
  while(current&&byId.has(current)&&!visited.has(current)){
    visited.add(current);chain.push(current);current=byId.get(current).parentCollectionId||null;
  }
  return chain;
}

/** Flatten only visible collection rows, retaining matching ancestors during search. */
export function visibleCollectionNodes(collections,{sort='manual',isOpen=()=>true,search='',requestMatches=()=>false}={}){
  const items=collections||[];
  const map=new Map(items.map(item=>[item.id,item]));
  const groups=new Map();
  for(const item of items){
    const candidate=parentOf(item);
    const parent=candidate&&map.has(candidate)&&candidate!==item.id?candidate:null;
    if(!groups.has(parent))groups.set(parent,[]);
    groups.get(parent).push(item);
  }
  const positions=new Map(items.map((item,i)=>[item.id,i]));
  const compareName=(a,b)=>String(a.name).localeCompare(String(b.name),undefined,{numeric:true,sensitivity:'base'});
  const sorted=items=>[...items].sort((a,b)=>{
    if(sort==='name-asc')return compareName(a,b);
    if(sort==='name-desc')return compareName(b,a);
    if(sort==='newest')return (Date.parse(b.updatedAt||b.createdAt)||0)-(Date.parse(a.updatedAt||a.createdAt)||0)||compareName(a,b);
    return orderOf(a)-orderOf(b)||positions.get(a.id)-positions.get(b.id);
  });
  const term=search.trim().toLowerCase(),included=new Map();
  const matches=(id,seen=new Set())=>{
    if(included.has(id))return included.get(id);
    if(seen.has(id))return false;
    const node=map.get(id);if(!node)return false;
    const next=new Set(seen);next.add(id);
    const value=!term||node.name.toLowerCase().includes(term)||requestMatches(node)||
      (groups.get(id)||[]).some(child=>matches(child.id,next));
    included.set(id,value);return value;
  };
  const output=[],seen=new Set();
  const walk=(parent,depth)=>{
    for(const item of sorted(groups.get(parent)||[])){
      if(seen.has(item.id)||!matches(item.id))continue;
      seen.add(item.id);output.push({collection:item,depth});
      if(term||isOpen(item))walk(item.id,depth+1);
    }
  };
  const reachable=new Set();
  const scan=(parent)=>{for(const item of groups.get(parent)||[]){
    if(reachable.has(item.id))continue;reachable.add(item.id);scan(item.id);
  }};
  scan(null);
  walk(null,0);
  // Corrupt/orphaned graphs must not make collections permanently invisible.
  for(const item of sorted(items))if(!reachable.has(item.id)&&!seen.has(item.id)&&matches(item.id)){
    seen.add(item.id);output.push({collection:item,depth:0});
  }
  return output;
}

let active=null;
const PREFIX='pakpost-collection-dnd:';
export function startCollectionDrag(transfer,payload){
  active=payload;transfer.effectAllowed='move';
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('pakpost:explorer-drag',
    {detail:{kind:'collection',...payload}}));
  const text=JSON.stringify(payload);
  transfer.setData(COLLECTION_MIME,text);
  transfer.setData('text/plain',PREFIX+text);
}
export function isCollectionDrag(transfer){
  const types=[...(transfer?.types||[])];
  return types.includes(COLLECTION_MIME)||(active&&types.includes('text/plain'));
}
export function readCollectionDrag(transfer){
  if(!isCollectionDrag(transfer))return null;
  try{
    const raw=transfer.getData(COLLECTION_MIME)||transfer.getData('text/plain').replace(/^pakpost-collection-dnd:/,'');
    const value=JSON.parse(raw);
    return value?.collectionId&&value?.scope?value:null;
  }catch{return null;}
}
export function endCollectionDrag(){
  if(!active)return;
  active=null;
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('pakpost:explorer-drag',
    {detail:{kind:null}}));
}
export function collectionDropPosition(event){
  const rect=event.currentTarget.getBoundingClientRect();
  const ratio=rect.height>0?(event.clientY-rect.top)/rect.height:0.5;
  return ratio<0.25?'before':ratio>0.75?'after':'inside';
}
