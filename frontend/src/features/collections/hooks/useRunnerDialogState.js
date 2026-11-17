import { useRef, useState } from 'react';

/** Transient Runner dialog state; never persisted to a Workspace. */
export function useRunnerDialogState() {
  const [runnerTarget, setRunnerTarget] = useState(null);
  const [runnerLoading, setRunnerLoading] = useState(false);
  const runnerFetchId = useRef(0);
  return {runnerTarget,setRunnerTarget,runnerLoading,setRunnerLoading,runnerFetchId};
}
