// Close, duplicate, unsaved confirmation and tab context menu.
export function createRequestTabManagementActions(dependencies) {
  const {
    activeTabRef, binaryFile, draftsRef, freshRequest, method,
    needsCloseConfirmation, openTabs, planTabClose, requestFingerprint, result,
    scriptError, scriptLog, scriptTests, setCloseConfirmation, setOpenTabs,
    setTabMenu, tabSequence, stashActive, selectTabFromDraft,
  } = dependencies;

  function closeTab(id){performTabAction('close',id);}
  function performTabAction(action,id,confirmed=false){
      setTabMenu(null);
      if(action==='pin'){setOpenTabs(tabs=>tabs.map(tab=>tab.id===id?{...tab,pinned:!tab.pinned}:tab));return;}
      if(action==='duplicate'){
        stashActive();const source=draftsRef.current[id];if(!source)return;
        const newId=`t${++tabSequence.current}`;
        const cloned=JSON.parse(JSON.stringify(source));
        draftsRef.current[newId]={...cloned,binaryFile:{name:cloned.binaryFile?.name||'',base64:''},result:null,scriptLog:[],scriptTests:[],scriptError:''};
        const sourceTab=openTabs.find(t=>t.id===id);
        const index=openTabs.findIndex(t=>t.id===id);
        const copyName=`${sourceTab?.name||'Request'} (copy)`;
        setOpenTabs(t=>[...t.slice(0,index+1),{id:newId,name:copyName,savedName:copyName,method:cloned.method,source:null,pendingCopy:true,savedFingerprint:requestFingerprint(cloned,copyName)},...t.slice(index+1)]);
        selectTabFromDraft(newId);return;
      }
      stashActive();
      const plan=planTabClose(openTabs,id,activeTabRef.current,action);
      if(!confirmed){
        const unsaved=plan.removedIds.filter(tabId=>{
          const tab=openTabs.find(t=>t.id===tabId);
          return needsCloseConfirmation(tab,draftsRef.current[tabId]);
        });
        if(unsaved.length){setCloseConfirmation({action,id,unsaved});return;}
      }
      setCloseConfirmation(null);
      if(plan.reset){
        const blank=freshRequest('Untitled Request');const blankId=id;
        draftsRef.current={[blankId]:blank};
        setOpenTabs([{id:blankId,name:'Untitled Request',savedName:'Untitled Request',method:'GET',savedFingerprint:requestFingerprint(blank,'Untitled Request')}]);
        selectTabFromDraft(blankId);return;
      }
      const removed=new Set(plan.removedIds);
      for(const key of removed)delete draftsRef.current[key];
      setOpenTabs(plan.remaining);
      if(plan.nextActiveId!==activeTabRef.current)selectTabFromDraft(plan.nextActiveId);
    }
  function showTabContext(e,id){
      e.preventDefault();e.stopPropagation();
      setTabMenu({id,x:Math.max(8,Math.min(e.clientX,window.innerWidth-224)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-190))});
    }

  return { closeTab, performTabAction, showTabContext };
}
