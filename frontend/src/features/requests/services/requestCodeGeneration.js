/** Request preparation and redacted cross-language snippet generation. */
import {bodyFormat} from './requestBodyFormats.js';
import {resolveVars,resolveRows} from './requestVariableResolution.js';
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
    const chosen=Object.keys(prepared.headers).find(x=>x.toLowerCase()==='content-type');
    const disabled=(headers||[]).some(r=>r.key?.trim().toLowerCase()==='content-type'&&r.enabled===false);
    const mime=disabled?null:chosen?prepared.headers[chosen]:fmt.mime;
    Object.keys(prepared.headers).filter(x=>x.toLowerCase()==='content-type').forEach(x=>delete prepared.headers[x]);
    prepared.contentType=mime;
    if (prepared.body&&mime) prepared.headers['Content-Type'] = mime;
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
