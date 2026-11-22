import { useEffect } from 'react';
import { writeWorkbenchCache } from '../../workspace/services/workspaceCache.js';
import { sandboxCacheTabIds } from '../services/qaSandbox.js';
import { canWorkspace, currentWorkspaceMember } from '../../workspace/services/workspaceRoles.js';

/** Debounced workbench draft recovery, preserving RAM-only Cloud request rules. */
export function useRequestDraftRecovery({
    openTabs, activeTabRef, draftsRef, snapshot, recent, split, explorerTab, sidebarCollapsed,
    activeEnvId, envScope, selectedWs, membersWorkspaceId, members, me,
    method, url, rows, body, documentation, format, formFields, binaryFile,
    preScript, postScript, responseExamples, scriptLog, scriptTests, scriptError,
    scriptDiagnostic, reqTab, resTab, result, params, authType, bearerToken,
    basicUsername, basicPassword, apiKeyName, apiKeyValue, apiKeyIn, activeTabId,
  }) {
  // Persist drafts for refresh recovery (debounced, plus a beforeunload flush).
  useEffect(()=>{
    const persist=()=>writeWorkbenchCache({openTabs,activeTabId:activeTabRef.current,
      drafts:draftsRef.current,active:snapshot(),recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope,
      // Cloud requests are RAM-only for ALL roles, not only QA/Writer.
      sandboxTabIds:sandboxCacheTabIds(openTabs,selectedWs,membersWorkspaceId===selectedWs&&canWorkspace(currentWorkspaceMember(members,me),'collection.write'))});
    const timer=setTimeout(persist,600);
    window.addEventListener('beforeunload',persist);
    return ()=>{clearTimeout(timer);window.removeEventListener('beforeunload',persist)};
  },[method,url,rows,body,documentation,format,formFields,binaryFile,preScript,postScript,responseExamples,scriptLog,scriptTests,scriptError,scriptDiagnostic,
    reqTab,resTab,result,params,authType,bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn,openTabs,activeTabId,recent,split,explorerTab,sidebarCollapsed,activeEnvId,envScope,selectedWs,members,membersWorkspaceId,me]);
}
