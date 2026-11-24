// Bounded, session-only dataset. CSV supports RFC-style double quotes and CRLF.
const MAX_ROWS=10,MAX_COLS=100,MAX_SIZE=262144;
function csvRows(text){
  const rows=[];let row=[],field='',quoted=false,closed=false;
  const push=()=>{row.push(field);field='';closed=false;if(row.length>MAX_COLS)throw Error('Too many CSV columns.');};
  const end=()=>{push();rows.push(row);row=[];if(rows.length>MAX_ROWS+1)throw Error('Maximum 10 data rows.');};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c===','){push();continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;end();continue;}
    if(closed)throw Error('Unexpected content after quoted CSV field.');
    if(c==='"'){if(field)throw Error('Unexpected CSV quote.');quoted=true;}else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote.');
  if(field||row.length||closed)end();return rows;
}
function validateRow(row){
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Every dataset row must be an object.');
  const entries=Object.entries(row);if(!entries.length||entries.length>MAX_COLS)throw Error('Invalid dataset column count.');
  for(const [key,value] of entries){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)||['__proto__','constructor','prototype'].includes(key))throw Error('Invalid dataset variable name.');if(value!==null&&typeof value==='object')throw Error('Data values must be primitive.');if(String(value??'').length>8192)throw Error('Dataset cell exceeds 8192 characters.');}
  return Object.fromEntries(entries);
}
export function parseRunnerData(text,kind){
  if(typeof text!=='string'||text.length>MAX_SIZE)throw Error('Dataset exceeds 256 KiB.');
  text=text.replace(/^\uFEFF/,'');let rows;
  if(kind==='json')rows=JSON.parse(text);
  else{const [head,...data]=csvRows(text);if(!head?.length||new Set(head).size!==head.length)throw Error('CSV headers must be unique.');rows=data.map(row=>{if(row.length!==head.length)throw Error('CSV row has wrong number of columns.');return Object.fromEntries(head.map((key,i)=>[key,row[i]]));});}
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw Error('Dataset must have 1–10 rows.');return rows.map(validateRow);
}
// Reports omit URLs, request names, assertions, errors, bodies, logs and variables.
export function runnerReport(summary){
  return {version:1,status:summary.status,total:summary.total,completed:summary.completed,passed:summary.passed,failed:summary.failed,assertionsPassed:summary.assertionsPassed,assertionsFailed:summary.assertionsFailed,rows:summary.rows.map((r,index)=>({step:index+1,iteration:r.iteration,method:r.method,status:r.status,elapsedMs:r.elapsedMs,passed:r.passed,assertionsPassed:r.tests.filter(t=>t.passed).length,assertionsFailed:r.tests.filter(t=>!t.passed).length}))};
}
export function runnerJUnit(summary){const report=runnerReport(summary);return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="PakPost" tests="${report.completed}" failures="${report.failed}">\n${report.rows.map(r=>`  <testcase classname="PakPost.iteration.${r.iteration}" name="step-${r.step}" time="${Math.max(0,Number(r.elapsedMs)||0)/1000}">${r.passed?'':'<failure message="Request or assertion failed"/>'}</testcase>`).join('\n')}\n</testsuite>\n`;}
