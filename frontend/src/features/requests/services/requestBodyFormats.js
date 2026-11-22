/** Body MIME types and editor language selection. */
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
