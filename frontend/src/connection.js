export function connectionDefaults(runtime={},build={}){
  const mode=runtime?.networkMode??build.VITE_NETWORK_MODE;
  const address=runtime?.backendUrl??build.VITE_BACKEND_URL;
  return {networkMode:mode==='public'?'public':'lan',backendUrl:typeof address==='string'?address:''};
}

export function roomServerUrl(address,pageUrl){
  const page=new URL(pageUrl);
  const url=new URL(address||'/lan',page);
  if(url.protocol==='http:')url.protocol='ws:';
  if(url.protocol==='https:')url.protocol='wss:';
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('后台地址需要使用 http、https、ws 或 wss。');
  if(page.protocol==='https:'&&url.protocol!=='wss:')throw new Error('HTTPS 页面需要配置 wss:// 或 https:// 后台地址。');
  if(url.pathname==='/'||url.pathname==='')url.pathname='/lan';
  url.hash='';
  return url.href;
}
