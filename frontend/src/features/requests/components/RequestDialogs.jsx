import {UnsavedChangesDialog} from './UnsavedChangesDialog.jsx';
import {SaveResponseExampleDialog} from './SaveResponseExampleDialog.jsx';
import {RequestRevisionDialogs} from './RequestRevisionDialogs.jsx';
import {RequestStorageDialogs} from './RequestStorageDialogs.jsx';

/** Composition only: all API and draft state stay in the Workbench controller. */
export function RequestDialogs(props){
  return <>
    <UnsavedChangesDialog {...props}/>
    <SaveResponseExampleDialog {...props}/>
    <RequestRevisionDialogs {...props}/>
    <RequestStorageDialogs {...props}/>
  </>;
}
