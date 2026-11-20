import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {requestKey} from '../services/cloudSelection.js';
import {getWorkspaceRequestIndexPage} from '../services/workspaceRequestRepository.js';
import {CLOUD_SERVER_PAGE_SIZE,cloudVirtualWindow} from '../services/cloudRenderBudget.js';

function VirtualRequestRows({rows,renderRow,enabled}){
  const anchorRef=useRef(null);
  const [windowRange,setWindowRange]=useState({start:0,end:100,top:0,bottom:0});
  useEffect(()=>{
    if(!enabled)return;
    const anchor=anchorRef.current;
    const scroll=anchor?.closest('.pp-side-scroll');
    if(!scroll)return;
    let raf=0;
    const update=()=>{
      const viewport=scroll.getBoundingClientRect();
      const bounds=anchor.getBoundingClientRect();
      const offset=Math.max(0,viewport.top-bounds.top);
      const next=cloudVirtualWindow(rows.length,offset,viewport.height);
      setWindowRange(current=>current.start===next.start&&current.end===next.end?current:next);
    };
    const schedule=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;update();});};
    update();
    scroll.addEventListener('scroll',schedule,{passive:true});
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
    resize?.observe(scroll);
    return()=>{scroll.removeEventListener('scroll',schedule);resize?.disconnect();if(raf)cancelAnimationFrame(raf);};
  },[enabled,rows.length]);
  const range=enabled?windowRange:{start:0,end:rows.length,top:0,bottom:0};
  return <div ref={anchorRef} className="pp-cloud-windowed-list">
    {range.top>0&&<div aria-hidden="true" style={{height:range.top}}/>}
    {rows.slice(range.start,range.end).map(renderRow)}
    {range.bottom>0&&<div aria-hidden="true" style={{height:range.bottom}}/>}
  </div>;
}

export function CloudPagedRequestRows({workspaceId,collectionId,token,folderId=null,rootOnly=false,
  search='',depth,renderRequest,selection,choose,onContextMenu,onError,onRows,sortByName=false,
  virtualize=true,refreshKey=0}){
  const [rows,setRows]=useState([]),[cursor,setCursor]=useState(''),[hasMore,setHasMore]=useState(true);
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const requestId=useRef(0),loadingRef=useRef(false),onRowsRef=useRef(onRows);
  const sentinelRef=useRef(null),nextAbortRef=useRef(null);
  onRowsRef.current=onRows;
  const query=String(search||'').trim().slice(0,120);
  const resetKey=`${workspaceId}:${collectionId}:${folderId||'all'}:${rootOnly}:${sortByName}:${query}:${refreshKey}:${retry}`;
  // A ref prevents overlapping scroll requests. Stale responses are ignored on
  // Workspace switch, search changes, and unmount.
  useEffect(()=>{
    const id=++requestId.current;
    loadingRef.current=false;setRows([]);setCursor('');setHasMore(true);setError('');
    onRowsRef.current?.([],true);
    let cancelled=false;
    const controller=new AbortController();
    loadingRef.current=true;setLoading(true);
    getWorkspaceRequestIndexPage(workspaceId,collectionId,token,
      {size:CLOUD_SERVER_PAGE_SIZE,search:query,folderId,rootOnly,sortByName,signal:controller.signal})
      .then(data=>{
        if(cancelled||id!==requestId.current)return;
        const items=Array.isArray(data?.items)?data.items:[];
        setRows(items);onRowsRef.current?.(items,false);
        setCursor(data?.nextCursor||'');setHasMore(!!data?.hasMore&&!!data?.nextCursor);
      })
      .catch(err=>{if(!cancelled&&id===requestId.current){setError(err.message||'Cannot load requests');onError?.(err.message||'Cannot load requests');}})
      .finally(()=>{if(!cancelled&&id===requestId.current){loadingRef.current=false;setLoading(false);}});
    return()=>{cancelled=true;controller.abort();nextAbortRef.current?.abort();requestId.current++;};
  },[resetKey,token]);
  const next=useCallback(async()=>{
    if(!hasMore||!cursor||loadingRef.current)return;
    const id=requestId.current;loadingRef.current=true;setLoading(true);
    const controller=new AbortController();nextAbortRef.current=controller;
    try{
      const data=await getWorkspaceRequestIndexPage(workspaceId,collectionId,token,
        {after:cursor,size:CLOUD_SERVER_PAGE_SIZE,search:query,folderId,rootOnly,sortByName,signal:controller.signal});
      if(id!==requestId.current)return;
      const items=Array.isArray(data?.items)?data.items:[];
      const seen=new Set(rows.map(item=>item.id));
      const added=items.filter(item=>!seen.has(item.id));
      onRowsRef.current?.(added,false);
      setRows(current=>[...current,...added]);
      setCursor(data?.nextCursor||'');setHasMore(!!data?.hasMore&&!!data?.nextCursor);
      setError('');
    }catch(err){if(id===requestId.current){setError(err.message||'Cannot load more requests');}}
    finally{if(nextAbortRef.current===controller)nextAbortRef.current=null;
      if(id===requestId.current){loadingRef.current=false;setLoading(false);}}
  },[workspaceId,collectionId,token,query,folderId,rootOnly,sortByName,cursor,hasMore,rows]);
  useEffect(()=>{
    const node=sentinelRef.current;
    if(!node||!hasMore||loading||typeof IntersectionObserver==='undefined')return;
    const root=node.closest('.pp-side-scroll');
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(item=>item.isIntersecting))next();
    },{root:root||null,rootMargin:'180px'});
    observer.observe(node);return()=>observer.disconnect();
  },[rows.length,hasMore,loading,next]);
  const selected=useMemo(()=>new Set(selection),[selection]);
  const renderRow=useCallback(item=>{
    const key=requestKey(item.id);
    return <React.Fragment key={item.id}>{renderRequest(item,depth,{
      'data-cloud-select-key':key,'aria-pressed':selected.has(key),
      className:selected.has(key)?'pp-cloud-selected':'',
      onClick:event=>choose(event,key),
      onContextMenu:event=>onContextMenu(event,key)
    })}</React.Fragment>;
  },[renderRequest,depth,selected,choose,onContextMenu]);
  return <>
    <VirtualRequestRows rows={rows} renderRow={renderRow} enabled={virtualize&&!query&&rows.length>200}/>
    {loading&&<div className="pp-tree-hint">Loading request page…</div>}
    {!loading&&!error&&rows.length===0&&<div className="pp-tree-hint">No requests in this view</div>}
    {!!error&&<div className="pp-tree-hint" role="alert">{error} <button type="button"
      onClick={()=>{if(rows.length===0)setRetry(count=>count+1);else next();}}>Retry</button></div>}
    {hasMore&&!!cursor&&<div ref={sentinelRef} className="pp-cloud-more-requests">
      <button type="button" disabled={loading} onClick={next}>Load more Cloud requests ({rows.length} loaded)</button>
    </div>}
  </>;
}
