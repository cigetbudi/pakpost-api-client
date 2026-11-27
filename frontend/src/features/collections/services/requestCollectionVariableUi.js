/** Combine variable scopes for display and codegen only. Never feed the merged
 * map into pm.environment or persist it as shared defaults. */
export function mergeRequestVariableUi({environmentUi,varsFromEnv,collectionRows=[],collectionValues={},collectionName='',editCollection,isSensitiveVariable}) {
  const collectionDefinitions=new Map(collectionRows.map(row=>[row.key,row]));
  for(const key of Object.keys(collectionValues)){
    const row=collectionDefinitions.get(key);
    collectionDefinitions.set(key,{...row,key,isRedacted:false,isSecret:isSensitiveVariable(key,row)});
  }
  const definitions=new Map(collectionDefinitions);
  for(const row of environmentUi.definitions||[]){
    // A readable collection fallback must not be marked restricted merely
    // because a different scope has a masked definition of the same name.
    if(!Object.hasOwn(collectionValues,row.key)||Object.hasOwn(environmentUi.variables,row.key))definitions.set(row.key,row);
  }
  const varsForRequest=(allowSecrets=true)=>{
    const values={...collectionValues};
    if(!allowSecrets)for(const key of Object.keys(values)){
      if(isSensitiveVariable(key,collectionDefinitions.get(key)))values[key]='[REDACTED]';
    }
    return {...values,...varsFromEnv(allowSecrets)};
  };
  if(!collectionName)return {variableUi:environmentUi,varsForRequest};
  return {
    varsForRequest,
    variableUi:{...environmentUi,variables:varsForRequest(),definitions:[...definitions.values()],
      source:`Collection · ${collectionName}${environmentUi.source==='No active environment'?'':` / ${environmentUi.source}`}`,
      onEditVariable:async(key,value)=>{
        const inEnvironment=Object.hasOwn(environmentUi.variables,key)||(!Object.hasOwn(collectionValues,key)&&environmentUi.definitions?.some(row=>row.key===key));
        if(inEnvironment&&environmentUi.onEditVariable)return environmentUi.onEditVariable(key,value);
        if(collectionDefinitions.has(key)||!environmentUi.onEditVariable)return editCollection(key,value);
        return environmentUi.onEditVariable(key,value);
      },
    },
  };
}
