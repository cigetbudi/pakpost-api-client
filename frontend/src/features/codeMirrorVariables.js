import {ViewPlugin,Decoration} from '@codemirror/view';
import {variableDescriptors} from './variableExperience.js';

/** Decorations are styling only: CodeMirror document content is not substituted or mutated. */
export function codeMirrorVariableDecoration(variables={},definitions=[]){
  function visibleTokens(view){
    const marks=[];
    const pattern=/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
    for(const {from,to} of view.visibleRanges){
      const text=view.state.doc.sliceString(from,to);
      pattern.lastIndex=0;
      for(const match of text.matchAll(pattern)){
        const [part]=variableDescriptors(match[0],variables,definitions);
        marks.push(Decoration.mark({class:`pp-cm-env-token pp-cm-env-token-${part.type}`,
          attributes:{'data-pp-variable-key':match[1],title:`${match[1]} · ${part.type==='known'?'Resolved':part.type==='restricted'?'Restricted':'Unresolved'}`}}
        ).range(from+match.index,from+match.index+match[0].length));
      }
    }
    return Decoration.set(marks,true);
  }
  return ViewPlugin.fromClass(class {
    constructor(view){this.decorations=visibleTokens(view);}
    update(update){if(update.docChanged||update.viewportChanged)this.decorations=visibleTokens(update.view);}
  },{decorations:plugin=>plugin.decorations});
}
