/** Toggle comments for selected CodeMirror lines; mirrors Ctrl/Cmd+/ in popular IDEs. */
export function toggleLineComment(view,language='json'){
  const marker=language==='xml'||language==='html'?null:language==='python'||language==='shell'?'#':'//';
  if(!marker)return false;
  const {state}=view;
  const ranges=state.selection.ranges;
  const lines=new Map();
  for(const range of ranges){
    let from=state.doc.lineAt(range.from).number;
    let to=state.doc.lineAt(range.to).number;
    if(range.to>range.from&&state.doc.lineAt(range.to).from===range.to)to--;
    for(let n=from;n<=to;n++){const line=state.doc.line(n);lines.set(n,line);}
  }
  const selected=[...lines.values()];
  const active=selected.filter(l=>l.text.trim().length);
  if(!active.length)return true;
  const uncomment=active.every(l=>l.text.trimStart().startsWith(marker));
  const changes=active.map(line=>{
    const indentation=line.text.length-line.text.trimStart().length;
    const insertAt=line.from+indentation;
    if(uncomment){const suffix=line.text.slice(indentation+marker.length).startsWith(' ')?1:0;
      return {from:insertAt,to:insertAt+marker.length+suffix,insert:''};}
    return {from:insertAt,insert:`${marker} `};
  });
  view.dispatch({changes,userEvent:'input'});
  return true;
}
