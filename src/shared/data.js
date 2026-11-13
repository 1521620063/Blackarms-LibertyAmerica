// Data ported from main's FBLAMatchRules and build_task11_assets.py. Units: metres.
// Shared dimensions drive collision, navigation, rendering and the tactical map.
export const MAP = { width:56, depth:36, halfWidth:28, halfDepth:18, ceiling:5.6 };
export const RULES = {
  1: { teamSize: 1, prepare: 15, combat: 80, wins: 3, switchAfter: 2 },
  2: { teamSize: 2, prepare: 15, combat: 95, wins: 4, switchAfter: 3 },
  3: { teamSize: 3, prepare: 15, combat: 110, wins: 5, switchAfter: 4 },
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
  attack: [{ x: -24, z: 12 }, { x: -24, z: 0 }, { x: -24, z: -12 }],
  defense: [{ x: 24, z: -12 }, { x: 24, z: 0 }, { x: 24, z: 12 }],
};
// Three.js Y is up; UE's ground Y maps to -Z.
const blocks = [
  ['北侧外墙', 0, -18, 56, .4, 4], ['南侧外墙', 0, 18, 56, .4, 4],
  ['攻击方外墙', -28, 0, .4, 36, 4], ['防守方外墙', 28, 0, .4, 36, 4],
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
export function zoneAt(p) { return ZONES.find(z => Math.abs(p.x-z.x)<z.w/2 && Math.abs(p.z-z.z)<z.d/2) || ZONES.find(z=>z.code==='M–05'); }
export const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const direction = (yaw,pitch=0) => ({ x: -Math.sin(yaw)*Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw)*Math.cos(pitch) });
export function rng(seed=4207) { return () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
