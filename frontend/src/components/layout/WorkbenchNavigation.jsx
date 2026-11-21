// Presentation-only composition: state, API calls and mutation stay in App until their controllers are extracted.
// Each dependency is explicit so this component can be tested independently.
export function WorkbenchNavigation(props) {
  const {
    Code2, FileUp, History, Layers3, PanelLeftClose, PanelLeftOpen, Settings2,
    Variable, endRightResize, explorerTab, openContext, page, resizeRight,
    resizingRight, setPage, setRightWidth, setSidebarCollapsed, sidebarCollapsed,
  } = props;
  return <>
      <nav className="pp-rail pp-module-rail" aria-label="Main modules">
        <button className={page!=='settings'?'selected':''} aria-label="REST" title="REST API client" onClick={()=>setPage('tester')}><Code2 size={20}/><span>REST</span></button>
        <div className="pp-rail-spacer"/>
        <button className={page==='settings'?'selected':''} aria-label="Settings" title="Settings" onClick={()=>setPage('settings')}><Settings2 size={20}/><span>Settings</span></button>
      </nav>
      {page==='tester'&&<nav className="pp-context-rail" aria-label="Context panels">
        {[["collections","Collections",Layers3],["environments","Environments",Variable],["history","History",History],["code","Generate Code",Code2],["exchange","Import / Export",FileUp]].map(([id,title,Icon])=><button key={id} className={!sidebarCollapsed&&explorerTab===id?'selected':''} aria-label={title} title={title} onClick={()=>{if(!sidebarCollapsed&&explorerTab===id)setSidebarCollapsed(true);else openContext(id)}}><Icon size={18}/></button>)}
        <div className="pp-rail-spacer"/>
        <button title={sidebarCollapsed?'Show context panel':'Hide context panel'} aria-label={sidebarCollapsed?'Show context panel':'Hide context panel'} onClick={()=>setSidebarCollapsed(v=>!v)}>{sidebarCollapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
        {!sidebarCollapsed&&<div className="pp-context-resizer" role="separator" aria-label="Resize context panel" aria-orientation="vertical" tabIndex={0} onPointerDown={e=>{e.preventDefault();resizingRight.current=true;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={resizeRight} onPointerUp={endRightResize} onPointerCancel={endRightResize} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setRightWidth(w=>Math.max(280,Math.min(650,w+(e.key==='ArrowLeft'?16:-16))))}}}><span/></div>}
      </nav>}
  </>;
}
