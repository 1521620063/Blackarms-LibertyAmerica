import './style.css';
import { Match } from './shared/match.js';
import { RULES, WEAPONS, ARMOR, DIFFICULTY, BOXES, OBJECTIVE, CORE_LABELS, PHASES, ORDERS, zoneAt, distance, clamp } from './shared/data.js';
import { WorldView } from './world.js';
import { AudioEngine } from './audio.js';

const $=id=>document.getElementById(id),show=(id,on)=>$(id).hidden=!on;
const text=(id,value)=>{if($(id).textContent!==String(value))$(id).textContent=value;};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search),debug=params.has('debug');
const defaults={sensitivity:1,fov:85,quality:'medium',volume:.65,subtitles:true,crosshair:true,colorblind:false,showFPS:false};
let saved={};try{saved=JSON.parse(localStorage.getItem('bla.settings')||'{}');}catch{}
const settings={...defaults,...Object.fromEntries(Object.keys(defaults).filter(k=>typeof saved[k]===typeof defaults[k]).map(k=>[k,saved[k]]))};
settings.sensitivity=clamp(settings.sensitivity,.4,3);settings.fov=clamp(settings.fov,65,110);settings.volume=clamp(settings.volume,0,1);
if(!['low','medium','high'].includes(settings.quality))settings.quality='medium';
const config={mode:'elimination',teamSize:3,difficulty:'normal',primary:'rifle',armor:'light'};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
let view;
try{view=new WorldView($('view'),settings);}catch(error){show('boot',false);show('fatal',true);text('fatal',`无法初始化 3D 画面。\n请使用支持 WebGL 2 的桌面浏览器，并启用硬件加速。\n\n${error.message}`);throw error;}
const audio=new AudioEngine(settings);
let match=null,state=null,active=false,online=false,paused=false,playerId='player',inputYaw=0,inputPitch=0;
let lastEvent=0,lastRound='',lastPhase='',spectate=null,socket=null,networkId=null,lobby=null,ping=0;
let accumulator=0,lastTime=performance.now(),lastNetwork=0,lastHUD=0,fps=60,frames=0,fpsAt=performance.now(),lastAnnouncement=0,damage=0,hit=0,radioUntil=0;
const keys=new Set(),mouse={fire:false,aim:false};let commands={};
const feed=[];
function safeStore(){try{localStorage.setItem('bla.settings',JSON.stringify(settings));}catch{}}
function applySettings(){
  document.body.classList.toggle('colorblind',settings.colorblind);
  for(const k of ['sensitivity','fov','volume'])text(`${k}-output`,k==='volume'?`${Math.round(settings[k]*100)}%`:k==='fov'?`${settings[k]}°`:settings[k].toFixed(1));
  safeStore();view.resize();
}
for(const [key,value] of Object.entries(settings)){
  const el=$('settings-form').elements.namedItem(key);if(!el)continue;
  if(el.type==='checkbox')el.checked=value;else el.value=value;
  el.addEventListener('input',()=>{settings[key]=el.type==='checkbox'?el.checked:el.type==='range'?+el.value:el.value;applySettings();});
}
applySettings();
function openSettings(){if(active)pauseGame();$('settings').showModal();}
$('open-settings').onclick=openSettings;$('pause-settings').onclick=openSettings;
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>{});};
for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();
$('lan-dialog').addEventListener('close',()=>{if(!active&&lobby)leaveRoom();});
function tab(name){for(const el of document.querySelectorAll('.tab-panel'))el.hidden=el.id!==name;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);
for(const b of document.querySelectorAll('[data-back]'))b.onclick=()=>tab('operation');
for(const group of document.querySelectorAll('[data-group]'))for(const b of group.querySelectorAll('[data-value]'))b.onclick=()=>{
  config[group.dataset.group]=group.dataset.group==='teamSize'?+b.dataset.value:b.dataset.value;
  for(const other of group.querySelectorAll('button'))other.classList.toggle('selected',b===other);
  const rule=RULES[config.teamSize];text('rule-time',`${rule.combat} 秒 / 回合`);text('rule-wins',`先赢 ${rule.wins} 回合`);
  text('mode-desc',config.mode==='core'?'携带核心，按住 E 安装并保护上传；防守方阻止安装或拆除核心。':'每回合一条命。歼灭敌方队伍，赢下整场比赛。');
};
function clearInput(){keys.clear();mouse.fire=false;mouse.aim=false;commands={};}
function announce(title,sub='ZERO FACILITY / TACTICAL OPERATION'){text('announcement', '');$('announcement').innerHTML=`<small>${escape(sub)}</small><strong>${escape(title)}</strong>`;lastAnnouncement=performance.now();$('announcement').classList.add('visible');}
function radio(message,call='战术频道'){if(!settings.subtitles)return;$('radio').innerHTML=`<span>${escape(call)}</span>${escape(message)}`;radioUntil=performance.now()+4200;}
function lock(){if(!active||!['combat','preparation'].includes(state?.phase))return;audio.unlock();paused=false;show('pause',false);if(state.actors.find(a=>a.id===playerId)?.alive)$('view').requestPointerLock()?.catch?.(()=>{});}
function pauseGame(){
  if(!active||['matchResult','roundResult'].includes(state?.phase))return;
  paused=true;clearInput();document.exitPointerLock();text('pause-title',online?'行动仍在进行':'行动暂停');text('pause-desc',online?'局域网比赛继续运行，点击继续返回战场。':'调整呼吸，重新投入战斗。');show('pause',true);
}
function enterGame(nextState,isOnline){
  state=nextState;online=isOnline;active=true;paused=false;lastEvent=0;lastRound='';lastPhase='';spectate=null;accumulator=0;feed.length=0;clearInput();
  const a=state.actors.find(a=>a.id===playerId);inputYaw=a.yaw;inputPitch=0;
  show('menu',false);show('hud',true);show('pause',false);show('result',false);$('lan-dialog').close();audio.unlock();
  text('connection-label',online?'LAN / SERVER AUTHORITY':'OFFLINE / LOCAL SIMULATION');
}
function startOffline(){playerId='player';match=new Match(config);enterGame(match.snapshot(),false);}
$('start-offline').onclick=startOffline;
function returnToMenu(){
  active=false;paused=false;state=null;match=null;document.exitPointerLock();clearInput();if(online)leaveRoom();online=false;
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
function changeSpectator(delta){const allies=state?.actors.filter(a=>a.alive&&a.squad===state.actors.find(b=>b.id===playerId)?.squad)||[];if(!allies.length){spectate=null;return;}let index=allies.findIndex(a=>a.id===spectate);spectate=allies[(index+delta+allies.length)%allies.length].id;}
function getInput(){
  const allowed=active&&!paused&&!document.querySelector('dialog[open]');
  const result={forward:allowed?(+keys.has('KeyW')-+keys.has('KeyS')):0,strafe:allowed?(+keys.has('KeyD')-+keys.has('KeyA')):0,
    yaw:inputYaw,pitch:inputPitch,fire:allowed&&mouse.fire&&!!document.pointerLockElement,aim:allowed&&mouse.aim,
    sprint:allowed&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),crouch:allowed&&(keys.has('ControlLeft')||keys.has('KeyC')),
    jump:allowed&&keys.has('Space'),interact:allowed&&keys.has('KeyE'),reload:allowed&&keys.has('KeyR'),...commands};
  return result;
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
  if(e.code==='Digit1') {if(state.phase==='preparation')loadout('rifle',null);else commands.weapon=state.actors.find(a=>a.id===playerId).primary;}
  if(e.code==='Digit2') {if(state.phase==='preparation')loadout('scatter',null);else commands.weapon='pistol';}
  if(e.code==='KeyG')commands.drop=true;
  const orders={F1:'follow',F2:'hold',F3:'attack',F4:'retreat'};if(orders[e.code])commands.order=orders[e.code];
  if(e.code==='ArrowLeft')changeSpectator(-1);if(e.code==='ArrowRight')changeSpectator(1);
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab')show('scoreboard',false);});
window.addEventListener('blur',()=>{clearInput();if(active)pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pauseGame();});
$('view').addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('mousedown',e=>{if(!document.pointerLockElement)return;if(e.button===0)mouse.fire=true;if(e.button===2)mouse.aim=true;});
window.addEventListener('mouseup',e=>{if(e.button===0)mouse.fire=false;if(e.button===2)mouse.aim=false;});
window.addEventListener('mousemove',e=>{if(document.pointerLockElement&&active&&!paused){inputYaw-=e.movementX*.002*settings.sensitivity;inputPitch=clamp(inputPitch-e.movementY*.002*settings.sensitivity,-1.4,1.4);}});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&active&&state?.phase==='combat'&&state.actors.find(a=>a.id===playerId)?.alive&&!document.querySelector('dialog[open]'))pauseGame();});
$('view').addEventListener('click',()=>{if(active&&!paused)lock();});
window.addEventListener('resize',()=>view.resize());

function send(message){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));}
async function connect(){
  if(socket?.readyState===WebSocket.OPEN){playerId=networkId;return;}
  await new Promise((resolve,reject)=>{
    socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/lan`);
    socket.onopen=resolve;socket.onerror=()=>reject(new Error('无法连接房间服务，请通过 npm run dev 启动游戏'));
    socket.onclose=()=>{lobby=null;if(active&&online){paused=true;clearInput();show('pause',true);text('pause-title','连接已断开');text('pause-desc','请返回主菜单，重新连接房间。');$('resume').disabled=true;}else text('lan-message','房间服务已断开，请重试。');};
    socket.onmessage=e=>{
      const m=JSON.parse(e.data);
      if(m.type==='hello'){networkId=m.id;playerId=m.id;}
      if(m.type==='error'){text('lan-message',m.message);radio(m.message,'房间');}
      if(m.type==='pong')ping=Math.max(0,Math.round(performance.now()-m.sent));
      if(m.type==='lobby'){lobby=m;renderLobby();}
      if(m.type==='started'){match=null;enterGame(m.state,true);}
      if(m.type==='state'&&active&&online)state=m.state;
    };
  });
}
function renderLobby(){
  if(!lobby)return;show('lan-connect',false);show('lan-lobby',true);text('lobby-code',lobby.code);
  text('lobby-config',`${lobby.config.mode==='core'?'数据核心攻防':'团队歼灭'} · ${lobby.config.teamSize}v${lobby.config.teamSize} · ${DIFFICULTY[lobby.config.difficulty].name}`);
  $('lobby-players').innerHTML=lobby.players.map(p=>`<div class="lobby-player"><span class="${p.squad===0?'alpha':'bravo'}">${escape(p.name)}${p.id===playerId?' / YOU':''}</span><small>${p.squad===0?'ALPHA':'BRAVO'}${p.id===lobby.host?' · 房主':''}</small></div>`).join('')+`<p class="muted">剩余 ${lobby.config.teamSize*2-lobby.players.length} 个位置由 AI 补齐</p>`;
  $('launch-room').disabled=lobby.host!==playerId;text('lan-message',lobby.host===playerId?'等待队友加入后，由你开始比赛。':'等待房主开始比赛…');
  if(active&&online&&state?.phase==='matchResult')$('restart').disabled=lobby.host!==playerId;
}
function leaveRoom(){send({type:'leave'});lobby=null;show('lan-connect',true);show('lan-lobby',false);$('resume').disabled=false;}
$('open-lan').onclick=()=>{show('lan-connect',!lobby);show('lan-lobby',!!lobby);text('lan-message','');$('lan-dialog').showModal();};
$('create-room').onclick=async()=>{try{await connect();send({type:'create',config,name:$('player-name').value});}catch(e){text('lan-message',e.message);}};
$('join-room').onclick=async()=>{try{await connect();send({type:'join',code:$('room-code').value,name:$('player-name').value});}catch(e){text('lan-message',e.message);}};
$('launch-room').onclick=()=>send({type:'start'});$('leave-room').onclick=leaveRoom;
$('join-alpha').onclick=()=>send({type:'team',squad:0});$('join-bravo').onclick=()=>send({type:'team',squad:1});
setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)send({type:'ping',sent:performance.now()});},5000);

function events(){
  for(const e of state.events){
    if(e.id<=lastEvent)continue;lastEvent=e.id;view.event(e,playerId);audio.event(e,playerId,state);
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
function mapDraw(me){
  const ctx=$('minimap').getContext('2d');ctx.clearRect(0,0,380,240);const sx=10.6,sz=10.6,px=x=>190+x*sx,pz=z=>120+z*sz;
  ctx.strokeStyle='#98bdc414';ctx.lineWidth=1;for(let x=-15;x<=15;x+=3){ctx.beginPath();ctx.moveTo(px(x),14);ctx.lineTo(px(x),226);ctx.stroke();}
  for(const b of BOXES){ctx.fillStyle=b.h<1.5?'#566760':'#8b9e9677';ctx.fillRect(px(b.minX),pz(b.minZ),b.w*sx,b.d*sz);}
  if(state.config.mode==='core'){
    ctx.strokeStyle='#c9dd9c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(6),pz(0),17,0,Math.PI*2);ctx.stroke();
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
  $('ammo').parentElement.parentElement.classList.toggle('low',subject.ammo[subject.weapon].mag<5);
  text('reload-label',subject.reload>0?`换弹中 · ${subject.reload.toFixed(1)}s`:'1 主武器　2 副武器　R 换弹');
  text('side-label',`${me.squad===state.attackSquad?'攻击方':'防守方'} / ${me.squad===0?'ALPHA':'BRAVO'}`);
  text('objective-title',state.config.mode==='core'?(me.squad===state.attackSquad?'安装并保护数据核心':'阻止核心上传'):'歼灭敌方队伍');
  text('objective-sub',state.config.mode==='core'?`核心 · ${CORE_LABELS[state.core.state]}${['uploading','defusing'].includes(state.core.state)?` / ${Math.ceil(state.core.upload)}s`:''}`:`敌方存活 ${state.actors.filter(a=>a.squad!==me.squad&&a.alive).length} / ${state.config.teamSize} · 先赢 ${state.rules.wins} 回合`);
  $('upload-bar').style.width=['uploading','defusing'].includes(state.core.state)?`${(1-state.core.upload/OBJECTIVE.upload)*100}%`:'0%';
  show('prepare-panel',state.phase==='preparation'&&!me.ready);show('spectator',!me.alive&&state.phase==='combat');text('spectator-name',spectate?subject.name:'无存活队友 · 等待回合结束');
  for(const b of document.querySelectorAll('[data-loadout]'))b.classList.toggle('selected',b.dataset.loadout===me.primary);
  text('toggle-armor',ARMOR[me.armor].name+' ↔');
  const order=state.orders[me.squad];text('order-label',order&&order.until>state.time?ORDERS[order.type]:'自主行动');
  show('crosshair',settings.crosshair&&me.alive&&state.phase==='combat');$('crosshair').style.setProperty('--gap',`${7+me.shotHeat*15-(me.aim?4:0)}px`);
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
  if(online)text('connection-label',`LAN / ${ping} ms / ${lobby?.code||''}`);
  while(feed[0]?.until<now)feed.shift();const html=feed.slice(-5).map(f=>`<div class="kill-entry">${escape(f.killer)}<b>${f.weak?'◇':'╾━'}</b>${escape(f.victim)}</div>`).join('');if($('kill-feed').innerHTML!==html)$('kill-feed').innerHTML=html;
  if(!$('scoreboard').hidden)renderBoard();mapDraw(me);
}
function frame(now){
  const dt=Math.min((now-lastTime)/1000,.1);lastTime=now;frames++;
  if(now-fpsAt>=1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;text('fps',settings.showFPS?`${Math.round(fps)} FPS · ${view.renderer.info.render.calls} calls`:'');}
  if(active){
    if(!online&&!paused&&!document.querySelector('dialog[open]')){
      accumulator+=dt;
      while(accumulator>=1/60){match.setInput(playerId,getInput());match.step(1/60);commands={};accumulator-=1/60;}
      state=match.snapshot();
    }else if(online&&now-lastNetwork>33){send({type:'input',input:getInput()});commands={};lastNetwork=now;}
    events();if(now-lastHUD>50){renderHUD(now);lastHUD=now;}
    const me=state.actors.find(a=>a.id===playerId);audio.update(state,me,keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD'));
  }
  hit=Math.max(0,hit-dt*5);damage=Math.max(0,damage-dt*.55);$('hitmarker').style.opacity=hit;$('damage-overlay').style.opacity=damage;$('damage-direction').style.opacity=damage;
  if(now-lastAnnouncement>2500)$('announcement').classList.remove('visible');if(now>radioUntil)text('radio','');
  const me=state?.actors.find(a=>a.id===playerId);const camera=me?.alive?{yaw:inputYaw,pitch:inputPitch}:{spectate};
  view.render(active?state:null,playerId,Math.min(dt,.05),now/1000,camera);
  requestAnimationFrame(frame);
}
view.ready.then(()=>{
  lastTime=performance.now();show('boot',false);requestAnimationFrame(frame);
  if(debug){
    window.__BLA={get state(){return state;},get match(){return match;},get view(){return view;},get errors(){return errors;},get paused(){return paused;},config,settings,
      start:startOffline,input(i){if(match)match.setInput(playerId,i);},step(seconds){if(!match)return;for(let i=0;i<seconds*60;i++)match.step(1/60);state=match.snapshot();},
      pause(){paused=true;},resume(){paused=false;},get playerId(){return playerId;}};
  }
}).catch(error=>{
  show('boot',false);show('fatal',true);text('fatal',`士兵模型加载失败，请刷新页面重试。\n请确认通过项目服务器访问，并包含 public/models/soldier.glb。\n\n${error.message}`);
});
