import React from 'react';
import {VariableAwareInput} from './VariableAwareInput.jsx';

/** Preserve the URL editor's keyboard autocomplete, cURL paste and Enter-to-send. */
export function VariableUrlInput(props){
  return <VariableAwareInput {...props} className="pp-url-field" ariaLabel="Request URL" placeholder="Enter URL or paste a cURL command…"/>;
}
