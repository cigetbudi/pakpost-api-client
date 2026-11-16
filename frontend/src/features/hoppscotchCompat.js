/** Hoppscotch uses <<Variable>>; Pakpost uses {{Variable}}.
 * Conversion is performed only when importing external data, never on live requests.
 * Restrict variable names so angle-bracket markup/XML and ordinary text are untouched.
 */
export const HOPPSCOTCH_VARIABLE = /<<\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*>>/g;
export function normalizeHoppscotchVariables(value){
  return String(value ?? '').replace(HOPPSCOTCH_VARIABLE, (_,key) => `{{${key}}}`);
}
