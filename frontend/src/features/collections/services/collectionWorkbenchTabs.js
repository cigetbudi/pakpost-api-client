// Collection tab identifiers cannot collide with request IDs (t1, t2, ...).
export function collectionTabId(target) {
  return 'collection:'+JSON.stringify([target.scope,target.workspaceId||'',target.collectionId]);
}
export function openCollectionTab(tabs,target) {
  const id=collectionTabId(target);
  return tabs.some(t=>t.id===id)?tabs: [...tabs,{id,target:{...target},dirty:false,busy:false}];
}
// Respect request-store ordering, retain collection placement and discard closed IDs.
export function mixedTabOrder(requests,collections,previous=[]) {
  const requestIds=requests.map(t=>t.id),collectionIds=collections.map(t=>t.id);
  const known=new Set([...requestIds,...collectionIds]);
  const retained=[...new Set(previous.filter(id=>known.has(id)))];
  for(const id of known)if(!retained.includes(id))retained.push(id);
  const requestSet=new Set(requestIds);let next=0;
  return retained.map(id=>requestSet.has(id)?requestIds[next++]:id);
}
export function moveMixedTab(order,from,to,placement) {
  if(from===to||!order.includes(from)||!order.includes(to))return order;
  const next=order.filter(id=>id!==from);
  next.splice(next.indexOf(to)+(placement==='after'?1:0),0,from);
  return next;
}
