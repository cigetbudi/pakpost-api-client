import { useEffect, useRef, useState } from 'react';

/** Per-Workbench volatile overlays. Tokens and script values never enter persistent stores. */
export function useCollectionSessionState(token) {
  // Never persist QA/Writer Cloud environment edits. Their script changes are RAM-only.
  const sessionEnvironmentOverlays=useRef(new Map());
  const sessionCollectionVariables=useRef(new Map());
  // Cached shared defaults are scoped by user/workspace/collection and stay in RAM.
  const savedCollectionVariablesCache=useRef(new Map());
  const [collectionVariablesTarget,setCollectionVariablesTarget]=useState(null);
  const [collectionVariablesData,setCollectionVariablesData]=useState(null);
  const [collectionVariablesLoading,setCollectionVariablesLoading]=useState(false);
  const [collectionVariablesError,setCollectionVariablesError]=useState('');
  const [collectionVariablesBusy,setCollectionVariablesBusy]=useState(false);
  const collectionVariablesFetchId=useRef(0);
  const sessionDocumentationOverlays=useRef(new Map());
  const [,refreshSessionEnvironment]=useState(0);
  useEffect(()=>{sessionEnvironmentOverlays.current.clear();sessionCollectionVariables.current.clear();savedCollectionVariablesCache.current.clear();setCollectionVariablesTarget(null);sessionDocumentationOverlays.current.clear();refreshSessionEnvironment(v=>v+1);},[token]);

  return {
    sessionEnvironmentOverlays, sessionCollectionVariables, savedCollectionVariablesCache, collectionVariablesTarget, setCollectionVariablesTarget, collectionVariablesData,
    setCollectionVariablesData, collectionVariablesLoading, setCollectionVariablesLoading, collectionVariablesError, setCollectionVariablesError, collectionVariablesBusy,
    setCollectionVariablesBusy, collectionVariablesFetchId, sessionDocumentationOverlays, refreshSessionEnvironment,
  };
}
