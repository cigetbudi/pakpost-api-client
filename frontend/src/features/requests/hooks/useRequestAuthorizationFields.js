import { useState } from 'react';

/** Per-request auth editor fields. These are NOT PakPost login credentials. */
export function useRequestAuthorizationFields(recovered, emptyHeader) {
  const [params, setParams] = useState(recovered.params || [{ ...emptyHeader }]);
  const [authType, setAuthType] = useState(recovered.authType || 'none');
  const [bearerToken, setBearerToken] = useState(recovered.bearerToken || '');
  const [basicUsername,setBasicUsername] = useState(recovered.basicUsername||'');
  const [basicPassword,setBasicPassword] = useState(recovered.basicPassword||'');
  const [apiKeyName,setApiKeyName] = useState(recovered.apiKeyName||'X-API-Key');
  const [apiKeyValue,setApiKeyValue] = useState(recovered.apiKeyValue||'');
  const [apiKeyIn,setApiKeyIn] = useState(recovered.apiKeyIn||'header');
  const currentAuth = () => ({authType,bearerToken,basicUsername,basicPassword,apiKeyName,apiKeyValue,apiKeyIn});
  return {
    params, setParams, authType, setAuthType, bearerToken, setBearerToken,
    basicUsername, setBasicUsername, basicPassword, setBasicPassword,
    apiKeyName, setApiKeyName, apiKeyValue, setApiKeyValue,
    apiKeyIn, setApiKeyIn, currentAuth,
  };
}
