import { roomServerUrl, connectionDefaults } from './connection.js';
import { readPreferences } from './preferences.js';
import { Match } from './game/match.js';
import { RULES, WEAPONS, WEAPON_ORDER, PRIMARY_WEAPONS, ARMOR, DIFFICULTY, BOXES, MAP, ZONES, OBJECTIVE, CORE_LABELS, PHASES, ORDERS, zoneAt, distance, clamp } from './game/data.js';
import { WorldView } from './world.js';
import { AudioEngine } from './audio.js';
import { WeaponPreview } from './visual/weapon-preview.js';
import { AdaptiveQuality, RenderPacer } from './visual/performance.js';
import { NetworkMovement, TriggerInput } from './game/netcode.js';
import { SIMULATION_STEP } from './game/movement.js';

const $=id=>document.getElementById(id),show=(id,on)=>$(id).hidden=!on;
const text=(id,value)=>{if($(id).textContent!==String(value))$(id).textContent=value;};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),debug=params.has('debug');
const defaults={sensitivity:1,fov:85,quality:'auto',maxFPS:60,volume:.65,subtitles:true,crosshair:true,colorblind:false,showFPS:true};
const qualityPreferenceVersion=1;
const saved=readPreferences('bla.settings');
const settings={...defaults,...Object.fromEntries(Object.keys(defaults).filter(k=>typeof saved[k]===typeof defaults[k]).map(k=>[k,saved[k]]))};
settings.sensitivity=clamp(settings.sensitivity,.4,3);settings.fov=clamp(settings.fov,65,110);settings.volume=clamp(settings.volume,0,1);
// Older saves include the old default even when the player never chose a preset.
if(saved.qualityVersion!==qualityPreferenceVersion||!['auto','low','medium','high'].includes(settings.quality))settings.quality=defaults.quality;
if(![0,30,60,90,120,144].includes(settings.maxFPS))settings.maxFPS=60;
const renderPacer=new RenderPacer();
const config={mode:'elimination',teamSize:3,difficulty:'normal',primary:'rifle',armor:'light'};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
let view;
function updateBootProgress(percent,stage){
  if($('boot').hidden)return;
  const progress=$('boot-progress');
  progress.value=Math.max(progress.value,Math.floor(percent));
  text('boot-percent',`${progress.value}%`);
  text('boot-stage',stage);
}
function fatal(error){
  console.error(error);
  active=false;view?.renderer.setAnimationLoop(null);show('boot',false);show('fatal',true);
  text('fatal',`无法启动 WebGPU 画面。\n请使用支持 WebGPU 的浏览器并启用硬件加速，通过 HTTPS 或本机 localhost 访问。\n请确认服务器包含 public/art/ 资源。\n\n${error.message||error}`);
}
try{view=new WorldView($('view'),settings,updateBootProgress);}catch(error){show('boot',false);show('fatal',true);text('fatal',`无法初始化 WebGPU 画面。\n请使用支持 WebGPU 的浏览器并启用硬件加速，通过 HTTPS 或本机 localhost 访问。\n\n${error.message}`);throw error;}
view.renderer.onDeviceLost=info=>fatal(new Error(`WebGPU 设备已断开：${info.message||info.reason}。请刷新页面重试。`));
window.addEventListener('rendererror',event=>{errors.push(event.detail?.message||String(event.detail));fatal(event.detail);});
const audio=new AudioEngine(settings);
let match=null,state=null,networkMovement=null,active=false,online=false,paused=false,playerId='player',inputYaw=0,inputPitch=0;
let lastEvent=0,lastRound='',lastPhase='',spectate=null,socket=null,networkId=null,lobby=null,ping=0;
let accumulator=0,lastTime=performance.now(),lastHUD=0,fps=60,frames=0,fpsAt=performance.now(),lastAnnouncement=0,damage=0,hit=0,radioUntil=0;
const keys=new Set(),trigger=new TriggerInput(),mouse={aim:false};let commands={};
const feed=[];
const weaponNotes={
  rifle:['KESTREL','全自动精准火力，沙色机匣与镂空护木。'],
  pistol:['EP–12','随身副武器，轻巧灵活。'],
  scatter:['BREACHER','八枚鹿弹近距压制，黑色隔热罩与备用霰弹。'],
  smg:['SWIFT','850 RPM，紧凑枪身与直弹匣，适合室内突击。'],
  dmr:['FALCON','半自动重击，2.25×低倍镜，稳住准星再点射。'],
  lmg:['IRONCURTAIN','60 发持续压制，箱式弹匣；移动与换弹较慢。'],
  sniper:['RAVEN','栓动狙击枪，5×瞄准镜；重击后需拉栓，腰射精度低。'],
  grenade:['FRAG','延时爆炸，对敌人造成范围伤害，墙体阻挡冲击。'],
  smoke:['SMOKE','形成持续 14 秒的烟幕，遮挡玩家与 AI 视线。'],
  flash:['FLASH','使视线内的角色短暂致盲；背对爆点可减轻效果。']
};
let weaponPreview;
function inspectWeapon(type){
  const w=WEAPONS[type];text('inspect-name',w.name);text('inspect-desc',weaponNotes[type][1]);
  $('inspect-stats').innerHTML=w.throwable?`<span>数量 <b>${w.mag}</b></span><span>引信 <b>${w.fuse}s</b></span><span>范围 <b>${w.range}m</b></span><span>效果 <b>${w.duration?`${w.duration}s`:'范围伤害'}</b></span>`:`<span>弹匣 <b>${w.mag}</b></span><span>射速 <b>${w.rpm} RPM</b></span><span>换弹 <b>${w.reload}s</b></span><span>瞄具 <b>${w.zoom?`${w.zoom}×`:'红点 / 机瞄'}</b></span>`;
  weaponPreview?.select(type);
}
const armoryGroup=document.querySelector('[data-group="primary"]');
armoryGroup.innerHTML=PRIMARY_WEAPONS.map(type=>`<button data-value="${type}" class="${type===config.primary?'selected':''}"><small>${weaponNotes[type][0]} / ${WEAPON_ORDER.indexOf(type)+1}</small><strong>${WEAPONS[type].name}</strong><p>${WEAPONS[type].mag} 发 · ${WEAPONS[type].semi?'单发':'连发'}${WEAPONS[type].zoom?` · ${WEAPONS[type].zoom}×`:''}</p></button>`).join('');
$('prepare-weapons').innerHTML=PRIMARY_WEAPONS.map(type=>`<button data-loadout="${type}">${WEAPON_ORDER.indexOf(type)+1} / ${WEAPONS[type].short}</button>`).join('');
$('throwable-previews').innerHTML=WEAPON_ORDER.filter(type=>WEAPONS[type].throwable).map(type=>`<button class="secondary" data-inspect="${type}">${WEAPON_ORDER.indexOf(type)===9?'0':WEAPON_ORDER.indexOf(type)+1} / ${WEAPONS[type].short} ×${WEAPONS[type].mag}</button>`).join('');
for(const b of document.querySelectorAll('[data-inspect]'))b.onclick=()=>inspectWeapon(b.dataset.inspect);
$('weapon-slots').innerHTML=WEAPON_ORDER.map((type,i)=>`<span data-slot="${type}"><kbd>${(i+1)%10}</kbd>${WEAPONS[type].short}<small></small></span>`).join('');
inspectWeapon(config.primary);
function safeStore(){try{localStorage.setItem('bla.settings',JSON.stringify({...settings,qualityVersion:qualityPreferenceVersion}));}catch{}}
function applySettings(){
  document.body.classList.toggle('colorblind',settings.colorblind);
  for(const k of ['sensitivity','fov','volume'])text(`${k}-output`,k==='volume'?`${Math.round(settings[k]*100)}%`:k==='fov'?`${settings[k]}°`:settings[k].toFixed(1));
  safeStore();view.resize();
}
for(const [key,value] of Object.entries(settings)){
  const el=$('settings-form').elements.namedItem(key);if(!el)continue;
  if(el.type==='checkbox')el.checked=value;else el.value=value;
  el.addEventListener('input',()=>{
    const previous=settings[key];settings[key]=el.type==='checkbox'?el.checked:el.type==='range'||key==='maxFPS'?+el.value:el.value;
    if(key==='quality'&&previous!==settings.quality&&settings.quality==='auto')view.adaptiveQuality=new AdaptiveQuality();
    if(key==='maxFPS')view.adaptiveQuality.resetSamples();
    applySettings();
  });
}
applySettings();
function openSettings(){if(active)pauseGame();$('settings').showModal();}
$('open-settings').onclick=openSettings;$('pause-settings').onclick=openSettings;
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>{});};
for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();
$('lan-dialog').addEventListener('close',()=>{if(!active)leaveRoom();});
function tab(name){for(const el of document.querySelectorAll('.tab-panel'))el.hidden=el.id!==name;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);
for(const b of document.querySelectorAll('[data-back]'))b.onclick=()=>tab('operation');
for(const group of document.querySelectorAll('[data-group]'))for(const b of group.querySelectorAll('[data-value]'))b.onclick=()=>{
  config[group.dataset.group]=group.dataset.group==='teamSize'?+b.dataset.value:b.dataset.value;
  for(const other of group.querySelectorAll('button'))other.classList.toggle('selected',b===other);
  if(group.dataset.group==='primary')inspectWeapon(b.dataset.value);
  const rule=RULES[config.teamSize];text('rule-time',`${rule.combat} 秒 / 回合`);text('rule-wins',`先赢 ${rule.wins} 回合`);
  text('mode-desc',config.mode==='core'?'携带核心，按住 E 安装并保护上传；防守方阻止安装或拆除核心。':'每回合一条命。歼灭敌方队伍，赢下整场比赛。');
};
function clearInput(){keys.clear();trigger.clear();mouse.aim=false;commands={};}
function announce(title,sub='ZERO FACILITY / TACTICAL OPERATION'){text('announcement', '');$('announcement').innerHTML=`<small>${escape(sub)}</small><strong>${escape(title)}</strong>`;lastAnnouncement=performance.now();$('announcement').classList.add('visible');}
function radio(message,call='战术频道'){if(!settings.subtitles)return;$('radio').innerHTML=`<span>${escape(call)}</span>${escape(message)}`;radioUntil=performance.now()+4200;}
function lock(){if(!active||!['combat','preparation'].includes(state?.phase)||(online&&socket?.readyState!==WebSocket.OPEN))return;audio.unlock();paused=false;show('pause',false);if(state.actors.find(a=>a.id===playerId)?.alive)$('view').requestPointerLock()?.catch?.(()=>{});}
function pauseGame(){
  if(!active||['matchResult','roundResult'].includes(state?.phase))return;
  paused=true;clearInput();document.exitPointerLock();
  const disconnected=online&&socket?.readyState!==WebSocket.OPEN;
  $('resume').disabled=disconnected;
  text('pause-title',disconnected?'连接已断开':online?'行动仍在进行':'行动暂停');text('pause-desc',disconnected?'请返回主菜单，重新连接房间。':online?'联机比赛继续运行，点击继续返回战场。':'调整呼吸，重新投入战斗。');show('pause',true);
}
function enterGame(nextState,isOnline,lateJoin=false){
  state=nextState;online=isOnline;active=true;paused=false;lastEvent=lateJoin?(nextState.events.at(-1)?.id??0):0;lastRound='';lastPhase='';spectate=null;accumulator=0;feed.length=0;clearInput();
  const a=state.actors.find(a=>a.id===playerId);inputYaw=a.yaw;inputPitch=0;
  networkMovement=isOnline?new NetworkMovement(playerId):null;
  networkMovement?.receive(state,performance.now());
  show('menu',false);show('hud',true);show('pause',false);show('result',false);$('lan-dialog').close();audio.unlock();
  text('connection-label',online?`${networkMode.toUpperCase()} / SERVER AUTHORITY`:'OFFLINE / LOCAL SIMULATION');
}
function startOffline(){playerId='player';match=new Match(config);enterGame(match.snapshot(),false);}
$('start-offline').onclick=startOffline;
function returnToMenu(){
  active=false;paused=false;state=null;match=null;networkMovement=null;document.exitPointerLock();clearInput();if(online)leaveRoom();online=false;
  show('menu',true);show('hud',false);show('pause',false);show('result',false);show('scoreboard',false);
}
$('quit').onclick=returnToMenu;$('result-menu').onclick=returnToMenu;$('resume').onclick=lock;
$('restart').onclick=()=>{if(online){send({type:'start'});}else startOffline();};
function ready(){commands.ready=true;audio.unlock();if(state?.phase==='preparation'){if(!online)match.setInput(playerId,{...getInput(),ready:true});lock();}}
$('ready').onclick=ready;
for(const b of document.querySelectorAll('[data-loadout]'))b.onclick=()=>loadout(b.dataset.loadout,null);
$('toggle-armor').onclick=()=>{const a=state?.actors.find(a=>a.id===playerId);if(a)loadout(null,a.armor==='heavy'?'light':'heavy');};
function loadout(primary,armor){
  const a=state?.actors.find(a=>a.id===playerId);if(!a)return;
  primary??=a.primary;armor??=a.armor;
  if(online)send({type:'loadout',primary,armor});else match.setLoadout(playerId,primary,armor);
  radio(`${WEAPONS[primary].name} / ${ARMOR[armor].name}`,'装备确认');
}
function selectWeapon(type){
  const a=state?.actors.find(a=>a.id===playerId);
  if(!active||paused||!a?.alive||!WEAPON_ORDER.includes(type))return;
  if(state.phase==='preparation'){if(PRIMARY_WEAPONS.includes(type))loadout(type,null);}
  else if(state.phase==='combat')commands.weapon=type;
}
function changeSpectator(delta){const allies=state?.actors.filter(a=>a.alive&&a.squad===state.actors.find(b=>b.id===playerId)?.squad)||[];if(!allies.length){spectate=null;return;}let index=allies.findIndex(a=>a.id===spectate);spectate=allies[(index+delta+allies.length)%allies.length].id;}
function getInput(consumeTrigger=false){
  const allowed=active&&!paused&&!document.querySelector('dialog[open]');
  const canFire=allowed&&state.phase==='combat'&&!!document.pointerLockElement;
  const result={forward:allowed?(+keys.has('KeyW')-+keys.has('KeyS')):0,strafe:allowed?(+keys.has('KeyD')-+keys.has('KeyA')):0,
    yaw:inputYaw,pitch:inputPitch,fire:canFire&&trigger.held,aim:allowed&&mouse.aim,
    sprint:allowed&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),crouch:allowed&&(keys.has('ControlLeft')||keys.has('KeyC')),
    jump:allowed&&keys.has('Space'),interact:allowed&&keys.has('KeyE'),reload:allowed&&keys.has('KeyR'),...commands};
  return consumeTrigger&&canFire?trigger.sample(result):result;
}
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(!active)return;
  if(['Tab','Space','F1','F2','F3','F4','ArrowLeft','ArrowRight','Escape'].includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(e.code==='Tab'){renderBoard();show('scoreboard',true);}
  if(e.repeat)return;
  if(e.code==='Escape'){if(paused)lock();else pauseGame();return;}
  if(e.code==='Enter'&&state.phase==='preparation'){ready();return;}
  if(/^Digit[0-9]$/.test(e.code))selectWeapon(WEAPON_ORDER[(Number(e.code.slice(-1))+9)%10]);
  if(e.code==='KeyG')commands.drop=true;
  const orders={F1:'follow',F2:'hold',F3:'attack',F4:'retreat'};if(orders[e.code])commands.order=orders[e.code];
  if(e.code==='ArrowLeft')changeSpectator(-1);if(e.code==='ArrowRight')changeSpectator(1);
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab')show('scoreboard',false);});
window.addEventListener('blur',()=>{clearInput();if(active)pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pauseGame();});
window.addEventListener('contextmenu',e=>e.preventDefault(),{capture:true});
window.addEventListener('mousedown',e=>{if(!document.pointerLockElement||!active||paused)return;if(e.button===0&&state.phase==='combat')trigger.press(inputYaw,inputPitch);if(e.button===2)mouse.aim=true;});
window.addEventListener('mouseup',e=>{if(e.button===0)trigger.release();if(e.button===2)mouse.aim=false;});
window.addEventListener('mousemove',e=>{if(document.pointerLockElement&&active&&!paused){const a=state?.actors.find(a=>a.id===playerId),zoom=mouse.aim&&a&&!a.reload&&!a.switchTime?(WEAPONS[a.weapon].zoom??1):1;const yaw=inputYaw-e.movementX*.002*settings.sensitivity/zoom;inputYaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));inputPitch=clamp(inputPitch-e.movementY*.002*settings.sensitivity/zoom,-1.4,1.4);}});
window.addEventListener('wheel',e=>{
  if(!active||paused||!document.pointerLockElement||!e.deltaY)return;
  e.preventDefault();const current=commands.weapon||state.actors.find(a=>a.id===playerId)?.weapon;
  selectWeapon(WEAPON_ORDER[(WEAPON_ORDER.indexOf(current)+Math.sign(e.deltaY)+WEAPON_ORDER.length)%WEAPON_ORDER.length]);
},{passive:false});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&active&&state?.phase==='combat'&&state.actors.find(a=>a.id===playerId)?.alive&&!document.querySelector('dialog[open]'))pauseGame();});
$('view').addEventListener('click',()=>{if(active&&!paused)lock();});
window.addEventListener('resize',()=>view.resize());

const deployment=connectionDefaults(window.BLACKARMS_CONFIG,import.meta.env);
let networkMode=deployment.networkMode;
const connectionSettings=readPreferences('bla.connections');
const configuredBackend=deployment.backendUrl;
$('network-mode').value=networkMode;
function updateConnectionMode(){
  networkMode=$('network-mode').value;
  $('backend-address').value=typeof connectionSettings[networkMode]==='string'?connectionSettings[networkMode]:configuredBackend;
  text('network-help',networkMode==='public'?'公网房间服务器':'局域网房间服务器');
}
updateConnectionMode();
let connecting=null;
const selectedRoomServer=()=>roomServerUrl($('backend-address').value.trim(),location.href);
function send(message){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));}
async function connect(url){
  if(socket?.readyState===WebSocket.OPEN&&socket.url===url&&networkId){playerId=networkId;return;}
  if(connecting?.url===url)return connecting.promise;
  if(socket)socket.close();networkId=null;
  const mode=networkMode,address=$('backend-address').value.trim();
  const promise=new Promise((resolve,reject)=>{
    const current=new WebSocket(url);socket=current;
    const timer=setTimeout(()=>{current.close();reject(new Error('房间服务器连接超时，请检查连接地址。'));},8000);
    current.onerror=()=>{clearTimeout(timer);reject(new Error('无法连接房间服务，请检查后台是否启动及连接地址是否正确。'));};
    current.onclose=()=>{clearTimeout(timer);reject(new Error('房间服务已断开，请重试。'));if(socket!==current)return;networkId=null;lobby=null;if(active&&online)pauseGame();else if(listVisible()&&current.url===roomListServer){clearRoomList('房间服务已断开');}else text('lan-message','房间服务已断开，请重试。');};
    current.onmessage=e=>{
      if(socket!==current)return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(!m||typeof m!=='object')return;
      if(m.type==='hello'&&typeof m.id==='string'&&m.id){networkId=m.id;playerId=m.id;clearTimeout(timer);connectionSettings[mode]=address;try{localStorage.setItem('bla.connections',JSON.stringify(connectionSettings));}catch{}resolve();}
      if(m.type==='rooms'&&listVisible()&&current.url===roomListServer&&Array.isArray(m.rooms))renderRoomList(m.rooms);
      if(m.type==='error'){text('lan-message',m.message);radio(m.message,'房间');if(listVisible()&&roomListTimer&&m.message==='请先创建或加入房间'){clearRoomList('当前服务器不支持房间列表');}}
      if(m.type==='pong')ping=Math.max(0,Math.round(performance.now()-m.sent));
      if(m.type==='lobby'){
        if($('lan-dialog').open||lobby||(active&&online)){lobby=m;renderLobby();}
        else send({type:'leave'});
      }
      if(m.type==='started'&&lobby){match=null;enterGame(m.state,true,m.lateJoin);}
      if(m.type==='state'&&active&&online){state=m.state;networkMovement.receive(state,performance.now());}
    };
  });
  connecting={url,promise};
  try{await promise;}finally{if(connecting?.promise===promise)connecting=null;}
}
const listVisible=()=>$('lan-dialog').open&&!lobby;
let roomListServer=null,roomListTimer=null,roomListVersion=0,roomListHtml='';
function stopRoomListRequest(){clearTimeout(roomListTimer);roomListTimer=null;}
function clearRoomList(status=''){
  stopRoomListRequest();roomListServer=null;roomListVersion++;roomListHtml='';
  $('room-list').replaceChildren();text('room-list-status',status);
}
function renderRoomList(rooms){
  stopRoomListRequest();
  const html=rooms.filter(r=>r&&/^[A-F0-9]{6}$/.test(r.code)).map(r=>{
    const full=r.players>=r.capacity,phase=r.phase==='lobby'?'等待开赛':PHASES[r.phase]||'进行中';
    return `<li><div><strong>${escape(r.hostName)}的房间</strong><small>${r.mode==='core'?'数据核心攻防':'团队歼灭'} · ${escape(r.teamSize)}v${escape(r.teamSize)} · ${escape(r.code)}</small></div><div class="room-occupancy"><span>${escape(r.players)}/${escape(r.capacity)}</span><small>${phase}</small></div><button class="secondary" data-room-code="${escape(r.code)}" ${full?'disabled':''}>${full?'已满':'加入'}</button></li>`;
  }).join('');
  if(html!==roomListHtml){
    const focused=document.activeElement?.dataset.roomCode;
    $('room-list').innerHTML=roomListHtml=html;
    if(focused)$('room-list').querySelector(`button[data-room-code="${CSS.escape(focused)}"]:not(:disabled)`)?.focus({preventScroll:true});
  }
  text('room-list-status',rooms.length?`共 ${rooms.length} 个房间`:'暂无房间');
}
async function refreshRooms(manual=false){
  if(!listVisible()||roomActionPending||(!manual&&(roomListTimer||!roomListServer||!networkId)))return;
  const version=++roomListVersion;
  stopRoomListRequest();
  if(manual)text('room-list-status','正在查询房间…');
  try{
    const url=selectedRoomServer();
    await connect(url);
    if(!listVisible()||version!==roomListVersion||roomActionPending||selectedRoomServer()!==url)return;
    roomListServer=url;
    roomListTimer=setTimeout(()=>clearRoomList('房间列表未响应，请刷新重试'),5000);
    send({type:'list'});
  }catch(e){if(version===roomListVersion&&listVisible())clearRoomList(e.message);}
}
function connectionChanged(){
  clearRoomList();text('lan-message','');refreshRooms(true);
}
$('network-mode').onchange=()=>{updateConnectionMode();connectionChanged();};
$('backend-address').oninput=()=>{clearRoomList('地址已更改');text('lan-message','');};
$('backend-address').onchange=connectionChanged;
$('refresh-rooms').onclick=()=>refreshRooms(true);
$('room-list').onclick=e=>{const code=e.target.closest('button[data-room-code]')?.dataset.roomCode;if(code)roomAction({type:'join',code});};
$('lan-dialog').addEventListener('close',()=>{if(!$('lan-dialog').open)clearRoomList();});
setInterval(refreshRooms,4000);
function renderLobby(){
  if(!lobby)return;clearRoomList();show('lan-connect',false);show('lan-lobby',true);text('lobby-code',lobby.code);
  text('lobby-config',`${lobby.config.mode==='core'?'数据核心攻防':'团队歼灭'} · ${lobby.config.teamSize}v${lobby.config.teamSize} · ${DIFFICULTY[lobby.config.difficulty].name}`);
  $('lobby-players').innerHTML=lobby.players.map(p=>`<div class="lobby-player"><span class="${p.squad===0?'alpha':'bravo'}">${escape(p.name)}${p.id===playerId?' / YOU':''}</span><small>${p.squad===0?'ALPHA':'BRAVO'}${p.id===lobby.host?' · 房主':''}</small></div>`).join('')+`<p class="muted">剩余 ${lobby.config.teamSize*2-lobby.players.length} 个位置由 AI 补齐</p>`;
  $('launch-room').disabled=lobby.host!==playerId;text('lan-message',lobby.host===playerId?'等待队友加入后，由你开始比赛。':'等待房主开始比赛…');
  if(active&&online&&state?.phase==='matchResult')$('restart').disabled=lobby.host!==playerId;
}
function leaveRoom(){
  send({type:'leave'});
  if(socket&&!networkId){socket.close();socket=null;}
  lobby=null;show('lan-connect',true);show('lan-lobby',false);$('resume').disabled=false;
  if(listVisible())refreshRooms(true);
}
const playerName=$('player-name'),playerNameLimit=20;
function updatePlayerName(){
  const value=playerName.value,count=[...value].length;
  text('player-name-count',`${count} / ${playerNameLimit}`);
  let error='';
  if(!/[^ ]/.test(value))error='请输入呼号。';
  else if(count>playerNameLimit)error=`呼号最多 ${playerNameLimit} 个字符。`;
  else if(/[^\p{Alphabetic}\p{Number} ]|^ | $/u.test(value))error='呼号只能包含汉字、字母、数字和中间的空格。';
  playerName.setCustomValidity(error);
}
playerName.addEventListener('input',updatePlayerName);
$('open-lan').onclick=()=>{show('lan-connect',!lobby);show('lan-lobby',!!lobby);text('lan-message','');updatePlayerName();$('lan-dialog').showModal();if(!lobby)refreshRooms(true);};
let roomActionPending=false;
async function roomAction(message){
  if(roomActionPending)return;
  updatePlayerName();
  if(!playerName.reportValidity())return;
  const name=playerName.value;
  roomActionPending=true;$('create-room').disabled=true;$('join-room').disabled=true;
  text('lan-message','');
  try{const url=selectedRoomServer();await connect(url);if(listVisible()&&selectedRoomServer()===url)send({...message,name});}catch(e){text('lan-message',e.message);}
  finally{roomActionPending=false;$('create-room').disabled=false;$('join-room').disabled=false;}
}
$('create-room').onclick=()=>roomAction({type:'create',config:{...config}});
$('join-room').onclick=()=>roomAction({type:'join',code:$('room-code').value});
$('launch-room').onclick=()=>send({type:'start'});$('leave-room').onclick=leaveRoom;
$('join-alpha').onclick=()=>send({type:'team',squad:0});$('join-bravo').onclick=()=>send({type:'team',squad:1});
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)send({type:'ping',sent:performance.now()});},5000);

function events(){
  for(const e of state.events){
    if(e.id<=lastEvent)continue;lastEvent=e.id;
    if(online&&e.type==='shot'&&e.actor!==playerId)networkMovement.queueRemoteShot(e);
    else {view.event(e,playerId);audio.event(e,playerId,state);}
    if(e.type==='damage'&&e.source===playerId){hit=1;$('hitmarker').style.color=e.part==='weakpoint'?'#e6c079':'#edf1d7';}
    if(e.type==='damage'&&e.actor===playerId){damage=Math.min(.9,damage+.35);const from=state.actors.find(a=>a.id===e.source),me=state.actors.find(a=>a.id===playerId);if(from&&me)$('damage-direction').style.rotate=`${Math.atan2(-(from.x-me.x),-(from.z-me.z))-me.yaw}rad`;}
    if(e.type==='kill'){
      const target=state.actors.find(a=>a.id===e.actor),killer=state.actors.find(a=>a.id===e.source);
      feed.push({until:performance.now()+6500,killer:killer?.name||'环境',victim:target?.name||'',weak:e.part==='weakpoint'});
      if(e.actor===playerId){clearInput();document.exitPointerLock();paused=false;show('pause',false);changeSpectator(1);radio('你已阵亡，正在观察存活队友。','战术观察');}
    }
    if(e.type==='order')radio(ORDERS[e.order],state.actors.find(a=>a.id===e.actor)?.name||'队长');
    if(e.type==='core')radio(({uploading:'数据核心已安装，保护上传！',defused:'核心已拆除。',dropped:'核心掉落，前往回收。',carried:'核心已被拾取。',reset:'核心已送回攻击方集结区。',completed:'数据上传完成。'})[e.state]||'核心状态已更新。');
    if(e.type==='combat')announce('行动开始',state.config.mode==='core'?'DATA CORE / 核心攻防':'TEAM ELIMINATION / 团队歼灭');
    if(e.type==='sides')radio('攻守交换。装备、位置和目标已重置。');
    if(e.type==='overtime')announce('加时 15 秒','OVERTIME / 最后机会');
  }
}
let minimapBackground;
function mapDraw(me){
  const ctx=$('minimap').getContext('2d'),w=ctx.canvas.width,h=ctx.canvas.height;
  const sx=Math.min((w-28)/MAP.width,(h-28)/MAP.depth),sz=sx,px=x=>w/2+x*sx,pz=z=>h/2+z*sz;
  if(!minimapBackground||minimapBackground.width!==w||minimapBackground.height!==h){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const bg=canvas.getContext('2d');minimapBackground=canvas;
    for(const zone of ZONES){
      bg.fillStyle=zone.code.startsWith('N')?'#7ac8e311':zone.code.startsWith('S')?'#d8b38a15':'#98bdc408';
      bg.fillRect(px(zone.x-zone.w/2),pz(zone.z-zone.d/2),zone.w*sx,zone.d*sz);
    }
    bg.strokeStyle='#98bdc414';bg.lineWidth=1;for(let x=-MAP.halfWidth;x<=MAP.halfWidth;x+=4){bg.beginPath();bg.moveTo(px(x),pz(-MAP.halfDepth));bg.lineTo(px(x),pz(MAP.halfDepth));bg.stroke();}
    for(const b of BOXES){bg.fillStyle=b.h<1.5?'#566760':'#8b9e9677';bg.fillRect(px(b.minX),pz(b.minZ),b.w*sx,b.d*sz);}
  }
  ctx.clearRect(0,0,w,h);ctx.drawImage(minimapBackground,0,0);
  if(state.config.mode==='core'){
    ctx.strokeStyle='#c9dd9c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(OBJECTIVE.x),pz(OBJECTIVE.z),OBJECTIVE.radius*sx,0,Math.PI*2);ctx.stroke();
    const c=state.core;if(c.carrier===playerId||!c.carrier||state.actors.find(a=>a.id===c.carrier)?.squad===me.squad){ctx.fillStyle='#dde9a8';ctx.fillRect(px(c.x)-3,pz(c.z)-3,6,6);}
  }
  for(const a of state.actors.filter(a=>a.alive&&a.squad===me.squad)){
    ctx.save();ctx.translate(px(a.x),pz(a.z));ctx.rotate(-a.yaw);ctx.fillStyle=a.id===playerId?'#f1f4d4':'#7ac8e3';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4,5);ctx.lineTo(0,2);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore();
  }
}
function renderBoard(){
  if(!state)return;
  $('board-content').innerHTML=[0,1].map(s=>`<p class="team-header ${s===0?'alpha':'bravo'}">${s===0?'ALPHA':'BRAVO'} / ${s===state.attackSquad?'攻击方':'防守方'}</p><table><thead><tr><th>队员</th><th>击杀</th><th>阵亡</th><th>伤害</th><th>目标贡献</th></tr></thead><tbody>${state.actors.filter(a=>a.squad===s).map(a=>`<tr class="${a.alive?'':'dead'}"><td>${escape(a.name)} ${a.bot?'[AI]':a.id===playerId?'[YOU]':'[LAN]'}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${Math.round(a.damage)}</td><td>${a.contribution}</td></tr>`).join('')}</tbody></table>`).join('');
}
function renderHUD(now){
  const me=state.actors.find(a=>a.id===playerId);if(!me)return;
  const roundKey=`${state.round}/${state.attackSquad}`;
  if(lastRound!==roundKey){lastRound=roundKey;inputYaw=me.yaw;inputPitch=0;spectate=null;clearInput();paused=false;show('pause',false);}
  if(!me.alive&&(!spectate||!state.actors.find(a=>a.id===spectate)?.alive))changeSpectator(1);
  const subject=state.actors.find(a=>a.id===spectate)||me;
  const inCombat=subject.alive&&state.phase==='combat';
  $('flash-overlay').style.opacity=inCombat?clamp((subject.flash||0)/.7,0,1):0;
  const smokeDepth=Math.max(0,...(state.smokes||[]).map(s=>s.radius-Math.hypot(subject.x-s.x,(subject.y||0)+(subject.crouch?1.07:1.57)-s.y,subject.z-s.z)));
  $('smoke-overlay').style.opacity=inCombat?clamp(smokeDepth*1.7,0,.99):0;
  if(lastPhase!==state.phase){
    lastPhase=state.phase;
    if(state.phase==='roundResult'||state.phase==='matchResult'){paused=false;clearInput();document.exitPointerLock();show('pause',false);}
    if(state.phase==='combat'&&me.alive&&!document.pointerLockElement&&!debug)pauseGame();
  }
  text('score-alpha',state.scores[0]);text('score-bravo',state.scores[1]);text('round-label',`ROUND ${String(state.round).padStart(2,'0')}`);
  const timer=['uploading','defusing'].includes(state.core.state)?state.core.upload:state.remaining;
  text('timer',`${String(Math.floor(Math.ceil(timer)/60)).padStart(2,'0')}:${String(Math.ceil(timer)%60).padStart(2,'0')}`);
  $('timer').parentElement.classList.toggle('danger',timer<10);text('phase-label',state.overtime?'加时赛':PHASES[state.phase]);
  for(const [s,id] of [[0,'alpha-roster'],[1,'bravo-roster']]){
    const html=state.actors.filter(a=>a.squad===s).map(a=>`<i class="roster-dot${a.alive?'':' dead'}${a.id===playerId?' self':''}" title="${escape(a.name)}"></i>`).join('');if($(id).innerHTML!==html)$(id).innerHTML=html;
  }
  const z=zoneAt(subject);text('zone-label',z.name);text('zone-code',z.code);text('hp',Math.ceil(subject.hp));$('hp-bar').style.width=`${subject.hp}%`;
  text('armor-label',`${ARMOR[subject.armor].name} / ${Math.round(ARMOR[subject.armor].protection*100)}% 减伤`);
  show('core-carrier',state.core.carrier===subject.id);text('weapon-label',WEAPONS[subject.weapon].name);
  text('ammo',subject.ammo[subject.weapon].mag);text('reserve',subject.ammo[subject.weapon].reserve);
  $('ammo').parentElement.parentElement.classList.toggle('low',subject.ammo[subject.weapon].mag<(WEAPONS[subject.weapon].throwable?1:5));
  text('reload-label',subject.switchTime>0?'切换武器…':WEAPONS[subject.weapon].throwable?(subject.ammo[subject.weapon].mag>0?'左键投掷 · 8 手雷 / 9 烟雾 / 0 闪光':'已用完 · 切换其他武器'):subject.reload>0?`换弹中 · ${subject.reload.toFixed(1)}s`:subject.weapon==='sniper'&&subject.cooldown>0?'拉栓中…':'1–0 / 滚轮 切换武器　R 换弹');
  for(const slot of document.querySelectorAll('[data-slot]')){
    slot.classList.toggle('selected',slot.dataset.slot===subject.weapon);
    slot.querySelector('small').textContent=subject.ammo[slot.dataset.slot].mag;
  }
  const scoped=subject.alive&&state.phase==='combat'&&subject.aim&&WEAPONS[subject.weapon].zoom>1&&!subject.reload&&!subject.switchTime;
  show('scope-overlay',scoped);text('scope-label',`${WEAPONS[subject.weapon].short} / ${WEAPONS[subject.weapon].zoom??1}×`);
  text('side-label',`${me.squad===state.attackSquad?'攻击方':'防守方'} / ${me.squad===0?'ALPHA':'BRAVO'}`);
  text('objective-title',state.config.mode==='core'?(me.squad===state.attackSquad?'安装并保护数据核心':'阻止核心上传'):'歼灭敌方队伍');
  text('objective-sub',state.config.mode==='core'?`核心 · ${CORE_LABELS[state.core.state]}${['uploading','defusing'].includes(state.core.state)?` / ${Math.ceil(state.core.upload)}s`:''}`:`敌方存活 ${state.actors.filter(a=>a.squad!==me.squad&&a.alive).length} / ${state.config.teamSize} · 先赢 ${state.rules.wins} 回合`);
  $('upload-bar').style.width=['uploading','defusing'].includes(state.core.state)?`${(1-state.core.upload/OBJECTIVE.upload)*100}%`:'0%';
  show('prepare-panel',state.phase==='preparation'&&!me.ready);show('spectator',!me.alive&&state.phase==='combat');text('spectator-name',spectate?subject.name:'无存活队友 · 等待回合结束');
  for(const b of document.querySelectorAll('[data-loadout]'))b.classList.toggle('selected',b.dataset.loadout===me.primary);
  text('toggle-armor',ARMOR[me.armor].name+' ↔');
  const order=state.orders[me.squad];text('order-label',order&&order.until>state.time?ORDERS[order.type]:'自主行动');
  show('crosshair',settings.crosshair&&me.alive&&state.phase==='combat'&&!scoped);$('crosshair').style.setProperty('--gap',`${7+me.shotHeat*15-(me.aim?4:0)}px`);
  const c=state.core;let hint='';
  if(me.alive&&state.phase==='combat'&&state.config.mode==='core'){
    if(c.carrier===me.id&&distance(me,OBJECTIVE)<OBJECTIVE.radius)hint='原地按住 E · 安装核心';
    else if(['uploading','defusing'].includes(c.state)&&me.squad!==state.attackSquad&&distance(me,c)<OBJECTIVE.radius)hint='原地按住 E · 拆除核心';
    else if(['available','dropped'].includes(c.state)&&distance(me,c)<1.5)hint=me.squad===state.attackSquad?'按住 E · 拾取核心':'按住 E · 将核心送回集结区';
  }
  show('interaction',!!hint);text('interaction-label',hint);
  const duration=c.state==='planting'?5:c.state==='defusing'?5:1.5;
  $('interaction-circle').style.strokeDashoffset=119.4*(1-(c.interactor===me.id?c.progress/duration:0));
  show('result',['roundResult','matchResult'].includes(state.phase));
  if(state.result){
    const win=state.result.winner===me.squad;const final=state.phase==='matchResult';
    text('result-kicker',final?'MATCH COMPLETE / 比赛结束':'ROUND COMPLETE / 回合结束');text('result-title',state.result.winner===null?'回合平局':win?(final?'行动胜利':'回合胜利'):(final?'行动失利':'回合失利'));
    text('result-reason',state.result.reason);text('result-alpha',state.scores[0]);text('result-bravo',state.scores[1]);
    const html=`<div class="stats-row"><div><strong>${me.kills} / ${me.deaths}</strong><small>击杀 / 阵亡</small></div><div><strong>${Math.round(me.damage)}</strong><small>累计造成伤害</small></div><div><strong>${me.contribution}</strong><small>目标贡献</small></div></div>`;
    if($('result-stats').innerHTML!==html)$('result-stats').innerHTML=html;
    show('result-actions',final);$('restart').disabled=online&&lobby?.host!==playerId;
    text('next-round',final?(online&&lobby?.host!==playerId?'等待房主再次开始比赛。':''):`${Math.ceil(state.remaining)} 秒后进入下一回合${state.round%state.rules.switchAfter===0?' · 即将交换攻守':''}`);
  }
  if(online)text('connection-label',`${networkMode.toUpperCase()} / ${ping} ms / ${lobby?.code||''}`);
  while(feed[0]?.until<now)feed.shift();const html=feed.slice(-5).map(f=>`<div class="kill-entry">${escape(f.killer)}<b>${f.weak?'◇':'╾━'}</b>${escape(f.victim)}</div>`).join('');if($('kill-feed').innerHTML!==html)$('kill-feed').innerHTML=html;
  if(!$('scoreboard').hidden)renderBoard();mapDraw(me);
}
document.addEventListener('visibilitychange',()=>view.adaptiveQuality.resetSamples());
function frame(now){
  const dt=Math.min((now-lastTime)/1000,.1);lastTime=now;
  if(now-fpsAt>=1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;text('fps',settings.showFPS?`${Math.round(fps)} FPS · ${view.renderer.info.render.drawCalls} calls`:'');}
  if(active){
    if(!online&&!paused&&!document.querySelector('dialog[open]')){
      accumulator+=dt;
      if(accumulator>=1/60){
        do{match.setInput(playerId,getInput(true));match.step(1/60);commands={};accumulator-=1/60;}while(accumulator>=1/60);
        state=match.snapshot();
      }
    }else if(online){
      accumulator+=dt;
      while(accumulator+1e-9>=SIMULATION_STEP){networkMovement.step(getInput(true),state);commands={};accumulator=Math.max(0,accumulator-SIMULATION_STEP);}
      // Flush on the same callback that sampled the input, batching only catch-up ticks.
      const frames=networkMovement.takeInputs();
      if(frames.length)send({type:'input',session:state.session,round:state.round,frames});
    }
    events();if(now-lastHUD>50){renderHUD(now);lastHUD=now;}
    const me=state.actors.find(a=>a.id===playerId);audio.update(state,me,keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD'));
  }
  hit=Math.max(0,hit-dt*5);damage=Math.max(0,damage-dt*.55);$('hitmarker').style.opacity=hit;$('damage-overlay').style.opacity=damage;$('damage-direction').style.opacity=damage;
  if(now-lastAnnouncement>2500)$('announcement').classList.remove('visible');if(now>radioUntil)text('radio','');
  const idle=!active||paused||!!document.querySelector('dialog[open]');
  const adapting=settings.quality==='auto'&&!idle&&!document.hidden&&state?.phase==='combat';
  if(!adapting&&view.adaptiveQuality.start!==null)view.adaptiveQuality.resetSamples();
  const rate=idle?Math.min(settings.maxFPS||60,active?15:30):settings.maxFPS;
  const renderDt=renderPacer.tick(now,rate,!document.hidden);
  if(renderDt===null)return;
  const me=state?.actors.find(a=>a.id===playerId);const camera=me?.alive?{yaw:inputYaw,pitch:inputPitch}:{spectate};
  camera.networkSmoothed=online;
  const renderState=active&&online?networkMovement.render(state,now,Math.min(renderDt,.1),{input:getInput(),remainder:accumulator}):state;
  try{
    if(active&&online)for(const e of networkMovement.takeRemoteShots(now)){view.event(e,playerId);audio.event(e,playerId,renderState);}
    view.render(active?renderState:null,playerId,renderDt,now/1000,camera);frames++;
    if(adapting&&view.adaptiveQuality.sample(now,settings.maxFPS))view.resize();
  }catch(error){fatal(error);return;}
}
view.ready.then(async()=>{
  updateBootProgress(72,'正在初始化装备预览…');
  weaponPreview=new WeaponPreview($('weapon-preview'),view.kit);await weaponPreview.ready;
  weaponPreview.renderer.onDeviceLost=info=>fatal(new Error(`WebGPU 预览设备已断开：${info.message||info.reason}`));
  inspectWeapon(config.primary);
  const warmupStage='正在预热战场渲染…',audioStage='正在准备音效…';
  let warmup=0,audioReady=false;
  const report=()=>updateBootProgress(78+18*warmup+(audioReady?3:0),warmup<1?warmupStage:audioStage);
  report();
  await Promise.all([
    view.prepareGameplay(new Match({...config,mode:'core',teamSize:3}).snapshot(),'player',fraction=>{warmup=fraction;report();}),
    audio.prepare().then(()=>{audioReady=true;report();})
  ]);
  if($('fatal').hidden===false)return;
  updateBootProgress(100,'启动完成');
  lastTime=performance.now();show('boot',false);view.renderer.setAnimationLoop(frame);
  if(debug){
    window.__BLA={get state(){return state;},get match(){return match;},get view(){return view;},get weaponPreview(){return weaponPreview;},get networkMovement(){return networkMovement;},get errors(){return errors;},get paused(){return paused;},config,settings,
      start:startOffline,input(i){if(match)match.setInput(playerId,i);},step(seconds){if(!match)return;for(let i=0;i<seconds*60;i++)match.step(1/60);state=match.snapshot();},
      pause(){paused=true;},resume(){paused=false;},get playerId(){return playerId;}};
  }
}).catch(fatal);
