import { useRef, useState } from 'react';
import { readWorkspaceCollectionDocs } from '../services/documentationStore.js';

/** Transient collection, import, save and dialog state scoped to one workbench. */
export function useCollectionDialogState({ initialImportScope, storage }) {
  const [creatingLocalCollection, setCreatingLocalCollection] = useState(false);
  const [collectionImportOpen,setCollectionImportOpen] = useState(false);
  const [collectionImportFile,setCollectionImportFile] = useState(null);
  const [collectionImportDestination,setCollectionImportDestination] = useState(initialImportScope);
  const [collectionImportError,setCollectionImportError] = useState('');
  const [collectionImportBusy,setCollectionImportBusy] = useState(false);
  const [localCollectionName, setLocalCollectionName] = useState('');
  const selectedColRef=useRef(null); // Controller updates ref after each selection.
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveExampleOpen, setSaveExampleOpen] = useState(false);
  const [exampleName, setExampleName] = useState('');
  const [exampleDescription, setExampleDescription] = useState('');
  const [saveScope,setSaveScope] = useState('local');
  const [saveLocalCollection,setSaveLocalCollection] = useState('');
  const [actionDialog,setActionDialog] = useState(null);
  const [actionName,setActionName] = useState('');
  const [workspaceMenu,setWorkspaceMenu] = useState(null);
  const [documentationTarget,setDocumentationTarget]=useState(null);
  const [docBusy,setDocBusy]=useState(false);
  const [workspaceCollectionDocs,setWorkspaceCollectionDocs]=useState(()=>readWorkspaceCollectionDocs(storage));
  const [workspaceSorted,setWorkspaceSorted]=useState(()=>{try{return JSON.parse(storage.getItem('pakpost_workspace_sort')||'{}')}catch{return {}}});
  const tabDragRef=useRef(null);
  const [saveName, setSaveName] = useState('New request');
  const [saveWs, setSaveWs] = useState('');
  const [saveCollection, setSaveCollection] = useState('');
  const [saveCols, setSaveCols] = useState([]);
  const [busyAction, setBusyAction] = useState(false);
  return {
    creatingLocalCollection, setCreatingLocalCollection, collectionImportOpen, setCollectionImportOpen,
    collectionImportFile, setCollectionImportFile, collectionImportDestination, setCollectionImportDestination,
    collectionImportError, setCollectionImportError, collectionImportBusy, setCollectionImportBusy,
    localCollectionName, setLocalCollectionName, selectedColRef, saveOpen, setSaveOpen,
    saveExampleOpen, setSaveExampleOpen, exampleName, setExampleName,
    exampleDescription, setExampleDescription, saveScope, setSaveScope,
    saveLocalCollection, setSaveLocalCollection, actionDialog, setActionDialog,
    actionName, setActionName, workspaceMenu, setWorkspaceMenu,
    documentationTarget, setDocumentationTarget, docBusy, setDocBusy,
    workspaceCollectionDocs, setWorkspaceCollectionDocs, workspaceSorted, setWorkspaceSorted,
    tabDragRef, saveName, setSaveName, saveWs, setSaveWs, saveCollection, setSaveCollection,
    saveCols, setSaveCols, busyAction, setBusyAction,
  };
}
