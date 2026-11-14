/** JSONC editor comments; output body is strict JSON and pre-script receives the same text. */
export function stripJsonComments(source){
  const s=String(source??'');let out='';let quoted=false,escaped=false,line=false,block=false;
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(line){if(c==='\n'||c==='\r'){line=false;out+=c;}else out+=' ';continue;}
    if(block){if(c==='*'&&n==='/'){out+='  ';i++;block=false;}else out+=c==='\n'||c==='\r'?c:' ';continue;}
    if(quoted){out+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;out+=c;continue;}
    if(c==='/'&&n==='/'){line=true;out+='  ';i++;continue;}
    if(c==='/'&&n==='*'){block=true;out+='  ';i++;continue;}
    out+=c;
  }
  if(block)throw Error('Unterminated block comment in JSON body');
  return out;
}
export function hasJsonComments(source){return stripJsonComments(source)!==String(source??'')}
