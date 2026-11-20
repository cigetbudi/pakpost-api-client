/** Drag context is private to this workbench and clears at the end of a drag.
 * Browser dragover events cannot reliably read DataTransfer payload data. */
let active=null;
const PREFIX='pakpost-request-dnd:';
export function startRequestDrag(transfer,mime,payload){
  active={mime,payload};transfer.effectAllowed='move';
  transfer.setData(mime,JSON.stringify(payload));
  transfer.setData('text/plain',PREFIX+JSON.stringify({mime,payload}));
}
export function peekRequestDrag(mime){return active?.mime===mime?active.payload:null;}
export function isRequestDrag(transfer,mime){
  const types=Array.from(transfer?.types||[]);
  return types.includes(mime)||(active?.mime===mime&&types.includes('text/plain'));
}
export function readRequestDrag(transfer,mime){
  if(!isRequestDrag(transfer,mime))return null;
  try{
    const raw=transfer.getData(mime);
    if(raw)return JSON.parse(raw);
    if(active?.mime===mime)return active.payload;
    return null;
  }catch{return null;}
}
export function endRequestDrag(){active=null;}
export function dragRowPlacement(event){
  const rect=event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}
