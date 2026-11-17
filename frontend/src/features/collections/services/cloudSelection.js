/** Cloud explorer selection stays in memory, scoped to one expanded collection. */
export const folderKey = id => `folder:${id}`;
export const requestKey = id => `request:${id}`;

export function selectCloudItem(current, anchor, key, visible, {toggle=false, range=false}={}) {
  const order = [...new Set(visible)];
  if (!order.includes(key)) return {keys:[key],anchor:key};
  if (range && order.includes(anchor)) {
    const start=order.indexOf(anchor),end=order.indexOf(key);
    const section=order.slice(Math.min(start,end),Math.max(start,end)+1);
    return {keys:toggle?[...new Set([...current,...section])]:section,anchor};
  }
  if (toggle) return {keys:current.includes(key)?current.filter(x=>x!==key):[...current,key],anchor:key};
  return {keys:[key],anchor:key};
}

export function buildCloudDeletePayload(keys,folders,requests) {
  const folderById=new Map(folders.map(f=>[f.id,f]));
  const requestById=new Map(requests.map(r=>[r.id,r]));
  const selectedFolders=[],selectedRequests=[];
  for(const key of [...new Set(keys)]) {
    const idx=key.indexOf(':');
    const kind=key.slice(0,idx),id=key.slice(idx+1);
    if(kind==='folder') {
      const f=folderById.get(id);
      if(!f)throw Error('A selected folder is missing; reload and retry');
      selectedFolders.push({id,version:f.version});
    } else if(kind==='request') {
      if(!requestById.has(id))throw Error('A selected request is missing; reload and retry');
      selectedRequests.push(id);
    }
  }
  if(selectedFolders.length+selectedRequests.length===0||selectedFolders.length+selectedRequests.length>200)
    throw Error('Select between 1 and 200 folders or requests');
  return {folders:selectedFolders,requestIds:selectedRequests};
}
