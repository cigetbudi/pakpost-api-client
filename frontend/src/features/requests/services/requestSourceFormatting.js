/** Syntax validation and on-demand formatting. */
import {stripJsonComments} from './jsonComments.js';
export function syntaxProblem(text, lang) {
  if (!String(text||'').trim()) return null;
  if (lang === 'json') {
    try {
      // Substitute placeholders to validate a template without falsely flagging {{var}}.
      const sanitized = stripJsonComments(text).replace(/\{\{\s*[A-Za-z_]\w*\s*\}\}/g,'0').replace(/<<\s*[A-Za-z_]\w*\s*>>/g,'0');
      JSON.parse(sanitized); return null;
    } catch (error) {
      const pos = /position\s+(\d+)/i.exec(error.message);
      const lineAndColumn = /line\s+(\d+)\s+column\s+(\d+)/i.exec(error.message);
      let position = pos ? Number(pos[1]) : 0;
      if (!pos && lineAndColumn) {
        const lines = text.split('\n');
        position = lines.slice(0, Number(lineAndColumn[1])-1).reduce((n,l)=>n+l.length+1,0) + Number(lineAndColumn[2])-1;
      }
      return {message:error.message, from:Math.min(position,text.length), to:Math.min(position+1,text.length)};
    }
  }
  if (lang === 'xml') {
    const parsed = new DOMParser().parseFromString(text, 'application/xml');
    const error = parsed.querySelector('parsererror');
    if (error) return {message:error.textContent.trim().slice(0,350), from:0, to:Math.min(text.length,1)};
  }
  return null;
}
export async function formatSource(text, lang) {
  if (lang === 'json') {
    // Reject malformed JSON instead of silently reformatting it incorrectly.
    return JSON.stringify(JSON.parse(text), null, 2);
  }
  if (lang === 'xml') {
    const issue = syntaxProblem(text, 'xml'); if (issue) throw new Error(issue.message);
    // XML whitespace can be significant. Only insert whitespace around tags when there is no mixed content.
    const xml = text.replace(/>\s*</g, '><').replace(/(>)(<)(\/?)/g, '$1\n$2$3');
    let level = 0;
    return xml.split('\n').map(line=>{
      const str=line.trim();
      if (str.startsWith('</')) level=Math.max(0,level-1);
      const out = '  '.repeat(level)+str;
      if (/^<[^!?/][^>]*[^/]>(?!.*<\/)/.test(str) && !str.includes('</')) level++;
      return out;
    }).join('\n');
  }
  if (lang === 'html' || lang === 'javascript') {
    const prettier = await import('prettier/standalone');
    const plugins = lang === 'html' ? [await import('prettier/plugins/html')] : [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')];
    return prettier.format(text, {parser: lang === 'html' ? 'html' : 'babel', plugins, tabWidth:2});
  }
  return text;
}
