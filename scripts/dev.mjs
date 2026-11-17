import { existsSync } from 'node:fs';
import { startBackend } from './rust-backend.mjs';
import { createFrontendServer, logFrontendAddresses } from '../frontend/server.mjs';

let backend,frontend,closing=false;
async function close(){if(closing)return;closing=true;await frontend?.close();await backend?.close();}
try{
  const envPath=new URL('../backend/.env',import.meta.url);if(existsSync(envPath))process.loadEnvFile(envPath);
  const mode=process.env.APP_MODE||'local',port=Number(process.env.PORT)||3000;
  const allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  backend=await startBackend({port,mode,host:process.env.HOST,allowedOrigins,log:true});
  frontend=await createFrontendServer({port:Number(process.env.FRONTEND_PORT)||5173,backendUrl:backend.url});
  logFrontendAddresses(frontend.server);
  backend.exited.then(async()=>{if(!closing){console.error('Rust backend stopped');await close();process.exitCode=1;}});
}catch(error){await close();console.error(error);process.exitCode=1;}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await close();process.exit(0);});
