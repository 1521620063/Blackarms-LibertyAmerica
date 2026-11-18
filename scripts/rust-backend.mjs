import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const backendRoot=fileURLToPath(new URL('../backend/',import.meta.url));
let build;
export function buildBackend(){
  return build??=new Promise((resolve,reject)=>{
    const child=spawn('cargo',['build','--locked','--quiet'],{cwd:backendRoot,stdio:'inherit'});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Rust backend build failed (${code})`)));
  });
}
// Used only by development tooling and tests. Deployment runs the Rust executable directly.
export async function startBackend({port=3000,host,mode='local',allowedOrigins=[],log=false}={}){
  await buildBackend();
  const targetDir=process.env.CARGO_TARGET_DIR?resolve(backendRoot,process.env.CARGO_TARGET_DIR):resolve(backendRoot,'target');
  const executable=resolve(targetDir,'debug',`blackarms-backend${process.platform==='win32'?'.exe':''}`);
  const env={...process.env,APP_MODE:mode,PORT:String(port),...(host?{HOST:host}:{}),ALLOWED_ORIGINS:allowedOrigins.join(',')};
  const child=spawn(executable,[],{cwd:backendRoot,env,stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stderr.on('data',data=>{errors+=data;if(log)process.stderr.write(data);});
  let closed=false;
  const exited=new Promise(resolve=>child.once('exit',resolve));
  const close=async()=>{if(closed)return;closed=true;child.kill();await exited;};
  try{
    const address=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Rust backend startup timed out')),20000);
      const finish=(error,value)=>{clearTimeout(timer);error?reject(error):resolve(value);};
      child.once('error',error=>finish(error));child.once('exit',code=>finish(new Error(`Rust backend exited (${code}): ${errors}`)));
      child.stdout.on('data',data=>{output+=data;if(log)process.stdout.write(data);const match=output.match(/→ http:\/\/([^\s]+)/);if(match)finish(null,match[1]);});
    });
    const bound=new URL(`http://${address}`),boundPort=Number(bound.port);
    const connectHost=['0.0.0.0','[::]'].includes(bound.hostname)?'127.0.0.1':bound.hostname;
    return {url:`http://${connectHost}:${boundPort}`,server:{address:()=>({port:boundPort,address:bound.hostname})},close,exited};
  }catch(error){await close();throw error;}
}
