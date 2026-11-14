export const BODY_FORMATS = [
  {group: 'General', label: 'None', mime: 'none', mode: 'none'},
  {group: 'Text', label: 'application/json', mime: 'application/json', mode: 'raw', lang: 'json'},
  {group: 'Text', label: 'application/ld+json', mime: 'application/ld+json', mode: 'raw', lang: 'json'},
  {group: 'Text', label: 'application/hal+json', mime: 'application/hal+json', mode: 'raw', lang: 'json'},
  {group: 'Text', label: 'application/vnd.api+json', mime: 'application/vnd.api+json', mode: 'raw', lang: 'json'},
  {group: 'Text', label: 'application/xml', mime: 'application/xml', mode: 'raw', lang: 'xml'},
  {group: 'Text', label: 'text/xml', mime: 'text/xml', mode: 'raw', lang: 'xml'},
  {group: 'Text', label: 'text/html', mime: 'text/html', mode: 'raw', lang: 'html'},
  {group: 'Text', label: 'text/plain', mime: 'text/plain', mode: 'raw', lang: 'text'},
  {group: 'Structured', label: 'application/x-www-form-urlencoded', mime: 'application/x-www-form-urlencoded', mode: 'urlencoded'},
  {group: 'Structured', label: 'multipart/form-data', mime: 'multipart/form-data', mode: 'multipart'},
  {group: 'Binary', label: 'application/octet-stream', mime: 'application/octet-stream', mode: 'binary'},
];
export function bodyFormat(mime) {
  return BODY_FORMATS.find(x => x.mime === mime) || (mime?.includes('xml') ? BODY_FORMATS[5] : mime?.includes('json') ? BODY_FORMATS[1] : BODY_FORMATS[8]);
}
export function languageFromMime(mime = '') {
  const type = mime.toLowerCase().split(';')[0];
  if (type.includes('json')) return 'json';
  if (type.includes('xml')) return 'xml';
  if (type.includes('html')) return 'html';
  if (type.includes('javascript')) return 'javascript';
  return 'text';
}
export function resolveVars(text, vars, strict = true) {
  const unresolved = new Set();
  const pattern = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}|<<\s*([A-Za-z_][\w]*)\s*>>/g;
  let value = String(text ?? '');
  const seen = new Set();
  for (let depth = 0; depth < 8; depth++) {
    const next = value.replace(pattern, (original, curly, angle) => {
      const key = curly || angle;
      if (!Object.prototype.hasOwnProperty.call(vars, key)) { unresolved.add(key); return original; }
      return String(vars[key] ?? '');
    });
    if (next === value || seen.has(next)) break;
    seen.add(next); value = next;
  }
  for (const match of value.matchAll(pattern)) unresolved.add(match[1] || match[2]);
  if (strict && unresolved.size) throw new Error(`Unresolved environment variable: ${[...unresolved].join(', ')}`);
  return { value, unresolved: [...unresolved] };
}
export function resolveRows(rows, vars) {
  return (rows || []).filter(r=>r.key?.trim()).map(r=>({ key: resolveVars(r.key.trim(),vars).value, value: resolveVars(r.value || '', vars).value, ...('file' in r ? {file:r.file}: {}) }));
}
export function syntaxProblem(text, lang) {
  if (!String(text||'').trim()) return null;
  if (lang === 'json') {
    try {
      // Substitute placeholders to validate a template without falsely flagging {{var}}.
      const sanitized = text.replace(/\{\{\s*[A-Za-z_]\w*\s*\}\}/g,'0').replace(/<<\s*[A-Za-z_]\w*\s*>>/g,'0');
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
export function buildCommand({method,url,headers,body,format,fields=[],fileBase64='',fileName=''},vars={}) {
  const fmt = bodyFormat(format);
  const targetUrl = resolveVars(url,vars).value;
  const safeHeaders = Object.fromEntries(resolveRows(headers,vars).map(x=>[x.key,x.value]));
  const prepared = {
    method, url:targetUrl, headers:safeHeaders, body:'', bodyMode:fmt.mode,
    contentType: fmt.mime === 'none' ? null : fmt.mime,
    formFields:[],fileBase64:null,fileName:null,
  };
  if (fmt.mode==='raw') {
    prepared.body = resolveVars(body||'',vars).value;
    Object.keys(prepared.headers).filter(x=>x.toLowerCase()==='content-type').forEach(x=>delete prepared.headers[x]);
    if (prepared.body) prepared.headers['Content-Type'] = fmt.mime;
  }
  if (fmt.mode==='urlencoded' || fmt.mode==='multipart') {
    prepared.formFields = fields.filter(f=>f.key?.trim()).map(f=>({
      key:resolveVars(f.key,vars).value,
      value:f.fileBase64 ? null : resolveVars(f.value||'',vars).value,
      fileName:f.fileBase64 ? f.fileName : null,
      base64:f.fileBase64 || null,
      contentType:f.fileBase64 ? (f.contentType || 'application/octet-stream') : null,
    }));
    // FormUrlEncodedContent / MultipartFormDataContent assign this themselves.
    Object.keys(prepared.headers).filter(x=>x.toLowerCase()==='content-type').forEach(x=>delete prepared.headers[x]);
  }
  if (fmt.mode==='binary') {prepared.fileBase64=fileBase64;prepared.fileName=fileName;}
  return prepared;
}
function shq(s) { return "'"+String(s).replace(/'/g, "'\\''")+"'"; }
function generatedBody(req) {
  if(req.bodyMode==='urlencoded') return new URLSearchParams((req.formFields||[]).map(x=>[x.key,x.value||''])).toString();
  if(req.bodyMode==='raw') return req.body||'';
  return '';
}
export const GENERATORS = [ ['curl','cURL'],['fetch','JavaScript Fetch'],['go','Go net/http'],['csharp','C# HttpClient'],['python','Python requests'] ];
export function generateCode(req, lang) {
  const h=req.headers||{};
  const pairs=Object.entries(h);
  const body=generatedBody(req);
  if (lang==='curl') {
    const args=[`curl --request ${req.method}`, `--url ${shq(req.url)}`];
    for(const [k,v] of pairs) args.push(`--header ${shq(`${k}: ${v}`)}`);
    if(req.bodyMode==='urlencoded') args.push(`--header ${shq('Content-Type: application/x-www-form-urlencoded')}`);
    if(req.bodyMode==='multipart') for(const f of req.formFields||[])
      args.push(`--form ${shq(f.base64?`${f.key}=@${f.fileName||'file.bin'}`:`${f.key}=${f.value??''}`)}`);
    if(req.bodyMode==='binary')args.push(`--data-binary ${shq(`@${req.fileName||'file.bin'}`)}`);
    if((req.bodyMode==='raw'||req.bodyMode==='urlencoded') && body) args.push(`--data-raw ${shq(body)}`);
    return args.join(' \\\n  ');
  }
  if (req.bodyMode==='binary' || req.bodyMode==='multipart')
    return '// Binary/multipart snippet: use cURL for file references in this version.\n// Do not embed Base64 payloads or secrets in generated code.';
  const data=JSON.stringify(body);
  if (lang==='fetch') return `const response = await fetch(${JSON.stringify(req.url)}, {\n  method: ${JSON.stringify(req.method)},\n  headers: ${JSON.stringify(h,null,2)},${body?`\n  body: ${data},`:''}\n});\nconsole.log(await response.text());`;
  if (lang==='python') return `import requests\n\nresponse = requests.request(${JSON.stringify(req.method)}, ${JSON.stringify(req.url)},\n  headers=${JSON.stringify(h)},${body?`\n  data=${JSON.stringify(body)},`:''}\n)\nprint(response.text)`;
  if (lang==='go') return `package main\n\nimport ("fmt"; "net/http"; "strings"; "io")\n\nfunc main() {\n  req, err := http.NewRequest(${JSON.stringify(req.method)}, ${JSON.stringify(req.url)}, ${body?`strings.NewReader(${JSON.stringify(body)})`:'nil'})\n  if err != nil { panic(err) }\n${pairs.map(([k,v])=>`  req.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join('\n')}\n  resp, err := http.DefaultClient.Do(req)\n  if err != nil { panic(err) }\n  defer resp.Body.Close()\n  b, _ := io.ReadAll(resp.Body)\n  fmt.Println(resp.StatusCode, string(b))\n}`;
  if (lang==='csharp')return `using System.Net.Http;\nusing System.Text;\n\nusing var client = new HttpClient();\nusing var request = new HttpRequestMessage(new HttpMethod(${JSON.stringify(req.method)}), ${JSON.stringify(req.url)});\n${body?`request.Content = new StringContent(${JSON.stringify(body)}, Encoding.UTF8);\n`:''}${pairs.map(([k,v])=>`request.Headers.TryAddWithoutValidation(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n')}\nusing var response = await client.SendAsync(request);\nConsole.WriteLine(await response.Content.ReadAsStringAsync());`;
  return '';
}
