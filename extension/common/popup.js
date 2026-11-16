/* Popup configuration. All permissions are requested from a user click, not at install time. */
const api=typeof browser!=='undefined'?browser:chrome;
const $=id=>document.getElementById(id);
const SETTINGS={allowedOrigins:[],allowedDestinations:[]};
const KEY={origins:'allowedOrigins',destinations:'allowedDestinations'};
function normalize(value){
  try{const url=new URL(String(value).trim());
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use an origin only, without a path.');
    return url.origin;
  }catch(error){throw Error(`Invalid origin: ${error.message}`)}
}
function pattern(origin){const url=new URL(origin);return `${url.protocol}//${url.hostname}/*`}
function notice(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error)}
async function save(){await api.storage.local.set(SETTINGS)}
function renderList(which){
  const list=SETTINGS[which],target=$(which==='allowedOrigins'?'originList':'destList');
  target.replaceChildren();
  $(which==='allowedOrigins'?'originCount':'destCount').textContent=String(list.length);
  if(!list.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No origins added yet';target.appendChild(empty);return;}
  for(const origin of list){
    const row=document.createElement('div');row.className='entry';
    const title=document.createElement('label');title.textContent=origin;title.title=origin;
    const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove '+origin;
    remove.setAttribute('aria-label','Remove '+origin);
    remove.addEventListener('click',()=>removeEntry(which,origin));
    row.append(title,remove);target.appendChild(row);
  }
}
async function sync(){const response=await api.runtime.sendMessage({kind:'PAKPOST_SYNC'});
  if(!response?.ok)throw Error(response?.error||'Cannot update content script permission')}
async function removeEntry(which,origin){
  try{
    SETTINGS[which]=SETTINGS[which].filter(entry=>entry!==origin);
    await save();
    if(which==='allowedOrigins')await sync();
    const stillUsed=[...SETTINGS.allowedOrigins,...SETTINGS.allowedDestinations].some(item=>pattern(item)===pattern(origin));
    if(!stillUsed)await api.permissions.remove({origins:[pattern(origin)]});
    renderList(which);notice('Permission removed. Reload Pakpost if its origin changed.');
  }catch(error){notice(error.message,true)}
}
function addEntry(which,event){
  event.preventDefault();
  const input=$(which==='allowedOrigins'?'originInput':'destInput');
  let origin;
  try{origin=normalize(input.value);if(SETTINGS[which].includes(origin)){notice('Already in the list');return}
    if(SETTINGS[which].length>=32)throw Error('Maximum 32 entries per list');
  }catch(error){notice(error.message,true);return}
  // Permissions.request MUST be called directly from the user gesture.
  api.permissions.request({origins:[pattern(origin)]}).then(async granted=>{
    if(!granted){notice('Permission not granted. Nothing was added.',true);return}
    try{
      SETTINGS[which].push(origin);await save();
      if(which==='allowedOrigins')await sync();
      renderList(which);input.value='';notice(`${origin} added. ${which==='allowedOrigins'?'Reload the Pakpost website.':'You may send requests to this API now.'}`);
    }catch(error){notice(error.message,true)}
  }).catch(error=>notice(error.message,true));
}
$('originForm').addEventListener('submit',event=>addEntry('allowedOrigins',event));
$('destForm').addEventListener('submit',event=>addEntry('allowedDestinations',event));
(async()=>{
  try{
    const stored=await api.storage.local.get(Object.values(KEY));
    for(const key of Object.values(KEY))SETTINGS[key]=Array.isArray(stored[key])?stored[key].filter(x=>typeof x==='string'):[];
    renderList('allowedOrigins');renderList('allowedDestinations');
    // Opening the popup is a user gesture and allows inspecting the active tab.
    const tabs=await api.tabs.query({active:true,currentWindow:true});
    try{$('originInput').value=normalize(tabs?.[0]?.url||'')}catch{}
  }catch(error){notice(error.message,true)}
})();

// v27.1 bulk destination onboarding. No permission is requested until the user
// reviews the explicit host list and presses Grant selected destinations.
function reviewCandidates(values){
  const found=[];const seen=new Set(SETTINGS.allowedDestinations);
  let skipped=0;
  for(const raw of values||[]){
    let origin='';
    try{
      const parsed=new URL(String(raw||'').trim());
      if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||!parsed.hostname)throw Error('Invalid URL');
      origin=parsed.origin;
      if(/[{}<>]/.test(parsed.host))throw Error('Unresolved variable');
    }catch{skipped++;continue}
    if(seen.has(origin))continue;
    seen.add(origin);found.push(origin);
    if(found.length>=96)break;
  }
  const section=$('reviewSection'),list=$('reviewList');list.replaceChildren();
  section.classList.remove('hidden');
  const remaining=Math.max(0,32-SETTINGS.allowedDestinations.length);
  $('selectAll').checked=found.length>0&&found.length<=remaining;
  $('selectAll').indeterminate=found.length>remaining;
  for(const [index,origin] of found.entries()){
    const row=document.createElement('label');row.className='review-entry';row.title=origin;
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=origin;
    checkbox.checked=index<remaining;
    const title=document.createElement('span');title.textContent=origin;
    row.append(checkbox,title);list.appendChild(row);
  }
  if(!found.length){const empty=document.createElement('div');empty.className='review-empty';
    empty.textContent='No new destinations. Your previously approved hosts are already in the list.';list.appendChild(empty)}
  $('reviewCount').textContent=String(found.length);
  const extra=skipped?` (${skipped} invalid/unresolved URL(s) skipped)` : '';
  notice(found.length?`${found.length} unique new destination(s) found. Review and grant the ones you trust.${extra}`:
    `No new API destinations found.${extra}`);
}
$('scanButton').addEventListener('click',async()=>{
  const button=$('scanButton');button.disabled=true;button.textContent='Scanning…';
  try{
    const tabs=await api.tabs.query({active:true,currentWindow:true});
    const tab=tabs?.[0];if(!tab?.id)throw Error('No active browser tab. Open your Pakpost tab first.');
    const activeUrl=new URL(tab.url||'');
    if(!['http:','https:'].includes(activeUrl.protocol))throw Error('Open a Pakpost HTTP(S) tab first.');
    const activeOrigin=activeUrl.origin;
    if(!SETTINGS.allowedOrigins.includes(activeOrigin))throw Error('Add this Pakpost website under Allowed Pakpost Origins first, then reload the website.');
    const res=await api.tabs.sendMessage(tab.id,{kind:'PAKPOST_DISCOVER_HOSTS'});
    if(!res?.ok)throw Error(res?.error||'No response from Pakpost. Reload the page and try again.');
    reviewCandidates(res.origins);
  }catch(error){notice(`Scan failed: ${error.message||error}. Make sure Pakpost is open and reloaded.`,true)}
  finally{button.disabled=false;button.textContent='Scan this Pakpost tab'}
});
$('previewBulk').addEventListener('click',()=>{
  const pasted=$('bulkInput').value.trim();if(!pasted){notice('Paste URLs first.',true);return}
  reviewCandidates(pasted.split(/[\s,;]+/).filter(Boolean));
});
$('selectAll').addEventListener('change',event=>{
  const checked=event.currentTarget.checked;
  for(const box of $('reviewList').querySelectorAll('input[type="checkbox"]'))box.checked=checked;
});
$('grantSelected').addEventListener('click',()=>{
  const selected=[...$('reviewList').querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
  const available=32-SETTINGS.allowedDestinations.length;
  if(!selected.length){notice('Select at least one destination first.',true);return}
  if(selected.length>available){notice(`Choose up to ${available} more destination(s). You can remove older entries first.`,true);return}
  // MUST run directly within the click handler (Firefox/Chrome user gesture).
  // A single permissions.request covers the selected hosts; browser owns the approval UI.
  const patterns=[...new Set(selected.map(pattern))];
  let permissionRequest;
  try{permissionRequest=api.permissions.request({origins:patterns})}
  catch(error){notice(`Permission error: ${error.message||error}`,true);return}
  permissionRequest.then(async granted=>{
    if(!granted){notice('Browser permission was not granted; no destinations were added.',true);return}
    try{
      SETTINGS.allowedDestinations=[...new Set([...SETTINGS.allowedDestinations,...selected])];
      await save();renderList('allowedDestinations');reviewCandidates([]);
      $('reviewSection').classList.add('hidden');
      notice(`${selected.length} destination(s) approved. You can Send from Pakpost now.`);
    }catch(error){notice(`Could not save destinations: ${error.message}`,true)}
  }).catch(error=>notice(`Permission denied: ${error.message||error}`,true));
});
