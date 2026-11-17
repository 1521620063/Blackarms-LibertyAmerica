// Invalid or unavailable browser storage must never prevent an offline game from starting.
export function readPreferences(key, storage){
  try{
    const value=JSON.parse((storage??globalThis.localStorage).getItem(key)||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
