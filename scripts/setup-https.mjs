import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Generate certificates only. Trust installation stays an explicit step on each device.
const root=fileURLToPath(new URL('../frontend/',import.meta.url));
const certDir=resolve(root,'.certs');
const openssl=process.env.OPENSSL_PATH||'openssl';
function run(args){
  const result=spawnSync(openssl,args,{encoding:'utf8',windowsHide:true});
  if(result.error)throw new Error('找不到 OpenSSL。请安装 OpenSSL 并加入 PATH，或设置 OPENSSL_PATH 为 openssl.exe 的完整路径。');
  if(result.status!==0)throw new Error(result.stderr||'OpenSSL 执行失败');
  return result.stdout;
}
try{
  run(['version']);
  const addresses=Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>a.address);
  const names=[...new Set(['localhost','127.0.0.1','::1',...addresses,...process.argv.slice(2)])];
  for(const name of names)if(!isIP(name)&&! /^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(name))throw new Error(`无效的主机名或 IP：${name}`);
  mkdirSync(certDir,{recursive:true});
  const caKey=resolve(certDir,'lan-ca-key.pem'),ca=resolve(certDir,'lan-ca.pem');
  if(existsSync(caKey)!==existsSync(ca))throw new Error('局域网 CA 文件不完整，请恢复 .certs/lan-ca-key.pem 和 lan-ca.pem。');
  if(!existsSync(ca))run(['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','3650','-keyout',caKey,'-out',ca,'-subj','/CN=Blackarms LAN Local CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  const ext=resolve(certDir,'server.ext');
  writeFileSync(ext,`basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${names.map(name=>`${isIP(name)?'IP':'DNS'}:${name}`).join(',')}\n`);
  const key=resolve(certDir,'server-key.pem'),csr=resolve(certDir,'server.csr'),cert=resolve(certDir,'server.pem');
  run(['req','-new','-newkey','rsa:2048','-nodes','-keyout',key,'-out',csr,'-subj','/CN=Blackarms LAN Server']);
  run(['x509','-req','-in',csr,'-CA',ca,'-CAkey',caKey,'-CAcreateserial','-days','397','-sha256','-extfile',ext,'-out',cert]);
  run(['verify','-CAfile',ca,cert]);
  const trustCert=resolve(certDir,'blackarms-lan-ca.crt');
  copyFileSync(ca,trustCert);
  const envPath=resolve(root,'.env');
  const previous=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
  const env=previous.replace(/^\s*(?:export\s+)?FRONTEND_TLS_(?:KEY|CERT)\s*=.*(?:\r?\n|$)/gm,'').trimEnd();
  writeFileSync(envPath,`${env?env+'\n':''}FRONTEND_TLS_KEY=.certs/server-key.pem\nFRONTEND_TLS_CERT=.certs/server.pem\n`);
  console.log('已配置 frontend/.env；重启 npm run dev 后使用 HTTPS。');
  console.log(`请把此公开 CA 证书复制到每台玩家电脑并安装到“受信任的根证书颁发机构”：\n${trustCert}`);
  console.log('Windows 当前用户安装命令（服务电脑也需要执行）：');
  console.log(`certutil -user -addstore Root "${trustCert}"`);
  console.log('只分享 blackarms-lan-ca.crt；私钥保留在服务电脑。安装后重启浏览器。');
  console.log('局域网访问地址（默认端口）：');
  for(const address of addresses)console.log(`https://${address}:5173`);
  console.log('IP 改变后重新运行 npm run setup:https；原 CA 不变，无需重新安装信任证书。');
}catch(error){console.error(error.message);process.exitCode=1;}
