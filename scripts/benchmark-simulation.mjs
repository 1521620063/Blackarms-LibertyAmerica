import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Match } from '../frontend/src/game/match.js';
import { SIMULATION_STEP } from '../frontend/src/game/movement.js';
import { walkable, wallHit } from '../frontend/src/game/geometry.js';

const rooms=12,ticks=1800;
function simulate(){
  const matches=Array.from({length:rooms},(_,i)=>new Match({mode:i%2?'core':'elimination',teamSize:3,difficulty:'hard',seed:4207+i}));
  const started=performance.now();
  for(let tick=0;tick<ticks;tick++)for(const match of matches){
    if(match.phase==='roundResult'||match.phase==='matchResult')match.resetRound();
    if(match.phase==='preparation')match.startCombat();
    match.step(SIMULATION_STEP);
  }
  const milliseconds=performance.now()-started;
  return {milliseconds,checksum:matches.map(m=>({scores:m.scores,actors:m.actors.map(a=>[a.id,...[a.x,a.z,a.hp].map(n=>+n.toFixed(6)),a.kills])}))};
}
function geometry(){
  let checksum=0;const started=performance.now();
  for(let i=0;i<200000;i++){
    const x=(i%251)/250*48-24,z=(i%193)/192*36-18,angle=i*.37;
    checksum+=+walkable(x,z);
    const hit=wallHit({x,y:1.42,z},{x:Math.sin(angle),y:-.025,z:Math.cos(angle)});
    if(Number.isFinite(hit))checksum+=hit;
  }
  return {milliseconds:performance.now()-started,checksum};
}
simulate();geometry();
const simulations=Array.from({length:3},simulate),geometries=Array.from({length:3},geometry);
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const report={node:process.version,rooms,ticksPerRoom:ticks,botsPerRoom:5,
  simulationMs:median(simulations.map(r=>r.milliseconds)),simulationSamplesMs:simulations.map(r=>r.milliseconds),
  geometryMs:median(geometries.map(r=>r.milliseconds)),geometrySamplesMs:geometries.map(r=>r.milliseconds),
  checksum:simulations[0].checksum,geometryChecksum:geometries[0].checksum};
const output=process.argv[2];if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));}
console.log(JSON.stringify({...report,checksum:undefined},null,2));
