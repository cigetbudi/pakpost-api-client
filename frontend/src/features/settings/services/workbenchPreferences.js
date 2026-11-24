export const WORKBENCH_PREFERENCES_KEY = 'pakpost_workbench_preferences_v1';
export const DEFAULT_WORKBENCH_PREFERENCES = Object.freeze({density:'adaptive',editorFontSize:13,wordWrap:false,motion:true,autoExpandResponse:false});
export function normalizeWorkbenchPreferences(value) {
  const defaults=DEFAULT_WORKBENCH_PREFERENCES;
  const v=value&&typeof value==='object'?value:{};
  return {density:['adaptive','compact','comfortable'].includes(v.density)?v.density:defaults.density,
    editorFontSize:Number.isInteger(v.editorFontSize)?Math.min(20,Math.max(10,v.editorFontSize)):defaults.editorFontSize,
    wordWrap:typeof v.wordWrap==='boolean'?v.wordWrap:defaults.wordWrap,
    motion:typeof v.motion==='boolean'?v.motion:defaults.motion,
    autoExpandResponse:typeof v.autoExpandResponse==='boolean'?v.autoExpandResponse:defaults.autoExpandResponse};
}
export function readWorkbenchPreferences(storage) {
  try{return normalizeWorkbenchPreferences(JSON.parse(storage?.getItem(WORKBENCH_PREFERENCES_KEY)||'null'));}
  catch{return {...DEFAULT_WORKBENCH_PREFERENCES};}
}
