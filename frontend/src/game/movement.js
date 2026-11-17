import { ARMOR, WEAPONS } from './data.js';
import { move } from './geometry.js';

export const SIMULATION_STEP=1/60;

// Both authoritative simulation and local prediction use the same collision rules.
export function moveActor(actor,input,dt) {
  actor.yaw=input.yaw;actor.pitch=input.pitch;actor.aim=input.aim;actor.crouch=input.crouch;
  actor.sprinting=input.sprint&&!input.aim&&!input.fire&&!input.crouch&&input.forward>0;
  if(input.jump&&!actor.jumpHeld&&actor.y===0&&!actor.crouch)actor.vy=4.5;
  actor.jumpHeld=!!input.jump;
  actor.vy-=12*dt;actor.y=Math.max(0,actor.y+actor.vy*dt);if(actor.y===0)actor.vy=0;
  let dx=-Math.sin(actor.yaw)*input.forward+Math.cos(actor.yaw)*input.strafe;
  let dz=-Math.cos(actor.yaw)*input.forward-Math.sin(actor.yaw)*input.strafe;
  const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}
  const speed=3.5*ARMOR[actor.armor].speed*(WEAPONS[actor.weapon].move??1)*(actor.sprinting?1.5:actor.crouch?.5:actor.aim?.72:1);
  move(actor,dx*dt*speed,dz*dt*speed);
}

// A delayed timer must advance all elapsed simulation steps, within a bounded budget.
export class FixedClock {
  constructor(now=performance.now()){this.last=now;this.accumulator=0;}
  advance(now,step){
    this.accumulator+=Math.max(0,Math.min((now-this.last)/1000,.25));this.last=now;
    let count=0;
    while(this.accumulator+1e-9>=SIMULATION_STEP){step();this.accumulator-=SIMULATION_STEP;count++;}
    return count;
  }
}
