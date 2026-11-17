export const toRows = (headers = {}) =>
  Object.entries(headers).map(([key, value]) => ({ key, value }));

export function prettyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** Restore guest secrets only from sessionStorage, never durable Local storage. */
export function initialLocalEnvs() {
  try {
    const data = JSON.parse(localStorage.getItem('pakpost_guest_envs') || '[]');
    const secrets = JSON.parse(sessionStorage.getItem('pakpost_guest_secrets') || '{}');
    return data.map(env => ({
      ...env,
      variables: env.variables.map(variable => variable.isSecret
        ? { ...variable, value: secrets[env.id]?.[variable.key] || '' }
        : variable),
    }));
  } catch {
    return [];
  }
}

export const rowFromFile = (file, base64) => ({
  key: 'file',
  value: '',
  fileName: file.name,
  fileBase64: base64,
  contentType: file.type || 'application/octet-stream',
});

export async function encodeFile(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Maximum file size is 5 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
