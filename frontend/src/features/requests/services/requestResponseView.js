import {prettyJson} from '../../../utils/workbenchHelpers.js';

/** Derive response text without retaining private payloads outside the Workbench. */
export function requestResponseView(result,resTab,responsePretty,prettyResponse){
  const responseType = result && !result.error
    ? (result.headers?.['Content-Type'] || result.headers?.['content-type'] || 'text/plain')
    : 'text/plain';
  const responseText = result && !result.error
    ? (resTab !== 'headers'
      ? (responsePretty ? (prettyResponse||prettyJson(result.body||'')) : (result.body||''))
      : JSON.stringify(result.headers || {}, null, 2))
    : '';
  return {responseType,responseText};
}
