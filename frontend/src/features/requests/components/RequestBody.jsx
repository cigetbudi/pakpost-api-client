import React from 'react';
import { AlertTriangle, FileUp, Plus, WandSparkles, X } from 'lucide-react';
import { IconButton } from '../../../components/ui/WorkbenchPrimitives.jsx';
import { RetroSelect } from '../../../components/ui/RetroSelect';
import { VariableAwareInput } from './VariableAwareInput.jsx';
import { BODY_FORMATS, bodyFormat, languageFromMime, syntaxProblem } from '../services/requestTools';
import { isDarkAppearance } from '../../settings/services/appearance';
import { encodeFile } from '../../../utils/workbenchHelpers.js';

export function RequestBody({ format, selectFormat, beautifyBody, body, setBody,
  theme, variableUi, formFields, setFormFields, binaryFile, setBinaryFile,
  setNotice, TextEditor }) {
  return (
<div className="pp-body-composer">
                  <div className="pp-body-toolbar"><div className="pp-body-format-label"><span>Body type</span><RetroSelect ariaLabel="Body type" className="pp-body-format-select" value={format} onChange={selectFormat} options={BODY_FORMATS.map(f=>({value:f.mime,label:f.label,group:f.group}))}/></div>
                    {bodyFormat(format).mode==='raw'&&<button title="Beautify request body" onClick={beautifyBody}><WandSparkles size={15}/> Beautify</button>}
                    <span>UTF-8</span>
                  </div>
                  {bodyFormat(format).mode==='none'&&<div className="pp-body-empty">This request has no body. Choose a format to start editing.</div>}
                  {bodyFormat(format).mode==='raw'&&<div className="pp-body-code">
                    <TextEditor value={body} onChange={setBody} variableUi={variableUi} lang={languageFromMime(format)==='json'?'jsonc':languageFromMime(format)} theme={isDarkAppearance(theme) ? 'dark' : 'light'} minHeight="100%" placeholder="Write request body here…" allowComments fill/>
                    {syntaxProblem(body,languageFromMime(format))&&<div className="pp-inline-validation"><AlertTriangle size={14}/><span>{syntaxProblem(body,languageFromMime(format))?.message}</span></div>}
                  </div>}
                  {(bodyFormat(format).mode==='urlencoded'||bodyFormat(format).mode==='multipart')&&<>
                    <div className="pp-form-caption"><span>{bodyFormat(format).mode==='multipart'?'MULTIPART FORM DATA':'URL ENCODED DATA'}</span><span>Up to 5 MB</span></div>
                    <div className="pp-keyvalue-heading"><span>KEY</span><span>VALUE / FILE</span><span/></div>
                    {formFields.map((r,i)=><div className="pp-keyvalue-row pp-form-data-row" key={i}>
                      <VariableAwareInput placeholder="key" ariaLabel="Form field key" value={r.key} onChange={value=>setFormFields(v=>v.map((x,j)=>j===i?{...x,key:value}:x))} {...variableUi}/>
                      {r.fileBase64?<div className="pp-file-name"><FileUp size={14}/>{r.fileName}<button title="Detach file" onClick={()=>setFormFields(v=>v.map((x,j)=>j===i?{key:x.key,value:''}:x))}><X size={12}/></button></div>
                        :<VariableAwareInput placeholder="value or {{variable}}" ariaLabel="Form field value" value={r.value||''} onChange={value=>setFormFields(v=>v.map((x,j)=>j===i?{...x,value}:x))} {...variableUi}/>}
                      <div className="pp-field-actions">
                        {bodyFormat(format).mode==='multipart'&&<label title="Attach file"><FileUp size={15}/><input type="file" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const value=await encodeFile(file);setFormFields(v=>v.map((x,j)=>j===i?{...x,value:'',fileName:file.name,fileBase64:value,contentType:file.type}:x))}catch(err){setNotice(err.message)}}}/></label>}
                        <IconButton icon={X} label="Remove field" onClick={()=>setFormFields(v=>v.filter((_,j)=>j!==i))}/>
                      </div>
                    </div>)}
                    <button className="pp-inline-add" onClick={()=>setFormFields(v=>[...v,{key:'',value:''}])}><Plus size={14}/> Add field</button>
                  </>}
                  {bodyFormat(format).mode==='binary'&&<div className="pp-binary-picker"><FileUp size={22}/><span>{binaryFile.name||'Select a binary file (up to 5 MB)'}</span><label>Choose file<input type="file" hidden onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setBinaryFile({name:file.name,base64:await encodeFile(file)})}catch(err){setNotice(err.message)}}}/></label></div>}
                </div>
  );
}
