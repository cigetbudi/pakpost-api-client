import React, {useEffect,useMemo,useRef,useState} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {json} from '@codemirror/lang-json';
import {xml} from '@codemirror/lang-xml';
import {html} from '@codemirror/lang-html';
import {javascript} from '@codemirror/lang-javascript';
import {linter, lintGutter, forceLinting} from '@codemirror/lint';
import {ensureSyntaxTree, syntaxTree} from '@codemirror/language';
import {EditorView} from '@codemirror/view';
import {syntaxProblem} from './requestTools';
import {extraCodeLanguage} from './extraCodeLanguages';
import {keymap, ViewPlugin, Decoration} from '@codemirror/view';
import {toggleLineComment} from './commentEditing';
import {MessageSquareText} from 'lucide-react';
import {codeMirrorVariableDecoration} from './codeMirrorVariables.js';
import {variableDescriptors} from './variableExperience.js';
import {VariablePopover} from './VariableAwareInput.jsx';

// JSONC drafts use the JSON grammar so property names, values and numbers are
// colored exactly like the read-only JSON response editor. CodeMirror's JSON
// grammar doesn't tokenize comments; decorate only visible comment-only lines.
function visibleJsoncComments(view) {
  const ranges=[];
  for(const {from,to} of view.visibleRanges) {
    let pos=from;
    while(pos<=to) {
      const line=view.state.doc.lineAt(pos);
      const indent=line.text.length-line.text.trimStart().length;
      if(line.text.startsWith('//',indent) && line.from+indent<line.to) {
        ranges.push(Decoration.mark({class:'pp-jsonc-comment'}).range(line.from+indent,line.to));
      }
      pos=line.to+1;
    }
  }
  return Decoration.set(ranges,true);
}
const jsoncCommentHighlight=ViewPlugin.fromClass(class {
  constructor(view) {this.decorations=visibleJsoncComments(view);}
  update(update) {
    if(update.docChanged||update.viewportChanged) {
      this.decorations=visibleJsoncComments(update.view);
    }
  }
},{decorations:plugin=>plugin.decorations});

export function TextEditor({value='',onChange,lang='text',theme='dark',readOnly=false,lint=true,minHeight='250px',lineNumbers=true,placeholder='',fill=false,allowComments=false,variableUi=null,scriptDiagnostics=false,scriptDiagnostic=null,jumpTo=null}) {
  const editorView=useRef(null);
  const diagnosticRef=useRef(scriptDiagnostic);
  diagnosticRef.current=scriptDiagnostic;
  const [hover,setHover]=useState(null);
  const hoverTimer=useRef(null);
  const variables=variableUi?.variables||{};
  const definitions=variableUi?.definitions||[];
  const variableSignature=variableUi?JSON.stringify([variables,definitions]):'';
  const closeHover=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverTimer.current=null;setHover(null);};
  const delayClose=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverTimer.current=setTimeout(closeHover,180);};
  const keepHover=()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverTimer.current=null;};
  useEffect(()=>()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);},[]);
  useEffect(()=>{closeHover();},[variableSignature,value]);
  useEffect(()=>{if(scriptDiagnostics&&editorView.current)forceLinting(editorView.current);},[scriptDiagnostics,scriptDiagnostic]);
  useEffect(()=>{
    const view=editorView.current;
    if(!view||!jumpTo?.line)return;
    const line=view.state.doc.line(Math.min(view.state.doc.lines,Math.max(1,jumpTo.line)));
    const pos=Math.min(line.to,line.from+Math.max(0,(jumpTo.column||1)-1));
    view.dispatch({selection:{anchor:pos},scrollIntoView:true});
    view.focus();
  },[jumpTo]);
  function handleTokenEnter(e){
    if(!variableUi)return;
    const token=e.target.closest?.('[data-pp-variable-key]');
    if(!token)return;
    keepHover();
    const name=token.getAttribute('data-pp-variable-key');
    const item=variableDescriptors(`{{${name}}}`,variables,definitions)[0];
    setHover({item,anchor:token.getBoundingClientRect()});
  }
  function handleTokenLeave(e){if(e.target.closest?.('[data-pp-variable-key]'))delayClose();}

  const extensions=useMemo(()=>{
    const ex=[];
    if(lang==='json'||lang==='jsonc')ex.push(json());
    if(variableUi&&!readOnly)ex.push(codeMirrorVariableDecoration(variables,definitions));
    if(lang==='jsonc')ex.push(jsoncCommentHighlight);
    if(lang==='xml')ex.push(xml());
    if(lang==='html')ex.push(html());
    if(lang==='javascript')ex.push(javascript());
    if(lang==='javascript'&&scriptDiagnostics&&!readOnly){
      ex.push(linter(view=>{
        const diagnostics=[];
        const length=view.state.doc.length;
        // CodeMirror already parses JavaScript for highlighting; reuse that parser.
        // Bound synchronous parsing on large scripts to keep editor interaction smooth.
        if(length<=30000){
          const tree=ensureSyntaxTree(view.state,length,60)||syntaxTree(view.state);
          tree.iterate({enter:node=>{
            if(!node.type.isError||diagnostics.length>=20)return;
            const from=Math.max(0,Math.min(node.from,length));
            const to=Math.max(from,Math.min(length,node.to||from+1));
            diagnostics.push({from,to,severity:'error',source:'JavaScript',message:'JavaScript syntax error near this position'});
          }});
        }
        const issue=diagnosticRef.current;
        if(issue?.line&&issue.phase&&issue.line<=view.state.doc.lines){
          const line=view.state.doc.line(issue.line);
          const from=Math.min(line.to,line.from+Math.max(0,(issue.column||1)-1));
          const to=Math.min(line.to,from+1);
          diagnostics.push({from,to,severity:'error',source:'QuickJS',message:`${issue.name}: ${issue.message}`});
        }
        return diagnostics;
      },{delay:350}));
      ex.push(lintGutter());
    }
    if(['shell','python','go','csharp','curl'].includes(lang))ex.push(extraCodeLanguage());
    if(allowComments&&!readOnly)ex.push(keymap.of([{key:'Mod-/',run:view=>toggleLineComment(view,lang)}]));
    if(lint && !readOnly && ['json','jsonc','xml'].includes(lang)) {
      ex.push(linter(view=>{
        const problem=syntaxProblem(view.state.doc.toString(),lang==='jsonc'?'json':lang);
        return problem?[{...problem,severity:'error'}]:[];
      },{delay:350}));
    }
    return ex;
  },[lang,lint,readOnly,allowComments,variableSignature,scriptDiagnostics]);
  return <div className={'pp-editor-wrap'+(fill?' pp-editor-wrap-fill':'')} onMouseOver={handleTokenEnter} onMouseOut={handleTokenLeave}>
    {allowComments&&!readOnly&&<button className="pp-editor-comment" type="button" title="Toggle comment on selected lines (Ctrl/Cmd+/)" aria-label="Toggle comment selection" onMouseDown={e=>e.preventDefault()} onClick={()=>{if(editorView.current)toggleLineComment(editorView.current,lang)}}><MessageSquareText size={14}/> <span>Comment</span></button>}
    <CodeMirror value={value} theme={theme === 'dark' ? 'dark' : 'light'}
    extensions={extensions} onChange={onChange} readOnly={readOnly} onCreateEditor={view=>{editorView.current=view;}}
    basicSetup={{foldGutter:lineNumbers,lineNumbers,highlightActiveLine:!readOnly,autocompletion:!readOnly}}
    minHeight={fill?'100%':minHeight} height={fill?'100%':undefined} placeholder={placeholder} className={fill?'pp-cm-editor pp-cm-fill':'pp-cm-editor'} />
    {hover&&variableUi&&<VariablePopover item={hover.item} anchor={hover.anchor} source={variableUi.source}
      onEditVariable={variableUi.onEditVariable} onOpenEnvironments={variableUi.onOpenEnvironments}
      onMouseEnter={keepHover} onMouseLeave={delayClose} onClose={closeHover}/>}
  </div>;
}
