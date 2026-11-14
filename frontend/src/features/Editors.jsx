import React, {useMemo} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import {json} from '@codemirror/lang-json';
import {xml} from '@codemirror/lang-xml';
import {html} from '@codemirror/lang-html';
import {javascript} from '@codemirror/lang-javascript';
import {linter} from '@codemirror/lint';
import {syntaxProblem} from './requestTools';

export function TextEditor({value='',onChange,lang='text',theme='dark',readOnly=false,lint=true,minHeight='250px'}) {
  const extensions=useMemo(()=>{
    const ex=[];
    if(lang==='json')ex.push(json());
    if(lang==='xml')ex.push(xml());
    if(lang==='html')ex.push(html());
    if(lang==='javascript')ex.push(javascript());
    if(lint && !readOnly && ['json','xml'].includes(lang)) {
      ex.push(linter(view=>{
        const problem=syntaxProblem(view.state.doc.toString(),lang);
        return problem?[{...problem,severity:'error'}]:[];
      },{delay:350}));
    }
    return ex;
  },[lang,lint,readOnly]);
  return <CodeMirror value={value} theme={theme === 'dark' ? 'dark' : 'light'}
    extensions={extensions} onChange={onChange} readOnly={readOnly}
    basicSetup={{foldGutter:true,lineNumbers:true,highlightActiveLine:!readOnly,autocompletion:true}}
    minHeight={minHeight} className="pp-cm-editor" />;
}
