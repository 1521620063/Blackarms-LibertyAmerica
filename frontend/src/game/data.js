// Data ported from main's FBLAMatchRules and build_task11_assets.py. Units: metres.
// Shared dimensions drive collision, navigation, rendering and the tactical map.
export const MAP = { width:80, depth:56, halfWidth:40, halfDepth:28, ceiling:5.6 };
export const RULES = {
  1: { teamSize: 1, prepare: 15, combat: 80, wins: 3, switchAfter: 2 },
  2: { teamSize: 2, prepare: 15, combat: 95, wins: 4, switchAfter: 3 },
  3: { teamSize: 3, prepare: 15, combat: 110, wins: 5, switchAfter: 4 },
  4: { teamSize: 4, prepare: 15, combat: 125, wins: 6, switchAfter: 5 },
  5: { teamSize: 5, prepare: 15, combat: 140, wins: 7, switchAfter: 6 },
};
export const OBJECTIVE = { plant: 5, defuse: 5, upload: 30, radius: 2.1, x: 6, z: 0 };
export const WEAPONS = {
  pistol: { name: 'EP–12 能量手枪', short: 'EP–12', mag: 12, reserve: 48, damage: 24, rpm: 300, reload: 1.5, spread: .008, range: 70, pellets: 1, falloff: .5 },
  rifle: { name: 'PR–24 游隼战术步枪', short: 'PR–24', mag: 24, reserve: 120, damage: 23, rpm: 600, reload: 2.1, spread: .012, range: 100, pellets: 1, falloff: .45 },
  scatter: { name: 'SG–6 破门者霰弹枪', short: 'SG–6', mag: 6, reserve: 30, damage: 13, rpm: 90, reload: 2.6, spread: .075, range: 28, pellets: 8, falloff: .85 },
  smg: { name: 'VX–9 雨燕冲锋枪', short: 'VX–9', mag: 32, reserve: 160, damage: 17, rpm: 850, reload: 1.8, spread: .018, range: 55, pellets: 1, falloff: .72, equip: .25, move: 1.08, kick: .038 },
  dmr: { name: 'MR–18 隼眼射手步枪', short: 'MR–18', mag: 10, reserve: 50, damage: 52, rpm: 240, reload: 2.4, spread: .006, range: 130, pellets: 1, falloff: .28, equip: .45, move: .93, zoom: 2.25, semi: true, kick: .09 },
  lmg: { name: 'LM–60 铁幕轻机枪', short: 'LM–60', mag: 60, reserve: 180, damage: 25, rpm: 540, reload: 4.2, spread: .022, range: 100, pellets: 1, falloff: .45, equip: .6, move: .82, kick: .075 },
  sniper: { name: 'SR–7 寒鸦狙击枪', short: 'SR–7', mag: 5, reserve: 25, damage: 115, rpm: 42, reload: 3.1, spread: .055, range: 180, pellets: 1, falloff: .18, equip: .65, move: .88, zoom: 5, semi: true, kick: .19 },
};
// Stable slots are shared by keyboard, wheel, HUD and equipment menus.
export const WEAPON_ORDER = ['rifle','pistol','scatter','smg','dmr','lmg','sniper'];
export const PRIMARY_WEAPONS = WEAPON_ORDER.filter(type=>type!=='pistol');
export const ARMOR = { light: { name: '轻型护甲', protection: .15, speed: 1 }, heavy: { name: '重型护甲', protection: .32, speed: .83 } };
export const DIFFICULTY = {
  easy: { name: '简单', reaction: .65, error: .11, delay: .28, hearing: 11 },
  normal: { name: '普通', reaction: .35, error: .065, delay: .18, hearing: 14 },
  hard: { name: '困难', reaction: .2, error: .035, delay: .11, hearing: 19 },
};
export const ORDERS = { follow: '跟随我', hold: '守住这里', attack: '攻击目标', retreat: '撤退' };
export const PHASES = { preparation: '准备阶段', combat: '战斗阶段', roundResult: '回合结算', matchResult: '比赛结束' };
export const CORE_LABELS = { available: '待拾取', carried: '携带中', dropped: '已掉落', planting: '安装中', uploading: '上传中', defusing: '拆除中', defused: '已拆除', completed: '上传完成' };
export const SPAWNS = {
  attack: [{ x: -36, z: 20 }, { x: -36, z: 0 }, { x: -36, z: -20 }, { x: -38, z: 20 }, { x: -38, z: -20 }],
  defense: [{ x: 36, z: -20 }, { x: 36, z: 0 }, { x: 36, z: 20 }, { x: 38, z: -20 }, { x: 38, z: 20 }],
};
// Each squad fans out through the annexes before converging on the facility.
// These waypoints also serve as explicit navigation destinations in validation.
export const BOT_ROUTES = {
  attack: {
    approach: [
      [{x:-30,z:20},{x:-16,z:25}],
      [{x:-30,z:0},{x:-18,z:5}],
      [{x:-30,z:-20},{x:-16,z:-25}],
      [{x:-30,z:20},{x:-16,z:25}],
      [{x:-30,z:-20},{x:-16,z:-25}],
    ],
    patrol: [{x:6,z:-2},{x:12,z:4},{x:18,z:-5},{x:16,z:-21},{x:0,z:-25},{x:-16,z:-25},
      {x:-30,z:0},{x:-16,z:25},{x:0,z:25},{x:16,z:25},{x:30,z:0},{x:6,z:12}],
  },
  defense: {
    approach: [
      [{x:30,z:-20},{x:16,z:-21}],
      [{x:30,z:0},{x:18,z:-5}],
      [{x:30,z:20},{x:16,z:25}],
      [{x:30,z:-20},{x:16,z:-21}],
      [{x:30,z:20},{x:16,z:25}],
    ],
    patrol: [{x:-5,z:-6},{x:-12,z:4},{x:-18,z:5},{x:-16,z:25},{x:0,z:25},{x:16,z:25},
      {x:30,z:0},{x:16,z:-21},{x:0,z:-25},{x:-16,z:-25},{x:-30,z:0},{x:0,z:0}],
  },
};
// Three.js Y is up; UE's ground Y maps to -Z.
const blocks = [
  ['北侧外墙', 0, -MAP.halfDepth, MAP.width, .4, 4], ['南侧外墙', 0, MAP.halfDepth, MAP.width, .4, 4],
  ['攻击方外墙', -MAP.halfWidth, 0, .4, MAP.depth, 4], ['防守方外墙', MAP.halfWidth, 0, .4, MAP.depth, 4],
  // The old perimeter becomes an inner facade: four doors per long side,
  // three per end. The outer ring can also be crossed without entering it.
  ...[-18,18].flatMap(z=>[[-25,6],[-13,10],[0,8],[13,10],[25,6]].map(([x,w])=>['内环长墙',x,z,w,.4,4])),
  ...[-28,28].flatMap(x=>[[-16,4],[-6.5,7],[6.5,7],[16,4]].map(([z,d])=>['内环门厅墙',x,z,.4,d,4])),
  // North annex: connected freight, pump and power rooms, with offset doors
  // in each partition and a clear cross-passage along the northern wall.
  ...[-24,-8,8,24].flatMap((x,i)=>(i%2?[[-19.1,2.2],[-24.3,3.4]]:[[-21,6],[-26.8,2.4]])
    .map(([z,d])=>['北翼动力间隔墙',x,z,.4,d,4])),
  ['货运箱组五',-17,-21.5,5,2,2.5],['货运箱组六',17,-24.2,5,2,2.5],
  ['北翼泵站机柜',-30,-23,2,2,2.5],['北翼电力机柜',-2,-23,2.4,1.4,2.6],
  ['北翼电力机柜东',3,-21.2,1.4,1.6,2.6],['北翼北低箱',0,-26,2,1,.95],
  ['北翼维修台',30,-22,3,1.2,1.1],['货运装卸低箱',-12,-25,2,1.2,1.1],
  // South annex: labs and offices have two doors each and a longitudinal
  // corridor. Solid benches and racks break up the room sightlines.
  ...[-24,-8,8,24].flatMap((x,i)=>(i%2?[ [19.1,2.2],[24.3,3.4] ]:[ [21,6],[26.8,2.4] ])
    .map(([z,d])=>['南翼实验间隔墙',x,z,.4,d,4])),
  ...[-16,0,16].flatMap(x=>[[-4.9,6.2],[4.9,6.2]].map(([dx,w])=>['南翼走廊半墙',x+dx,23,w,.4,2.7])),
  ['南翼实验操作台',-18,20.5,3,1.1,1.1],['南翼实验机柜',-12,26,2,1,2.4],
  ['南翼样本机柜',-3,20.3,1.6,1.3,2.3],['南翼研究操作台',3,25.8,3,1.1,1.1],
  ['南翼办公机柜',12,20.4,2,1,2.2],['南翼办公操作台',20,25.8,3,1.2,1.1],
  ['南翼医疗操作台',-30,22,3,1.2,1.1],['南翼通信机柜',30,24,2,1.4,2.5],
  // Outer end galleries: staggered blast walls shield the new spawns while
  // leaving a continuous circuit through both annexes and the inner facility.
  ...[-1,1].flatMap(s=>[
    ...[-20,0,20].map(z=>['外环集结防爆屏',s*33,z,.45,5,2.7]),
    ...[-10,10].map(z=>['外环门厅折墙',s*30.5,z,5,.4,4]),
    ['外环北设备柜',s*37,-9,1.5,1.5,2.4],['外环南补给箱',s*37,9,1.5,1.5,1.1],
    ['外环转角掩体',s*30,16,1.2,1.5,1.4],['外环北转角掩体',s*30,-16,1.2,1.5,1.4]
  ]),
  // Original facility is now a central building with several doors into both wings.
  ...[-10,10].flatMap(z=>[[-14.4,3.2],[-8.8,4],[-2,5.6],[5,3.6],[12.6,6.8]].map(([x,w])=>['中央建筑分隔墙',x,z,w,.4,4])),
  ...[-16,16].flatMap(x=>[[-8.5,3],[0,7],[8.5,3]].map(([z,d])=>['中央建筑门厅墙',x,z,.4,d,4])),
  // North: freight staging, two offset container rows and a service cross-passage.
  ['货运隔断西',-10,-14.8,.5,5.8,4],['货运隔断东',10,-13.1,.5,6.2,4],
  ['货运箱组一',-17,-14,3.8,1.8,2.5],['货运箱组二',-3.5,-14.7,4.8,1.8,2.5],
  ['货运箱组三',4.7,-12.8,3.2,1.6,2.5],['货运箱组四',17,-14.8,3.5,1.8,2.5],
  ['货运低箱',1.2,-16.4,2,.9,.9],['货运转角掩体',-13,-11.9,1.4,1,1.3],
  // South: utility rooms / archive, with alternating doorways rather than one long sightline.
  ['维修间西隔断',-9,13.5,.4,7,4],['档案间东隔断',9,15,.4,5.6,4],
  ['维修间操作台',-14,13.2,3,1.1,1.1],['冷却机组',-3,13.1,2,2,2.6],
  ['档案机柜北',3,12.5,2.8,1,2.3],['档案机柜南',1,15.6,3.4,1,2.3],
  ['档案防爆屏',5.9,14.7,.4,2.8,2.7],['东翼维修台',15,13.2,3,1.1,1.1],
  // End halls connect every lane. Blast screens shield the three spawn positions.
  ...[-1,1].flatMap(s=>[
    ['集结区北屏',s*21,-12,.45,3.4,2.7],['集结区中央屏',s*21,0,.45,4,2.7],['集结区南屏',s*21,12,.45,3.4,2.7],
    ['门厅北折墙',s*19,-7,3.8,.4,4],['门厅南折墙',s*19,7,3.8,.4,4],
    ['门厅设备柜',s*25,-5,1.5,1.2,2.2],['门厅补给箱',s*25,5,1.5,1.2,1.1],
    ['门厅内掩体',s*18.1,1.6,1.2,1.5,1.5]
  ]),
  ['中墙北', -2, -8.65, .4, 2.7, 4], ['中墙北段', -2, -3, .4, 3.4, 4],
  ['中墙南段', -2, 3, .4, 3.4, 4], ['中墙南', -2, 8.65, .4, 2.7, 4],
  ['左廊阻挡', -8, 7.9, .4, .9, 3], ['左廊折角', -4, 4.9, .4, .9, 3],
  ['中廊阻挡', -8, 0, .4, .9, 3], ['右廊阻挡', -8, -7.9, .4, .9, 3], ['右廊折角', -4, -4.9, .4, .9, 3],
  ['中央低掩体', -.8, 3.5, 1.6, .8, .9], ['中央高掩体', .4, -2.6, 1.2, 1.2, 2.2],
  ['方向掩体', -1, -6.2, 3, .4, 1.8], ['中央柱', 1.5, 0, .8, .8, 2.5],
  ['目标北墙', 3, -9.5, .4, 1, 4], ['目标北段', 3, -7, .4, 2, 4],
  ['目标右入口', 3, -4.7, .4, 1.9, 4], ['目标中央墙', 3, 0, .4, 2.6, 4],
  ['目标左入口', 3, 5, .4, 2, 4], ['目标南墙', 3, 9.8, .4, .4, 4],
  ['目标高掩体', 5.2, 3.2, 1, 1, 2.2], ['目标低掩体', 7.6, -3, 1.6, .8, .9],
  ['侧翼内墙', 6, 5.8, 9, .4, 4], ['侧翼外墙', 6, 9.4, 9, .4, 4],
  // Spawn screens close the otherwise exposed firing line through the centre entrance.
  ['攻击方防爆屏', -11, 0, .4, 3.2, 2.7], ['防守方防爆屏', 11, 0, .4, 3.2, 2.7],
];
export const BOXES = blocks.map(([name, x, z, w, d, h]) => ({ name, x, z, w, d, h, minX: x-w/2, maxX: x+w/2, minZ: z-d/2, maxZ: z+d/2 }));
export const ZONES = [
  { name: '攻击方外环集结区', code: 'W–17', x: -36, z: 0, w: 8, d: 56 },
  { name: '防守方外环集结区', code: 'E–18', x: 36, z: 0, w: 8, d: 56 },
  { name: '北翼西侧泵站', code: 'N–19', x: -28, z: -23, w: 8, d: 10 },
  { name: '北翼货运扩展仓', code: 'N–20', x: -16, z: -23, w: 16, d: 10 },
  { name: '北翼动力控制室', code: 'N–21', x: 0, z: -23, w: 16, d: 10 },
  { name: '北翼装卸中转站', code: 'N–22', x: 16, z: -23, w: 16, d: 10 },
  { name: '北翼工程维修间', code: 'N–23', x: 28, z: -23, w: 8, d: 10 },
  { name: '南翼医疗补给间', code: 'S–24', x: -28, z: 23, w: 8, d: 10 },
  { name: '南翼材料实验室', code: 'S–25', x: -16, z: 23, w: 16, d: 10 },
  { name: '南翼样本研究室', code: 'S–26', x: 0, z: 23, w: 16, d: 10 },
  { name: '南翼行政办公区', code: 'S–27', x: 16, z: 23, w: 16, d: 10 },
  { name: '南翼通信控制室', code: 'S–28', x: 28, z: 23, w: 8, d: 10 },
  { name: '西侧环形联络廊', code: 'W–29', x: -30, z: 0, w: 4, d: 36 },
  { name: '东侧环形联络廊', code: 'E–30', x: 30, z: 0, w: 4, d: 36 },
  { name: '攻击方装卸大厅', code: 'A–01', x: -22, z: 0, w: 12, d: 36 },
  { name: '防守方后勤大厅', code: 'D–08', x: 22, z: 0, w: 12, d: 36 },
  { name: '西侧货运仓', code: 'N–09', x: -13, z: -14, w: 6, d: 8 },
  { name: '北侧货运中转区', code: 'N–10', x: 0, z: -14, w: 20, d: 8 },
  { name: '东侧货运仓', code: 'N–11', x: 13, z: -14, w: 6, d: 8 },
  { name: '西侧维修间', code: 'S–12', x: -12.5, z: 14, w: 7, d: 8 },
  { name: '南侧设备与档案区', code: 'S–13', x: 0, z: 14, w: 18, d: 8 },
  { name: '东侧维修间', code: 'S–14', x: 12.5, z: 14, w: 7, d: 8 },
  { name: '西侧内门厅', code: 'W–15', x: -13, z: 0, w: 5, d: 19 },
  { name: '左侧通道', code: 'L–02', x: -6, z: 6, w: 9, d: 5 },
  { name: '中央通道', code: 'C–03', x: -6, z: 0, w: 9, d: 5 },
  { name: '右侧通道', code: 'R–04', x: -6, z: -6, w: 9, d: 5 },
  { name: '中央战斗区', code: 'M–05', x: .3, z: 0, w: 4.5, d: 19 },
  { name: '核心控制区', code: 'O–06', x: 6.5, z: 0, w: 7, d: 11 },
  { name: '侧翼通道', code: 'F–07', x: 6, z: 7.6, w: 9, d: 3.2 },
  { name: '东侧内门厅', code: 'E–16', x: 13, z: 0, w: 5, d: 19 },
];
export function zoneAt(p) { return ZONES.find(z => Math.abs(p.x-z.x)<=z.w/2 && Math.abs(p.z-z.z)<=z.d/2) || ZONES.find(z=>z.code==='M–05'); }
export const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const direction = (yaw,pitch=0) => ({ x: -Math.sin(yaw)*Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw)*Math.cos(pitch) });
export function rng(seed=4207) { return () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
