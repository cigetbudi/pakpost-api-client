import {StreamLanguage} from '@codemirror/language';

const reserved = /^(?:curl|GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS|const|let|var|new|return|await|async|import|from|using|public|static|class|void|func|package|if|else|def|print|True|False|None|nil|null|true|false)$/;
const shellOptions = /^--?[A-Za-z][\w-]*/;
const language = StreamLanguage.define({
  startState: () => ({ quote: null }),
  token(stream, state) {
    if (stream.eatSpace()) return null;
    if (state.quote) {
      let escaped = false;
      while (!stream.eol()) {
        const c = stream.next();
        if (!escaped && c === state.quote) {state.quote = null;break;}
        if (c === '\\' && !escaped) escaped = true;
        else escaped = false;
      }
      return 'string';
    }
    if (stream.match(/(?:#|\/\/).*/)) return 'comment';
    if (stream.peek() === '\'' || stream.peek() === '"' || stream.peek() === '`') {
      state.quote = stream.next();
      return 'string';
    }
    if (stream.match(/\{\{[A-Za-z_][\w]*\}\}/)) return 'variableName';
    if (stream.match(shellOptions)) return 'keyword';
    if (stream.match(/\b\d+(?:\.\d+)?\b/)) return 'number';
    if (stream.match(/[A-Za-z_][\w-]*/)) return reserved.test(stream.current()) ? 'keyword' : null;
    if (stream.match(/[{}()[\]:;,]/)) return 'punctuation';
    stream.next();return null;
  }
});
export const extraCodeLanguage = () => language;
