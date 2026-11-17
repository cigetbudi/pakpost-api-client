/** Sort only root collections; never mutate persisted manual order. */
export function sortCollectionRoots(collections, sort='manual') {
  const items=[...(collections||[])];
  if(sort==='manual')return items;
  const name=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'});
  if(sort==='name-asc')return items.sort(name);
  if(sort==='name-desc')return items.sort((a,b)=>name(b,a));
  if(sort==='newest')return items.sort((a,b)=>{
    const ta=Date.parse(a.updatedAt||a.updated_at||a.createdAt||a.created_at||0)||0;
    const tb=Date.parse(b.updatedAt||b.updated_at||b.createdAt||b.created_at||0)||0;
    return tb-ta||name(a,b);
  });
  return items;
}
