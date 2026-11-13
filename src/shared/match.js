import { RULES, OBJECTIVE, WEAPONS, PRIMARY_WEAPONS, ARMOR, DIFFICULTY, SPAWNS, ORDERS, BOXES, clamp, distance, direction, rng } from './data.js';
import { move, walkable, findPath, visible, wallHit, raySphere } from './geometry.js';

const ACTIVE = new Set(['preparation','combat']);
const UPLOADING = new Set(['uploading','defusing']);
const emptyInput = () => ({ forward:0, strafe:0, yaw:0, pitch:0, fire:false, aim:false, interact:false, sprint:false, crouch:false });
const finite = (v,min,max) => Number.isFinite(v) ? clamp(v,min,max) : 0;
export function sanitizeInput(value={}) {
  return { forward:finite(value.forward,-1,1), strafe:finite(value.strafe,-1,1), yaw:finite(value.yaw,-1e5,1e5), pitch:finite(value.pitch,-1.4,1.4),
    fire:!!value.fire, aim:!!value.aim, interact:!!value.interact, sprint:!!value.sprint, crouch:!!value.crouch,
    jump:!!value.jump, reload:!!value.reload, weapon:Object.hasOwn(WEAPONS,value.weapon)?value.weapon:null,
    order:Object.hasOwn(ORDERS,value.order)?value.order:null, drop:!!value.drop, ready:!!value.ready };
}
export class Match {
  constructor(config={}, humans=[{id:'player',squad:0,name:'先锋 / YOU'}]) {
    this.config={mode:config.mode==='core'?'core':'elimination', teamSize:[1,2,3].includes(+config.teamSize)?+config.teamSize:3,
      difficulty:Object.hasOwn(DIFFICULTY,config.difficulty)?config.difficulty:'normal', primary:PRIMARY_WEAPONS.includes(config.primary)?config.primary:'rifle', armor:config.armor==='heavy'?'heavy':'light'};
    this.rules={...RULES[this.config.teamSize]}; this.random=rng(config.seed??4207);
    this.time=0; this.round=1; this.scores=[0,0]; this.attackSquad=0; this.actors=[];
    this.events=[]; this.eventId=0; this.history=[]; this.orders=[null,null]; this.phase='preparation'; this.result=null;
    for(let squad=0;squad<2;squad++) for(let slot=0;slot<this.config.teamSize;slot++) {
      const h=humans.filter(p=>p.squad===squad)[slot];
      const id=h?.id||`bot-${squad}-${slot}`;
      this.actors.push({id,squad,slot,name:h?.name||`${squad===0?'ALPHA':'BRAVO'} ${['先锋','支援','哨兵'][slot]}`, bot:!h,
        armor:h?.armor||this.config.armor, primary:PRIMARY_WEAPONS.includes(h?.primary)?h.primary:this.config.primary,
        kills:0,deaths:0,damage:0,contribution:0,headshots:0, input:emptyInput(),lastInput:{},ready:false});
    }
    this.resetRound();
  }
  emit(type,data={}) {
    this.events.push({id:++this.eventId,type,time:this.time,...data});
    if(this.events.length>128) this.events.shift();
  }
  side(actor) { return actor.squad===this.attackSquad?'attack':'defense'; }
  living(squad) { return this.actors.filter(a=>a.squad===squad&&a.alive); }
  resetRound() {
    this.phase='preparation'; this.remaining=this.rules.prepare; this.elapsed=0; this.overtime=false; this.result=null; this.orders=[null,null];
    for(const a of this.actors) {
      const p=SPAWNS[this.side(a)][a.slot];
      Object.assign(a,{...p,y:0,vy:0,yaw:this.side(a)==='attack'?-Math.PI/2:Math.PI/2,pitch:0,hp:100,alive:true,
        weapon:a.primary,ammo:Object.fromEntries(Object.entries(WEAPONS).map(([k,w])=>[k,{mag:w.mag,reserve:w.reserve}])),
        reload:0,switchTime:0,cooldown:0,shotHeat:0,interact:0,ready:a.bot,heard:null,target:null,memory:null,reaction:0,path:[],pathTimer:0,routeStage:0,cover:null,coverCheck:0,stuck:0,lastPos:{...p},
        input:emptyInput(),lastInput:{},crouch:false,aim:false,sprinting:false,interactionOrigin:null});
    }
    const carrier=this.actors.find(a=>a.squad===this.attackSquad);
    this.core={state:this.config.mode==='core'?'carried':'none',carrier:this.config.mode==='core'?carrier.id:null,x:carrier.x,z:carrier.z,progress:0,upload:OBJECTIVE.upload,interactor:null};
    this.emit('round',{round:this.round,attackSquad:this.attackSquad});
  }
  setInput(id,input) { const a=this.actors.find(a=>a.id===id); if(a&&!a.bot) a.input=sanitizeInput(input); }
  startCombat() {
    if(this.phase!=='preparation') return;
    this.phase='combat'; this.remaining=this.rules.combat; this.elapsed=0; this.emit('combat');
  }
  setLoadout(id,primary,armor) {
    const a=this.actors.find(a=>a.id===id);
    if(!a||this.phase!=='preparation') return false;
    if(PRIMARY_WEAPONS.includes(primary)) {a.primary=primary; a.weapon=primary; a.reload=0; a.switchTime=0;}
    if(Object.hasOwn(ARMOR,armor)) a.armor=armor;
    return true;
  }
  step(dt) {
    if(!Number.isFinite(dt)||dt<=0) return;
    dt=Math.min(dt,.05); this.time+=dt;
    if(this.phase==='matchResult') return;
    if(this.phase==='roundResult') {
      this.remaining-=dt;
      if(this.remaining<=0) {
        if(this.round%this.rules.switchAfter===0) {this.attackSquad=1-this.attackSquad; this.emit('sides');}
        this.round++; this.resetRound();
      }
      return;
    }
    this.elapsed+=dt; this.remaining=Math.max(0,this.remaining-dt);
    if(this.phase==='preparation') {
      for(const a of this.actors) {
        if(a.input.ready) a.ready=true;
        a.lastInput={...a.input};
      }
      if(this.remaining<=0||this.actors.every(a=>a.ready)) this.startCombat();
      return;
    }
    for(const a of this.actors) {
      if(!a.alive) continue;
      a.switchTime=Math.max(0,a.switchTime-dt);
      a.cooldown=Math.max(0,a.cooldown-dt); a.shotHeat=Math.max(0,a.shotHeat-dt*1.8);
      if(a.reload>0) {
        a.reload=Math.max(0,a.reload-dt);
        if(a.reload===0) {const w=WEAPONS[a.weapon],am=a.ammo[a.weapon],n=Math.min(w.mag-am.mag,am.reserve); am.mag+=n; am.reserve-=n; this.emit('reloaded',{actor:a.id});}
      }
      if(a.bot) this.think(a,dt);
      this.updateActor(a,dt);
    }
    // Resolve actors apart without pushing anyone through world geometry.
    for(let i=0;i<this.actors.length;i++) for(let j=i+1;j<this.actors.length;j++) {
      const a=this.actors[i],b=this.actors[j]; if(!a.alive||!b.alive) continue;
      const d=distance(a,b); if(d>.001&&d<.58) {const p=(.58-d)/2; move(a,(a.x-b.x)/d*p,(a.z-b.z)/d*p); move(b,(b.x-a.x)/d*p,(b.z-a.z)/d*p);}
    }
    if(this.config.mode==='core') this.updateObjective(dt);
    if(this.phase!=='combat') return;
    this.evaluateElimination();
    if(this.phase!=='combat') return;
    if(this.remaining<=0&&!UPLOADING.has(this.core.state)) this.timeout();
    if(this.elapsed>this.rules.combat+OBJECTIVE.upload+30) this.endRound(null,'安全时限已到，回合平局');
  }
  updateActor(a,dt) {
    const i=a.input,last=a.lastInput;
    a.yaw=i.yaw; a.pitch=i.pitch; a.aim=i.aim; a.crouch=i.crouch;
    a.sprinting=i.sprint&&!i.aim&&!i.fire&&!i.crouch&&i.forward>0;
    if(i.weapon&&i.weapon!==a.weapon) {
      a.weapon=i.weapon;a.reload=0;a.switchTime=WEAPONS[a.weapon].equip??.32;
      this.emit('switch',{actor:a.id,weapon:a.weapon,duration:a.switchTime});
    }
    if(i.reload&&!last.reload) this.reloadWeapon(a);
    if(i.drop&&!last.drop) this.dropCore(a);
    if(i.order&&i.order!==last.order) this.order(a,i.order);
    if(i.jump&&!last.jump&&a.y===0&&!a.crouch) a.vy=4.5;
    a.vy-=12*dt; a.y=Math.max(0,a.y+a.vy*dt); if(a.y===0) a.vy=0;
    let dx=-Math.sin(a.yaw)*i.forward+Math.cos(a.yaw)*i.strafe;
    let dz=-Math.cos(a.yaw)*i.forward-Math.sin(a.yaw)*i.strafe;
    const len=Math.hypot(dx,dz); if(len>1) {dx/=len;dz/=len;}
    const speed=3.5*ARMOR[a.armor].speed*(WEAPONS[a.weapon].move??1)*(a.sprinting?1.5:a.crouch?.5:a.aim?.72:1);
    move(a,dx*dt*speed,dz*dt*speed);
    if(i.fire&&!i.interact&&!a.sprinting&&(a.bot||!WEAPONS[a.weapon].semi||!last.fire)) this.shoot(a);
    if(i.interact&&!i.fire&&!a.sprinting) this.interact(a,dt);
    else if(this.core.interactor===a.id) this.cancelInteraction();
    a.lastInput={...i};
  }
  reloadWeapon(a) {
    const w=WEAPONS[a.weapon],am=a.ammo[a.weapon];
    if(a.reload>0||a.switchTime>0||am.mag===w.mag||am.reserve<=0) return false;
    a.reload=w.reload; this.emit('reload',{actor:a.id,weapon:a.weapon,duration:w.reload}); return true;
  }
  shoot(a) {
    if(this.phase!=='combat'||!a.alive||a.reload>0||a.switchTime>0||a.cooldown>0) return false;
    const w=WEAPONS[a.weapon],am=a.ammo[a.weapon];
    if(am.mag<=0) {if(!this.reloadWeapon(a)&&a.weapon!=='pistol') a.input.weapon='pistol'; return false;}
    am.mag--; a.cooldown=60/w.rpm*(a.bot?1.25:1); a.shotHeat=Math.min(1,a.shotHeat+.22);
    const origin={x:a.x,y:(a.crouch?1.07:1.57)+a.y,z:a.z};
    const accuracy=a.weapon==='sniper'?(a.aim?.025:1):(a.aim?.32:1);
    const spread=w.spread*accuracy*(1+a.shotHeat*(a.weapon==='lmg'?2:.7))+(a.bot?DIFFICULTY[this.config.difficulty].error:0);
    const traces=[];
    for(let pellet=0;pellet<w.pellets;pellet++) {
      const dir=direction(a.yaw+(this.random()-.5)*spread*2,a.pitch+(this.random()-.5)*spread*2);
      let nearest=Math.min(w.range,wallHit(origin,dir)),target=null,part='body';
      for(const other of this.actors) {
        if(!other.alive||other.id===a.id) continue;
        const crouch=other.crouch?.72:1;
        for(const [region,h,r] of [['limb',.48,.3],['body',1.09,.39],['weakpoint',1.66,.235]]) {
          const t=raySphere(origin,dir,{x:other.x,y:h*crouch+other.y,z:other.z},r);
          if(t<nearest) {nearest=t;target=other;part=region;}
        }
      }
      const end={x:origin.x+dir.x*nearest,y:origin.y+dir.y*nearest,z:origin.z+dir.z*nearest};
      // Teammates block shots. Friendly damage is disabled for the browser MVP.
      if(target&&target.squad!==a.squad) {
        const multiplier=part==='weakpoint'?2:part==='limb'?.75:1;
        const falloff=1-w.falloff*clamp(nearest/w.range,0,1);
        this.damage(target,w.damage*multiplier*falloff*(1-ARMOR[target.armor].protection),a,part);
      }
      traces.push({end,hit:!!target,enemy:target?.squad!==a.squad&&!!target,part});
    }
    this.emit('shot',{actor:a.id,weapon:a.weapon,origin,traces});
    for(const enemy of this.actors) if(enemy.alive&&enemy.squad!==a.squad&&distance(a,enemy)<DIFFICULTY[this.config.difficulty].hearing) enemy.heard={x:a.x,z:a.z,until:this.time+6};
    return true;
  }
  damage(target,amount,source,part='body') {
    if(!target.alive||this.phase!=='combat'||!Number.isFinite(amount)||amount<=0) return false;
    const dealt=Math.min(target.hp,amount); target.hp-=dealt;
    if(source) {
      source.damage+=dealt; target.heard={x:source.x,z:source.z,until:this.time+7};
      for(const ally of this.actors)if(ally.bot&&ally.alive&&ally.squad===target.squad&&distance(ally,target)<12)ally.heard={...target.heard};
    }
    if(this.core.interactor===target.id) this.cancelInteraction();
    this.emit('damage',{actor:target.id,source:source?.id,amount:dealt,part});
    if(target.hp<=0) {
      target.hp=0; target.alive=false; target.deaths++; target.reload=0;
      this.dropCore(target);
      if(source&&source.squad!==target.squad) {source.kills++; if(part==='weakpoint') source.headshots++;}
      this.emit('kill',{actor:target.id,source:source?.id,part});
    }
    return true;
  }
  dropCore(a) {
    if(this.core.carrier!==a.id) return false;
    this.cancelInteraction(); Object.assign(this.core,{state:'dropped',carrier:null,x:a.x,z:a.z,progress:0});
    this.emit('core',{state:'dropped',actor:a.id}); return true;
  }
  cancelInteraction() {
    const c=this.core;
    if(c.state==='planting') c.state='carried';
    if(c.state==='defusing') c.state='uploading';
    c.interactor=null;c.progress=0;c.origin=null;
  }
  interact(a,dt) {
    if(this.config.mode!=='core'||!a.alive) return;
    const c=this.core,attack=this.side(a)==='attack';
    if(c.interactor&&c.interactor!==a.id) return;
    if(['available','dropped'].includes(c.state)&&distance(a,c)<1.5) {
      if(attack) {c.carrier=a.id;c.state='carried';a.contribution+=10;this.emit('core',{state:'carried',actor:a.id});}
      else {
        c.progress+=dt; c.interactor=a.id;
        if(c.progress>=1.5) {const home=SPAWNS.attack[0];Object.assign(c,{...home,state:'available',carrier:null,progress:0,interactor:null});a.contribution+=15;this.emit('core',{state:'reset',actor:a.id});}
      }
      return;
    }
    const planting=attack&&c.carrier===a.id&&['carried','planting'].includes(c.state)&&distance(a,OBJECTIVE)<OBJECTIVE.radius;
    const defusing=!attack&&UPLOADING.has(c.state)&&distance(a,c)<OBJECTIVE.radius;
    if(!planting&&!defusing) {if(c.interactor===a.id) this.cancelInteraction();return;}
    if(!c.interactor) {c.interactor=a.id;c.origin={x:a.x,z:a.z};c.progress=0; c.state=planting?'planting':'defusing'; this.emit('interact',{actor:a.id,state:c.state});}
    if(distance(a,c.origin)>.28||a.y>.05) {this.cancelInteraction();return;}
    c.progress+=dt;
    if(c.progress>=(planting?OBJECTIVE.plant:OBJECTIVE.defuse)) {
      if(planting) {
        Object.assign(c,{state:'uploading',x:OBJECTIVE.x,z:OBJECTIVE.z,carrier:null,progress:0,interactor:null,upload:OBJECTIVE.upload});
        a.contribution+=100; this.emit('core',{state:'uploading',actor:a.id});
      } else {c.state='defused';c.interactor=null;c.progress=0;a.contribution+=150;this.emit('core',{state:'defused',actor:a.id});this.endRound(a.squad,'数据核心已拆除');}
    }
  }
  updateObjective(dt) {
    const c=this.core;
    if(c.carrier) {const a=this.actors.find(a=>a.id===c.carrier);if(a?.alive){c.x=a.x;c.z=a.z;}else if(a)this.dropCore(a);}
    if(c.interactor) {
      const a=this.actors.find(a=>a.id===c.interactor);
      if(!a?.alive||!a.input.interact) this.cancelInteraction();
    }
    if(['available','dropped'].includes(c.state)&&!walkable(c.x,c.z,.1)) {Object.assign(c,SPAWNS.attack[0],{state:'available',carrier:null,progress:0,interactor:null});this.emit('core',{state:'reset'});}
    if(UPLOADING.has(c.state)) {
      c.upload=Math.max(0,c.upload-dt);
      if(c.upload===0) {c.state='completed';this.emit('core',{state:'completed'});this.endRound(this.attackSquad,'数据上传完成');}
    }
  }
  order(a,type) {
    this.orders[a.squad]={type,x:a.x,z:a.z,until:this.time+25};
    this.emit('order',{actor:a.id,squad:a.squad,order:type});
    for(const b of this.actors) if(b.squad===a.squad&&b.bot) {b.pathTimer=0;b.routeStage=2;}
  }
  findCover(a,enemy) {
    const candidates=[];
    for(const b of BOXES) {
      if(b.h<.8||b.h>3.5||distance(a,b)>7)continue;
      const dx=b.x-enemy.x,dz=b.z-enemy.z,len=Math.hypot(dx,dz)||1;
      const p={x:b.x+dx/len*(b.w/2+.65),z:b.z+dz/len*(b.d/2+.65),crouch:b.h<1.5};
      if(walkable(p.x,p.z,.36)&&!visible(enemy,p))candidates.push(p);
    }
    candidates.sort((b,c)=>distance(a,b)-distance(a,c));return candidates[0]||null;
  }
  think(a,dt) {
    const d=DIFFICULTY[this.config.difficulty], input=emptyInput();
    input.yaw=a.yaw;input.pitch=a.pitch;
    const enemies=this.actors.filter(b=>b.alive&&b.squad!==a.squad);
    const seen=enemies.filter(b=> {
      if(distance(a,b)>28||!visible(a,b)) return false;
      const angle=Math.atan2(-(b.x-a.x),-(b.z-a.z));
      return Math.cos(angle-a.yaw)>-.15||distance(a,b)<3||a.heard?.until>this.time;
    }).sort((b,c)=>distance(a,b)-distance(a,c));
    const target=seen[0];
    if(target) {
      if(a.target!==target.id) {a.target=target.id;a.reaction=d.reaction+d.delay;}
      a.reaction-=dt;a.memory={x:target.x,z:target.z,until:this.time+7};
      const tx=target.x-a.x,tz=target.z-a.z;
      input.yaw=Math.atan2(-tx,-tz);input.pitch=Math.atan2((target.crouch?.95:1.3)+target.y-(a.crouch?1.07:1.57)-a.y,Math.hypot(tx,tz));
      input.fire=a.reaction<=0;input.aim=true;
      if(distance(a,target)<3) input.forward=-.45;
      else if(distance(a,target)>12) input.forward=.35;
      input.strafe=Math.sin(this.time*1.5+a.slot*2)>.45?.4:0;
      a.path=[];
    } else {a.target=null;a.reaction=d.reaction;}
    a.coverCheck-=dt;
    if(target&&a.coverCheck<=0){
      a.coverCheck=2+this.random()*2;
      if(a.hp<45||a.ammo[a.weapon].mag<5){a.cover=this.findCover(a,target);if(a.cover){a.cover.until=this.time+4;this.emit('cover',{actor:a.id});}}
    }
    if(a.cover&&a.cover.until>this.time){
      const goal=a.cover;
      if(distance(a,goal)<.45){input.crouch=goal.crouch;input.forward=0;input.strafe=0;if(!target)input.reload=true;}
      else {
        a.pathTimer-=dt;
        if(a.pathTimer<=0||!a.path.length){a.path=findPath(a,goal);a.pathTimer=.7;}
        while(a.path.length&&distance(a,a.path[0])<.2)a.path.shift();
        const next=a.path[0];if(next){const len=distance(a,next)||1,dx=(next.x-a.x)/len,dz=(next.z-a.z)/len;input.forward=-dx*Math.sin(input.yaw)-dz*Math.cos(input.yaw);input.strafe=dx*Math.cos(input.yaw)-dz*Math.sin(input.yaw);}
      }
      if(!a.ammo[a.weapon].mag)input.reload=true;
      a.input=input;return;
    }
    const c=this.core,attacking=this.side(a)==='attack';
    let goal=null,urgent=false;
    if(this.config.mode==='core') {
      if(attacking&&c.carrier===a.id) {goal=OBJECTIVE;urgent=true;if(distance(a,OBJECTIVE)<1.5&&!target){input.interact=true;}}
      else if(attacking&&['available','dropped'].includes(c.state)) {goal=c;urgent=true;if(distance(a,c)<1.4) input.interact=true;}
      else if(!attacking&&UPLOADING.has(c.state)) {goal=c;urgent=true;if(distance(a,c)<1.6&&!target) input.interact=true;}
      else if(UPLOADING.has(c.state)) goal={x:7.8,z:(a.slot%2?1:-1)*2.5};
    }
    const order=this.orders[a.squad];
    if(!urgent&&order&&order.until>this.time) {
      const leader=this.actors.find(b=>b.squad===a.squad&&!b.bot&&b.alive);
      goal=order.type==='follow'&&leader?{x:leader.x+Math.cos(a.slot*3)*1.5,z:leader.z+Math.sin(a.slot*3)*1.5}:
        order.type==='retreat'?SPAWNS[this.side(a)][a.slot]:order.type==='attack'?OBJECTIVE:order;
    }
    if(!goal) {
      const lane=[12,0,-12][a.slot];
      if(a.routeStage===0) {goal=attacking?{x:-18,z:lane===0?5:lane}:{x:18,z:lane===0?-5:lane};if(distance(a,goal)<.8||this.elapsed>13)a.routeStage=1;}
      else if(a.routeStage===1) {goal=attacking?{x:-5,z:lane===0?0:lane>0?16:12*-1}:{x:7.5,z:lane===0?2:lane>0?11.5:-16.5};if(distance(a,goal)<1||this.elapsed>28)a.routeStage=2;}
      else if(a.memory?.until>this.time) goal=a.memory;
      else if(a.heard?.until>this.time) goal=a.heard;
      else {
        const points=attacking?[{x:6,z:-2},{x:12,z:4},{x:18,z:-5},{x:12,z:-12},{x:6,z:12},{x:0,z:6}]:[{x:-5,z:-6},{x:-12,z:4},{x:-18,z:5},{x:-12,z:-12},{x:-5,z:16},{x:0,z:0}];
        a.patrol??=a.slot;goal=points[a.patrol%points.length];if(distance(a,goal)<1)a.patrol++;
      }
    }
    if(input.interact) {input.fire=false;input.forward=0;input.strafe=0;input.pitch=0;}
    else if(!target&&goal) {
      a.pathTimer-=dt;
      if(a.pathTimer<=0||!a.path.length||!a.goal||distance(a.goal,goal)>1.5) {a.path=findPath(a,goal);a.goal={x:goal.x,z:goal.z};a.pathTimer=.9+this.random()*.4;}
      while(a.path.length&&distance(a,a.path[0])<.18) a.path.shift();
      const next=a.path[0];
      if(next&&distance(a,goal)>.35) {input.yaw=Math.atan2(-(next.x-a.x),-(next.z-a.z));input.pitch=0;input.forward=1;}
      if(distance(a,a.lastPos)<.02&&input.forward) a.stuck+=dt; else a.stuck=0;
      if(a.stuck>1.2) {a.pathTimer=0; input.strafe=a.slot%2?1:-1;a.stuck=0;}
      a.lastPos={x:a.x,z:a.z};
    }
    const am=a.ammo[a.weapon];
    if(am.mag===0||(am.mag<5&&!target)) input.reload=true;
    if(!am.mag&&!am.reserve) input.weapon='pistol';
    a.input={...input};
  }
  evaluateElimination() {
    const alive=[this.living(0).length,this.living(1).length];
    if(!alive[0]&&!alive[1]) {if(!UPLOADING.has(this.core.state))this.endRound(null,'双方同时阵亡');return;}
    for(let squad=0;squad<2;squad++) if(!alive[squad]) {
      if(this.config.mode==='core'&&squad===this.attackSquad&&UPLOADING.has(this.core.state)) continue;
      this.endRound(1-squad,'敌方队伍已被歼灭');return;
    }
  }
  timeout() {
    if(this.config.mode==='core') {this.endRound(1-this.attackSquad,'时间耗尽，核心未完成上传');return;}
    const count=[this.living(0).length,this.living(1).length];
    if(count[0]!==count[1]) {this.endRound(count[0]>count[1]?0:1,'时间耗尽，比较存活人数');return;}
    const hp=[0,1].map(s=>this.living(s).reduce((sum,a)=>sum+a.hp,0));
    if(Math.abs(hp[0]-hp[1])>.01) {this.endRound(hp[0]>hp[1]?0:1,'时间耗尽，比较剩余生命');return;}
    if(!this.overtime) {this.overtime=true;this.remaining=15;this.emit('overtime');}
    else this.endRound(null,'加时结束，回合平局');
  }
  endRound(winner,reason) {
    if(!ACTIVE.has(this.phase)) return false;
    if(winner!==null) this.scores[winner]++;
    this.result={winner,reason,round:this.round};this.history.push({...this.result});
    this.phase=this.scores.some(n=>n>=this.rules.wins)?'matchResult':'roundResult'; this.remaining=this.phase==='roundResult'?6:0;
    this.cancelInteraction();this.emit('result',{...this.result,phase:this.phase});return true;
  }
  snapshot() {
    return {config:this.config,time:this.time,round:this.round,scores:this.scores,attackSquad:this.attackSquad,phase:this.phase,remaining:this.remaining,elapsed:this.elapsed,
      overtime:this.overtime,result:this.result,core:this.core,rules:this.rules,orders:this.orders,history:this.history,
      actors:this.actors.map(({input,lastInput,path,goal,heard,memory,lastPos,...a})=>a),events:this.events};
  }
}
