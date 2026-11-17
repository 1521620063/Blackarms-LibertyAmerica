use crate::game::{Match, Projectile, Smoke};
use crate::physics::*;
use serde_json::json;

fn eye(a: &crate::game::Actor) -> [f64; 3] {
    [a.pos.x, a.y + if a.crouch { 1.07 } else { 1.57 }, a.pos.z]
}
fn clear_ray(from: [f64; 3], to: [f64; 3]) -> bool {
    let d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    let len = d.iter().map(|v| v * v).sum::<f64>().sqrt();
    len < 0.001 || wall_hit(from, d.map(|v| v / len)) > len - 0.05
}
fn bounce(p: &mut Projectile, dt: f64) {
    p.vy -= 9.8 * dt;
    let mut pos = [p.x, p.y, p.z];
    let mut velocity = [p.vx, p.vy, p.vz];
    for axis in 0..3 {
        let delta = velocity[axis] * dt;
        if delta.abs() < 1e-8 {
            continue;
        }
        let mut dir = [0.0; 3];
        dir[axis] = delta.signum();
        let hit = wall_hit(pos, dir);
        if hit <= delta.abs() + 0.09 {
            pos[axis] += dir[axis] * (hit - 0.095).max(0.0);
            velocity[axis] *= -0.45;
            if axis == 1 {
                velocity[0] *= 0.72;
                velocity[2] *= 0.72;
            }
        } else {
            pos[axis] += delta;
        }
    }
    [p.x, p.y, p.z] = pos;
    [p.vx, p.vy, p.vz] = velocity;
}
impl Match {
    pub(crate) fn smoke_blocks(&self, from: [f64; 3], to: [f64; 3]) -> bool {
        let d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
        let len = d.iter().map(|v| v * v).sum::<f64>();
        self.smokes.iter().any(|s| {
            let center = [s.x, s.y, s.z];
            let t = if len > 0.0 {
                ((0..3).map(|i| (center[i] - from[i]) * d[i]).sum::<f64>() / len).clamp(0.0, 1.0)
            } else {
                0.0
            };
            (0..3)
                .map(|i| (from[i] + d[i] * t - center[i]).powi(2))
                .sum::<f64>()
                < s.radius * s.radius
        })
    }
    pub(crate) fn obscured(&self, a: &crate::game::Actor, b: &crate::game::Actor) -> bool {
        a.flash > 0.5 || self.smoke_blocks(eye(a), eye(b))
    }
    pub(crate) fn throw_grenade(&mut self, idx: usize) -> bool {
        let a = &mut self.actors[idx];
        let w = weapon(&a.weapon);
        let origin = eye(a);
        let pitch = (a.pitch + 0.18).clamp(-1.2, 1.35);
        a.ammo.get_mut(&a.weapon).unwrap().mag -= 1;
        a.cooldown = 60.0 / num(&w["rpm"]);
        self.projectile_id += 1;
        let p = Projectile {
            id: self.projectile_id,
            actor: a.id.clone(),
            weapon: a.weapon.clone(),
            x: origin[0],
            y: origin[1],
            z: origin[2],
            vx: -a.yaw.sin() * pitch.cos() * num(&w["speed"]),
            vy: pitch.sin() * num(&w["speed"]) + 2.0,
            vz: -a.yaw.cos() * pitch.cos() * num(&w["speed"]),
            fuse: num(&w["fuse"]),
        };
        let e = json!({"actor":a.id,"weapon":a.weapon,"origin":{"x":p.x,"y":p.y,"z":p.z}});
        self.projectiles.push(p);
        self.emit("throw", e);
        true
    }
    pub(crate) fn update_grenades(&mut self, dt: f64) {
        for a in &mut self.actors {
            a.flash = (a.flash - dt).max(0.0);
        }
        for s in &mut self.smokes {
            s.remaining -= dt;
        }
        self.smokes.retain(|s| s.remaining > 0.0);
        let mut detonated = vec![];
        for p in &mut self.projectiles {
            let steps = (dt / 0.01).ceil() as usize;
            for _ in 0..steps {
                bounce(p, dt / steps as f64);
            }
            p.fuse -= dt;
            if p.fuse <= 0.0 {
                detonated.push(p.clone());
            }
        }
        self.projectiles.retain(|p| p.fuse > 0.0);
        for p in detonated {
            let w = weapon(&p.weapon);
            let range = num(&w["range"]);
            let origin = [p.x, p.y, p.z];
            self.emit("detonate",json!({"actor":p.actor,"weapon":p.weapon,"origin":{"x":p.x,"y":p.y,"z":p.z},"radius":range}));
            if p.weapon == "smoke" {
                self.smokes.push(Smoke {
                    id: p.id,
                    x: p.x,
                    y: p.y.max(0.9),
                    z: p.z,
                    radius: range,
                    remaining: num(&w["duration"]),
                });
                continue;
            }
            let source = self.actors.iter().position(|a| a.id == p.actor);
            for idx in 0..self.actors.len() {
                let a = &self.actors[idx];
                if !a.alive {
                    continue;
                }
                let target = eye(a);
                let d = (0..3)
                    .map(|i| (origin[i] - target[i]).powi(2))
                    .sum::<f64>()
                    .sqrt();
                if d >= range || !clear_ray(origin, target) {
                    continue;
                }
                if p.weapon == "grenade" {
                    if source.is_none_or(|s| self.actors[s].squad != a.squad) {
                        let amount = num(&w["damage"])
                            * (1.0 - d / range)
                            * (1.0 - num(&data()["ARMOR"][&a.armor]["protection"]));
                        self.damage(idx, amount, source, "blast");
                    }
                } else if !self.smoke_blocks(origin, target) {
                    let view = [
                        -a.yaw.sin() * a.pitch.cos(),
                        a.pitch.sin(),
                        -a.yaw.cos() * a.pitch.cos(),
                    ];
                    let facing = if d > 0.001 {
                        (0..3)
                            .map(|i| view[i] * (origin[i] - target[i]))
                            .sum::<f64>()
                            / d
                    } else {
                        1.0
                    };
                    let duration = a.flash.max(
                        num(&w["duration"])
                            * (1.0 - d / range)
                            * if facing > 0.35 { 1.0 } else { 0.25 },
                    );
                    self.actors[idx].flash = duration;
                    self.emit(
                        "blind",
                        json!({"actor":self.actors[idx].id,"source":p.actor,"duration":duration}),
                    );
                }
            }
        }
    }
}
