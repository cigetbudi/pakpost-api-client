// Presentation-only composition: state, API calls and mutation stay in App until their controllers are extracted.
// Each dependency is explicit so this component can be tested independently.
export function CommandPalette(props) {
  const {
    ArrowRight, Code2, Search, commandIndex, commandOpen, commandQuery, setCommandIndex,
    setCommandOpen, setCommandQuery, visibleCommandItems,
  } = props;
  return <>
    {commandOpen && <div className="pp-command-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCommandOpen(false);}}><section className="pp-command-dialog" role="dialog" aria-modal="true" aria-label="Quick search and commands"><div className="pp-command-input-wrap"><Search size={18}/><input autoFocus aria-label="Search commands" value={commandQuery} onChange={e=>{setCommandQuery(e.target.value);setCommandIndex(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setCommandIndex(i=>Math.min(visibleCommandItems.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setCommandIndex(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&visibleCommandItems.length){e.preventDefault();setCommandOpen(false);visibleCommandItems[Math.min(commandIndex,visibleCommandItems.length-1)].run();}}} placeholder="Find a request or run a command..."/><kbd>Esc</kbd></div><div className="pp-command-results" role="listbox">{visibleCommandItems.length?visibleCommandItems.map((item,i)=><button type="button" role="option" aria-selected={commandIndex===i} onMouseEnter={()=>setCommandIndex(i)} key={item.key} onClick={()=>{setCommandOpen(false);item.run();}}>{item.method?<span className={`pp-http-label ${item.method.toLowerCase()}`}>{item.method}</span>:<Code2 size={15}/>}<span><strong>{item.title}</strong><small>{item.subtitle}</small></span><ArrowRight size={14}/></button>):<div className="pp-command-empty">No matching requests or commands.</div>}</div></section></div>}

  </>;
}
