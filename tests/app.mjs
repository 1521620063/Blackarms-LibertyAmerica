// Integration tests run the real Rust backend and frontend on independent ports.
import { startBackend } from '../scripts/rust-backend.mjs';
import { createFrontendServer } from '../frontend/server.mjs';

export async function createServer({production=false,host='127.0.0.1',port=0}={}){
  const backend=await startBackend({port:0,host});
  try{
    const frontend=await createFrontendServer({production,port,host,backendUrl:backend.url,tls:false});
    return {server:frontend.server,backend:backend.server,backendUrl:backend.url,async close(){await frontend.close();await backend.close();}};
  }catch(error){await backend.close();throw error;}
}
