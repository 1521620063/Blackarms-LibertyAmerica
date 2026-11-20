use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{cmp::Ordering, collections::BinaryHeap, sync::OnceLock};

pub const STEP: f64 = 1.0 / 60.0;
pub fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| serde_json::from_str(include_str!("game-data.json")).unwrap())
}
pub fn num(v: &Value) -> f64 {
    v.as_f64().unwrap_or(0.0)
}
pub fn text(v: &Value) -> &str {
    v.as_str().unwrap_or("")
}
pub fn weapon(key: &str) -> &'static Value {
    &data()["WEAPONS"][key]
}
pub fn primary(key: &str) -> bool {
    data()["PRIMARY_WEAPONS"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == key)
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub z: f64,
}
impl Point {
    pub fn distance(self, b: Self) -> f64 {
        (self.x - b.x).hypot(self.z - b.z)
    }
}
pub fn point(v: &Value) -> Point {
    Point {
        x: num(&v["x"]),
        z: num(&v["z"]),
    }
}
pub fn spawn(attack: bool, slot: usize) -> Point {
    point(&data()["SPAWNS"][if attack { "attack" } else { "defense" }][slot])
}

pub fn walkable(p: Point, r: f64) -> bool {
    if !(p.x > -39.75 + r && p.x < 39.75 - r && p.z > -27.75 + r && p.z < 27.75 - r) {
        return false;
    }
    for b in data()["BOXES"].as_array().unwrap() {
        let dx = p.x - p.x.clamp(num(&b["minX"]), num(&b["maxX"]));
        let dz = p.z - p.z.clamp(num(&b["minZ"]), num(&b["maxZ"]));
        if dx * dx + dz * dz < r * r {
            return false;
        }
    }
    true
}
pub fn move_point(p: &mut Point, dx: f64, dz: f64) {
    let n = (dx.hypot(dz) / 0.15).ceil().max(1.0) as usize;
    for _ in 0..n {
        let q = Point {
            x: p.x + dx / n as f64,
            z: p.z,
        };
        if walkable(q, 0.29) {
            p.x = q.x;
        }
        let q = Point {
            x: p.x,
            z: p.z + dz / n as f64,
        };
        if walkable(q, 0.29) {
            p.z = q.z;
        }
    }
}
pub fn wall_hit(o: [f64; 3], d: [f64; 3]) -> f64 {
    let mut hit = f64::INFINITY;
    for b in data()["BOXES"].as_array().unwrap() {
        let lo = [num(&b["minX"]), 0.0, num(&b["minZ"])];
        let hi = [num(&b["maxX"]), num(&b["h"]), num(&b["maxZ"])];
        let (mut near, mut far) = (0.0_f64, f64::INFINITY);
        for axis in 0..3 {
            if d[axis].abs() < 1e-9 {
                if o[axis] < lo[axis] || o[axis] > hi[axis] {
                    far = -1.0;
                    break;
                }
            } else {
                let a = (lo[axis] - o[axis]) / d[axis];
                let c = (hi[axis] - o[axis]) / d[axis];
                near = near.max(a.min(c));
                far = far.min(a.max(c));
            }
        }
        if near <= far && far >= 0.0 {
            hit = hit.min(near);
        }
    }
    if d[1] < 0.0 {
        hit = hit.min(-o[1] / d[1]);
    }
    if d[1] > 0.0 {
        hit = hit.min((5.6 - o[1]) / d[1]);
    }
    hit
}
pub fn ray_sphere(o: [f64; 3], d: [f64; 3], c: [f64; 3], r: f64) -> f64 {
    let q = [o[0] - c[0], o[1] - c[1], o[2] - c[2]];
    let b = q.iter().zip(d).map(|(a, b)| a * b).sum::<f64>();
    let det = b * b - (q.iter().map(|v| v * v).sum::<f64>() - r * r);
    if det < 0.0 {
        return f64::INFINITY;
    }
    let t = -b - det.sqrt();
    if t >= 0.0 { t } else { f64::INFINITY }
}
pub fn visible(a: Point, ay: f64, ac: bool, b: Point, by: f64, bc: bool) -> bool {
    let o = [a.x, ay + if ac { 1.07 } else { 1.42 }, a.z];
    let t = [b.x, by + if bc { 0.94 } else { 1.25 }, b.z];
    let len = ((t[0] - o[0]).powi(2) + (t[1] - o[1]).powi(2) + (t[2] - o[2]).powi(2)).sqrt();
    len < 1e-9
        || wall_hit(
            o,
            [
                (t[0] - o[0]) / len,
                (t[1] - o[1]) / len,
                (t[2] - o[2]) / len,
            ],
        ) > len - 0.2
}
// Cached clearance grid with A*; diagonal steps cannot cut through wall corners.
const W: usize = 159;
const H: usize = 111;
fn node(i: usize) -> Point {
    Point {
        x: -39.5 + (i % W) as f64 * 0.5,
        z: -27.5 + (i / W) as f64 * 0.5,
    }
}
fn grid() -> &'static Vec<bool> {
    static GRID: OnceLock<Vec<bool>> = OnceLock::new();
    GRID.get_or_init(|| (0..W * H).map(|i| walkable(node(i), 0.36)).collect())
}
fn nearest(p: Point) -> usize {
    let x = ((p.x + 39.5) / 0.5).round().clamp(0.0, (W - 1) as f64) as usize;
    let z = ((p.z + 27.5) / 0.5).round().clamp(0.0, (H - 1) as f64) as usize;
    if grid()[z * W + x] {
        return z * W + x;
    }
    (0..W * H)
        .filter(|&i| grid()[i])
        .min_by(|&a, &b| node(a).distance(p).total_cmp(&node(b).distance(p)))
        .unwrap()
}
#[derive(PartialEq)]
struct Entry(usize, f64);
impl Eq for Entry {}
impl Ord for Entry {
    fn cmp(&self, b: &Self) -> Ordering {
        b.1.total_cmp(&self.1).then_with(|| self.0.cmp(&b.0))
    }
}
impl PartialOrd for Entry {
    fn partial_cmp(&self, b: &Self) -> Option<Ordering> {
        Some(self.cmp(b))
    }
}
pub fn find_path(from: Point, to: Point) -> Vec<Point> {
    let start = nearest(from);
    let end = nearest(to);
    let mut costs = vec![f64::INFINITY; W * H];
    let mut came = vec![0; W * H];
    let mut closed = vec![false; W * H];
    let mut heap = BinaryHeap::new();
    costs[start] = 0.0;
    heap.push(Entry(start, 0.0));
    while let Some(Entry(i, _)) = heap.pop() {
        if closed[i] {
            continue;
        }
        if i == end {
            let mut path = vec![];
            let mut c = end;
            while c != start {
                path.push(node(c));
                c = came[c];
            }
            path.reverse();
            return path;
        }
        closed[i] = true;
        for (dx, dz) in [
            (1, 0),
            (-1, 0),
            (0, 1),
            (0, -1),
            (1, 1),
            (1, -1),
            (-1, 1),
            (-1, -1),
        ] {
            let x = (i % W) as i32 + dx;
            let z = (i / W) as i32 + dz;
            if x < 0 || z < 0 || x >= W as i32 || z >= H as i32 {
                continue;
            }
            let j = z as usize * W + x as usize;
            if !grid()[j]
                || closed[j]
                || (dx != 0
                    && dz != 0
                    && (!grid()[(i / W) * W + x as usize] || !grid()[z as usize * W + i % W]))
            {
                continue;
            }
            let cost = costs[i]
                + if dx != 0 && dz != 0 {
                    std::f64::consts::SQRT_2
                } else {
                    1.0
                };
            if cost < costs[j] {
                costs[j] = cost;
                came[j] = i;
                heap.push(Entry(j, cost + node(j).distance(node(end)) / 0.5));
            }
        }
    }
    vec![]
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct Input {
    pub forward: f64,
    pub strafe: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub fire: bool,
    pub fire_pose: Option<(f64, f64)>,
    pub aim: bool,
    pub interact: bool,
    pub sprint: bool,
    pub crouch: bool,
    pub jump: bool,
    pub reload: bool,
    pub weapon: Option<String>,
    pub order: Option<String>,
    pub drop: bool,
    pub ready: bool,
}
impl Input {
    pub fn parse(v: &Value) -> Self {
        let finite = |k: &str, lo: f64, hi: f64| num(&v[k]).clamp(lo, hi);
        let flag = |k: &str| v[k].as_bool().unwrap_or(false);
        let w = text(&v["weapon"]);
        let order = text(&v["order"]);
        let pose = &v["firePose"];
        let fire_pose = pose["yaw"]
            .as_f64()
            .zip(pose["pitch"].as_f64())
            .map(|(yaw, pitch)| (yaw.clamp(-1e5, 1e5), pitch.clamp(-1.4, 1.4)));
        Self {
            forward: finite("forward", -1.0, 1.0),
            strafe: finite("strafe", -1.0, 1.0),
            yaw: finite("yaw", -1e5, 1e5),
            pitch: finite("pitch", -1.4, 1.4),
            fire: flag("fire"),
            fire_pose,
            aim: flag("aim"),
            interact: flag("interact"),
            sprint: flag("sprint"),
            crouch: flag("crouch"),
            jump: flag("jump"),
            reload: flag("reload"),
            weapon: weapon(w).is_object().then(|| w.to_owned()),
            order: data()["ORDERS"][order]
                .is_string()
                .then(|| order.to_owned()),
            drop: flag("drop"),
            ready: flag("ready"),
        }
    }
}
