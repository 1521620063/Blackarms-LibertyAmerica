import { readFileSync } from 'node:fs';
import { Server as HTTPSServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root=fileURLToPath(new URL('./',import.meta.url)).replace(/^[A-Z]:/,drive=>drive.toLowerCase());

export async function createFrontendServer({production=false,port=production?4173:5173,host='0.0.0.0',backendUrl,tls=null}={}){
  const {createServer,preview,loadEnv}=await import('vite');
  const env=loadEnv(production?'production':'development',root,'');
  const target=backendUrl||process.env.BACKEND_URL||env.BACKEND_URL||'http://127.0.0.1:3000';
  const key=process.env.FRONTEND_TLS_KEY||env.FRONTEND_TLS_KEY,cert=process.env.FRONTEND_TLS_CERT||env.FRONTEND_TLS_CERT;
  if(!!key!==!!cert)throw new Error('前端 HTTPS 需要同时设置 FRONTEND_TLS_KEY 与 FRONTEND_TLS_CERT。');
  const https=tls===false?undefined:(tls||(key?{key:readFileSync(resolve(root,key)),cert:readFileSync(resolve(root,cert))}:undefined));
  const options={port,host,strictPort:true,https,proxy:{'/lan':{target,ws:true,changeOrigin:false}}};
  const config={root,configFile:false,resolve:{dedupe:['three'],preserveSymlinks:true}};
  if(production){
    const app=await preview({...config,preview:options});
    return {server:app.httpServer,async close(){app.httpServer.closeAllConnections?.();await new Promise(resolve=>app.httpServer.close(resolve));}};
  }
  const app=await createServer({...config,server:{...options,fs:{allow:[root,resolve(root,'../node_modules')]}}});
  try{await app.listen();}catch(error){await app.close();throw error;}
  return {server:app.httpServer,async close(){await app.environments.client.depsOptimizer?.scanProcessing;await app.close();}};
}

export function logFrontendAddresses(server){
  const secure=server instanceof HTTPSServer,protocol=secure?'https':'http',port=server.address().port;
  console.log(`Blackarms frontend → ${protocol}://localhost:${port}`);
  if(secure){
    for(const address of new Set(Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>a.address)))console.log(`LAN → https://${address}:${port}（玩家电脑需信任局域网 CA 证书）`);
  }else console.log('其他电脑使用 WebGPU 需要 HTTPS：先运行 npm run setup:https，安装输出的 CA 证书，再重启服务。');
}

const entry=process.argv[1]&&resolve(process.argv[1]),current=fileURLToPath(import.meta.url);
if(entry&&(process.platform==='win32'?entry.toLowerCase()===current.toLowerCase():entry===current)){
  const production=process.argv.includes('--production'),port=Number(process.env.FRONTEND_PORT)||(production?4173:5173);
  createFrontendServer({production,port}).then(app=>{
    logFrontendAddresses(app.server);
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{app.close().then(()=>process.exit(0));});
  }).catch(error=>{console.error(error);process.exitCode=1;});
}
