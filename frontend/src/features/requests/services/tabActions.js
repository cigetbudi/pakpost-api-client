/** Pure close-plan helper for request-tab context menus. */
export function planTabClose(tabs,targetId,activeId,kind){
  const index=tabs.findIndex(t=>t.id===targetId);
  if(index<0)throw Error('Tab does not exist.');
  let remaining;
  if(kind==='close')remaining=tabs.filter(t=>t.id!==targetId);
  else if(kind==='others')remaining=tabs.filter(t=>t.id===targetId||t.pinned);
  else if(kind==='right')remaining=tabs.filter((t,i)=>i<=index||t.pinned);
  else throw Error('Unsupported tab action.');
  const removedIds=tabs.filter(t=>!remaining.some(r=>r.id===t.id)).map(t=>t.id);
  const nextActiveId=remaining.some(t=>t.id===activeId)?activeId:(remaining.some(t=>t.id===targetId)?targetId:(remaining[index]||remaining[index-1])?.id||null);
  return {remaining,removedIds,nextActiveId,reset:remaining.length===0};
}

/** Drag tab source before/after another open tab, retaining source identity. */
export function reorderTabs(tabs,sourceId,targetId,placement='after'){
  if(sourceId===targetId)return tabs;
  const from=tabs.findIndex(tab=>tab.id===sourceId);
  if(from<0||!tabs.some(tab=>tab.id===targetId))return tabs;
  const next=[...tabs],item=next.splice(from,1)[0];
  const target=next.findIndex(tab=>tab.id===targetId);
  next.splice(target+(placement==='after'?1:0),0,item);
  return next;
}
