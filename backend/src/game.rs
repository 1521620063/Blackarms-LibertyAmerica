use crate::physics::*;
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub mode: String,
    pub team_size: usize,
    pub difficulty: String,
    pub primary: String,
    pub armor: String,
}
impl Config {
    pub fn parse(v: &Value) -> Self {
        let size = v["teamSize"]
            .as_u64()
            .or_else(|| text(&v["teamSize"]).parse().ok())
            .unwrap_or(3) as usize;
        Self {
            mode: if v["mode"] == "core" {
                "core"
            } else {
                "elimination"
            }
            .into(),
            team_size: if (1..=5).contains(&size) { size } else { 3 },
            difficulty: if data()["DIFFICULTY"][text(&v["difficulty"])].is_object() {
                text(&v["difficulty"])
            } else {
                "normal"
            }
            .into(),
            primary: if primary(text(&v["primary"])) {
                text(&v["primary"])
            } else {
                "rifle"
            }
            .into(),
            armor: if v["armor"] == "heavy" {
                "heavy"
            } else {
                "light"
            }
            .into(),
        }
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Human {
    pub id: String,
    pub name: String,
    pub squad: usize,
    pub primary: String,
    pub armor: String,
}
#[derive(Clone, Debug, Serialize)]
pub struct Ammo {
    pub mag: i64,
    pub reserve: i64,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Actor {
    pub id: String,
    pub squad: usize,
    pub slot: usize,
    pub name: String,
    pub bot: bool,
    pub armor: String,
    pub primary: String,
    pub kills: u32,
    pub deaths: u32,
    pub damage: f64,
    pub contribution: u32,
    pub headshots: u32,
    #[serde(flatten)]
    pub pos: Point,
    pub y: f64,
    pub vy: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub hp: f64,
    pub alive: bool,
    pub weapon: String,
    pub ammo: BTreeMap<String, Ammo>,
    pub reload: f64,
    pub switch_time: f64,
    pub cooldown: f64,
    pub shot_heat: f64,
    pub flash: f64,
    pub ready: bool,
    pub crouch: bool,
    pub aim: bool,
    pub sprinting: bool,
    pub jump_held: bool,
    #[serde(skip)]
    pub input: Input,
    #[serde(skip)]
    last: Input,
    #[serde(skip)]
    pub waiting: bool,
    #[serde(skip)]
    path: Vec<Point>,
    #[serde(skip)]
    path_timer: f64,
    #[serde(skip)]
    goal: Option<Point>,
    #[serde(skip)]
    route_stage: usize,
    #[serde(skip)]
    patrol: usize,
    #[serde(skip)]
    reaction: f64,
    #[serde(skip)]
    target: Option<String>,
    #[serde(skip)]
    heard: Option<(Point, f64)>,
    #[serde(skip)]
    memory: Option<(Point, f64)>,
    #[serde(skip)]
    cover: Option<(Point, bool, f64)>,
    #[serde(skip)]
    cover_check: f64,
    #[serde(skip)]
    stuck: f64,
    #[serde(skip)]
    last_pos: Point,
}
#[derive(Clone, Debug, Serialize)]
pub struct Core {
    pub state: String,
    pub carrier: Option<String>,
    pub x: f64,
    pub z: f64,
    pub progress: f64,
    pub upload: f64,
    pub interactor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<Point>,
}
impl Core {
    fn uploading(&self) -> bool {
        matches!(self.state.as_str(), "uploading" | "defusing")
    }
    fn pos(&self) -> Point {
        Point {
            x: self.x,
            z: self.z,
        }
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Projectile {
    pub id: u64,
    pub actor: String,
    pub weapon: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub vz: f64,
    pub fuse: f64,
}
#[derive(Clone, Debug, Serialize)]
pub struct Smoke {
    pub id: u64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub radius: f64,
    pub remaining: f64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub config: Config,
    pub time: f64,
    pub round: u32,
    pub scores: [u32; 2],
    pub attack_squad: usize,
    pub actors: Vec<Actor>,
    pub events: Vec<Value>,
    pub history: Vec<Value>,
    pub orders: [Option<Value>; 2],
    pub phase: String,
    pub result: Option<Value>,
    pub remaining: f64,
    pub elapsed: f64,
    pub overtime: bool,
    pub rules: Value,
    pub core: Core,
    pub projectiles: Vec<Projectile>,
    pub smokes: Vec<Smoke>,
    #[serde(skip)]
    pub(crate) projectile_id: u64,
    #[serde(skip)]
    event_id: u64,
    #[serde(skip)]
    seed: u32,
}
impl Match {
    pub fn new(config: Config, humans: &[Human], seed: u32) -> Self {
        let mut actors = vec![];
        for squad in 0..2 {
            for slot in 0..config.team_size {
                let h = humans.iter().filter(|h| h.squad == squad).nth(slot);
                actors.push(Actor {
                    id: h
                        .map(|h| h.id.clone())
                        .unwrap_or_else(|| format!("bot-{squad}-{slot}")),
                    squad,
                    slot,
                    name: h.map(|h| h.name.clone()).unwrap_or_else(|| {
                        format!(
                            "{} {}",
                            if squad == 0 { "ALPHA" } else { "BRAVO" },
                            ["先锋", "支援", "哨兵", "突击", "侦察"][slot]
                        )
                    }),
                    bot: h.is_none(),
                    armor: h
                        .map(|h| h.armor.clone())
                        .unwrap_or_else(|| config.armor.clone()),
                    primary: h
                        .map(|h| h.primary.clone())
                        .unwrap_or_else(|| config.primary.clone()),
                    kills: 0,
                    deaths: 0,
                    damage: 0.0,
                    contribution: 0,
                    headshots: 0,
                    pos: Point::default(),
                    y: 0.0,
                    vy: 0.0,
                    yaw: 0.0,
                    pitch: 0.0,
                    hp: 100.0,
                    alive: true,
                    weapon: config.primary.clone(),
                    ammo: BTreeMap::new(),
                    reload: 0.0,
                    switch_time: 0.0,
                    cooldown: 0.0,
                    shot_heat: 0.0,
                    flash: 0.0,
                    ready: false,
                    crouch: false,
                    aim: false,
                    sprinting: false,
                    jump_held: false,
                    input: Input::default(),
                    last: Input::default(),
                    waiting: false,
                    path: vec![],
                    path_timer: 0.0,
                    goal: None,
                    route_stage: 0,
                    patrol: slot,
                    reaction: 0.0,
                    target: None,
                    heard: None,
                    memory: None,
                    cover: None,
                    cover_check: 0.0,
                    stuck: 0.0,
                    last_pos: Point::default(),
                });
            }
        }
        let rules = data()["RULES"][config.team_size.to_string()].clone();
        let mut m = Self {
            config,
            time: 0.0,
            round: 1,
            scores: [0, 0],
            attack_squad: 0,
            actors,
            events: vec![],
            history: vec![],
            orders: [None, None],
            phase: "preparation".into(),
            result: None,
            remaining: 0.0,
            elapsed: 0.0,
            overtime: false,
            rules,
            core: Core {
                state: "none".into(),
                carrier: None,
                x: 0.0,
                z: 0.0,
                progress: 0.0,
                upload: 30.0,
                interactor: None,
                origin: None,
            },
            projectiles: vec![],
            smokes: vec![],
            projectile_id: 0,
            event_id: 0,
            seed,
        };
        m.reset_round();
        m
    }
    fn random(&mut self) -> f64 {
        self.seed = self.seed.wrapping_add(0x6D2B79F5);
        let mut t = (self.seed ^ (self.seed >> 15)).wrapping_mul(1 | self.seed);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
    pub(crate) fn emit(&mut self, kind: &str, mut value: Value) {
        self.event_id += 1;
        value["id"] = json!(self.event_id);
        value["type"] = json!(kind);
        value["time"] = json!(self.time);
        self.events.push(value);
        if self.events.len() > 128 {
            self.events.remove(0);
        }
    }
    pub fn snapshot(&self) -> Value {
        serde_json::to_value(self).unwrap()
    }
    fn reset_round(&mut self) {
        self.projectiles.clear();
        self.smokes.clear();
        self.projectile_id = 0;
        self.phase = "preparation".into();
        self.remaining = num(&self.rules["prepare"]);
        self.elapsed = 0.0;
        self.overtime = false;
        self.result = None;
        self.orders = [None, None];
        for a in &mut self.actors {
            a.pos = spawn(a.squad == self.attack_squad, a.slot);
            a.last_pos = a.pos;
            a.y = 0.0;
            a.vy = 0.0;
            a.yaw = if a.squad == self.attack_squad {
                -std::f64::consts::FRAC_PI_2
            } else {
                std::f64::consts::FRAC_PI_2
            };
            a.pitch = 0.0;
            a.hp = 100.0;
            a.alive = true;
            a.weapon = a.primary.clone();
            a.ammo = data()["WEAPONS"]
                .as_object()
                .unwrap()
                .iter()
                .map(|(k, w)| {
                    (
                        k.clone(),
                        Ammo {
                            mag: w["mag"].as_i64().unwrap(),
                            reserve: w["reserve"].as_i64().unwrap(),
                        },
                    )
                })
                .collect();
            a.reload = 0.0;
            a.switch_time = 0.0;
            a.cooldown = 0.0;
            a.shot_heat = 0.0;
            a.flash = 0.0;
            a.ready = a.bot;
            a.crouch = false;
            a.aim = false;
            a.sprinting = false;
            a.jump_held = false;
            a.input = Input::default();
            a.last = Input::default();
            a.waiting = false;
            a.path.clear();
            a.path_timer = 0.0;
            a.goal = None;
            a.route_stage = 0;
            a.reaction = 0.0;
            a.target = None;
            a.heard = None;
            a.memory = None;
            a.cover = None;
            a.cover_check = 0.0;
            a.stuck = 0.0;
        }
        let a = self
            .actors
            .iter()
            .find(|a| a.squad == self.attack_squad)
            .unwrap();
        let core = self.config.mode == "core";
        self.core = Core {
            state: if core { "carried" } else { "none" }.into(),
            carrier: core.then(|| a.id.clone()),
            x: a.pos.x,
            z: a.pos.z,
            progress: 0.0,
            upload: 30.0,
            interactor: None,
            origin: None,
        };
        self.emit(
            "round",
            json!({"round":self.round,"attackSquad":self.attack_squad}),
        );
    }
    pub fn set_input(&mut self, id: &str, input: Input) {
        if let Some(a) = self.actors.iter_mut().find(|a| a.id == id && !a.bot) {
            a.input = input;
        }
    }
    pub fn set_loadout(&mut self, id: &str, w: &str, armor: &str) {
        if self.phase != "preparation" {
            return;
        }
        if let Some(a) = self.actors.iter_mut().find(|a| a.id == id) {
            if primary(w) {
                a.primary = w.into();
                a.weapon = w.into();
                a.reload = 0.0;
                a.switch_time = 0.0;
            }
            if armor == "light" || armor == "heavy" {
                a.armor = armor.into();
            }
        }
    }
    pub fn start_combat(&mut self) {
        if self.phase == "preparation" {
            self.phase = "combat".into();
            self.remaining = num(&self.rules["combat"]);
            self.elapsed = 0.0;
            self.emit("combat", json!({}));
        }
    }
    pub fn step(&mut self, dt: f64) {
        if !dt.is_finite() || dt <= 0.0 {
            return;
        }
        let dt = dt.min(0.05);
        self.time += dt;
        if self.phase == "matchResult" {
            return;
        }
        if self.phase == "roundResult" {
            self.remaining -= dt;
            if self.remaining <= 0.0 {
                if self
                    .round
                    .is_multiple_of(num(&self.rules["switchAfter"]) as u32)
                {
                    self.attack_squad = 1 - self.attack_squad;
                    self.emit("sides", json!({}));
                }
                self.round += 1;
                self.reset_round();
            }
            return;
        }
        self.elapsed += dt;
        self.remaining = (self.remaining - dt).max(0.0);
        if self.phase == "preparation" {
            for a in &mut self.actors {
                if a.input.ready {
                    a.ready = true;
                }
                a.last = a.input.clone();
                a.jump_held = a.input.jump;
            }
            if self.remaining <= 0.0 || self.actors.iter().all(|a| a.ready) {
                self.start_combat();
            }
            return;
        }
        for idx in 0..self.actors.len() {
            if !self.actors[idx].alive {
                continue;
            }
            let a = &mut self.actors[idx];
            a.switch_time = (a.switch_time - dt).max(0.0);
            a.cooldown = (a.cooldown - dt).max(0.0);
            a.shot_heat = (a.shot_heat - dt * 1.8).max(0.0);
            let mut reloaded = None;
            if a.reload > 0.0 {
                a.reload = (a.reload - dt).max(0.0);
                if a.reload == 0.0 {
                    let am = a.ammo.get_mut(&a.weapon).unwrap();
                    let n = (weapon(&a.weapon)["mag"].as_i64().unwrap() - am.mag).min(am.reserve);
                    am.mag += n;
                    am.reserve -= n;
                    reloaded = Some(a.id.clone());
                }
            }
            if let Some(id) = reloaded {
                self.emit("reloaded", json!({"actor":id}));
            }
            if self.actors[idx].bot {
                self.think(idx, dt);
            }
            if !self.actors[idx].bot && self.actors[idx].waiting {
                continue;
            }
            self.update_actor(idx, dt);
        }
        for i in 0..self.actors.len() {
            for j in i + 1..self.actors.len() {
                if !self.actors[i].alive || !self.actors[j].alive {
                    continue;
                }
                let a = self.actors[i].pos;
                let b = self.actors[j].pos;
                let d = a.distance(b);
                if d > 0.001 && d < 0.58 {
                    let p = (0.58 - d) / 2.0;
                    move_point(
                        &mut self.actors[i].pos,
                        (a.x - b.x) / d * p,
                        (a.z - b.z) / d * p,
                    );
                    move_point(
                        &mut self.actors[j].pos,
                        (b.x - a.x) / d * p,
                        (b.z - a.z) / d * p,
                    );
                }
            }
        }
        self.update_grenades(dt);
        if self.config.mode == "core" {
            self.update_objective(dt);
        }
        if self.phase != "combat" {
            return;
        }
        self.evaluate_elimination();
        if self.phase != "combat" {
            return;
        }
        if self.remaining <= 0.0 && !self.core.uploading() {
            self.timeout();
        }
        if self.elapsed > num(&self.rules["combat"]) + 60.0 {
            self.end_round(None, "安全时限已到，回合平局");
        }
    }
    fn update_actor(&mut self, idx: usize, dt: f64) {
        let i = self.actors[idx].input.clone();
        let last = self.actors[idx].last.clone();
        if let Some(w) = &i.weapon
            && *w != self.actors[idx].weapon
        {
            let a = &mut self.actors[idx];
            a.weapon = w.clone();
            a.reload = 0.0;
            a.switch_time = weapon(w)["equip"].as_f64().unwrap_or(0.32);
            let (id, t) = (a.id.clone(), a.switch_time);
            self.emit("switch", json!({"actor":id,"weapon":w,"duration":t}));
        }
        if i.reload && !last.reload {
            self.reload_weapon(idx);
        }
        if i.drop && !last.drop {
            self.drop_core(idx);
        }
        if i.order.is_some() && i.order != last.order {
            self.order(idx, i.order.as_deref().unwrap());
        }
        let a = &mut self.actors[idx];
        a.yaw = i.yaw;
        a.pitch = i.pitch;
        a.aim = i.aim;
        a.crouch = i.crouch;
        a.sprinting = i.sprint && !i.aim && !i.fire && !i.crouch && i.forward > 0.0;
        if i.jump && !a.jump_held && a.y == 0.0 && !a.crouch {
            a.vy = 4.5;
        }
        a.jump_held = i.jump;
        a.vy -= 12.0 * dt;
        a.y = (a.y + a.vy * dt).max(0.0);
        if a.y == 0.0 {
            a.vy = 0.0;
        }
        let mut dx = -a.yaw.sin() * i.forward + a.yaw.cos() * i.strafe;
        let mut dz = -a.yaw.cos() * i.forward - a.yaw.sin() * i.strafe;
        let len = dx.hypot(dz);
        if len > 1.0 {
            dx /= len;
            dz /= len;
        }
        let speed = 3.5
            * num(&data()["ARMOR"][&a.armor]["speed"])
            * weapon(&a.weapon)["move"].as_f64().unwrap_or(1.0)
            * if a.sprinting {
                1.5
            } else if a.crouch {
                0.5
            } else if a.aim {
                0.72
            } else {
                1.0
            };
        move_point(&mut a.pos, dx * dt * speed, dz * dt * speed);
        if i.fire
            && !i.interact
            && !a.sprinting
            && (a.bot || weapon(&a.weapon)["semi"] != true || !last.fire)
        {
            self.shoot(idx);
        }
        if i.interact && !i.fire && !self.actors[idx].sprinting {
            self.interact(idx, dt);
        } else if self.core.interactor.as_deref() == Some(&self.actors[idx].id) {
            self.cancel_interaction();
        }
        self.actors[idx].last = i;
    }
    fn reload_weapon(&mut self, idx: usize) -> bool {
        let a = &mut self.actors[idx];
        let w = weapon(&a.weapon);
        let am = &a.ammo[&a.weapon];
        if w["throwable"] == true
            || a.reload > 0.0
            || a.switch_time > 0.0
            || am.mag == w["mag"].as_i64().unwrap()
            || am.reserve <= 0
        {
            return false;
        }
        a.reload = num(&w["reload"]);
        let e = json!({"actor":a.id,"weapon":a.weapon,"duration":a.reload});
        self.emit("reload", e);
        true
    }
    pub fn shoot(&mut self, idx: usize) -> bool {
        let a = &self.actors[idx];
        if self.phase != "combat"
            || !a.alive
            || a.reload > 0.0
            || a.switch_time > 0.0
            || a.cooldown > 0.0
        {
            return false;
        }
        if a.ammo[&a.weapon].mag <= 0 {
            if !self.reload_weapon(idx) && self.actors[idx].weapon != "pistol" {
                self.actors[idx].input.weapon = Some("pistol".into());
            }
            return false;
        }
        if weapon(&a.weapon)["throwable"] == true {
            return self.throw_grenade(idx);
        }
        let a = &mut self.actors[idx];
        a.ammo.get_mut(&a.weapon).unwrap().mag -= 1;
        let w = weapon(&a.weapon);
        a.cooldown = 60.0 / num(&w["rpm"]) * if a.bot { 1.25 } else { 1.0 };
        a.shot_heat = (a.shot_heat + 0.22).min(1.0);
        let a = a.clone();
        let origin = [a.pos.x, (if a.crouch { 1.07 } else { 1.57 }) + a.y, a.pos.z];
        let accuracy = if a.weapon == "sniper" {
            if a.aim { 0.025 } else { 1.0 }
        } else if a.aim {
            0.32
        } else {
            1.0
        };
        let spread = num(&w["spread"])
            * accuracy
            * (1.0 + a.shot_heat * if a.weapon == "lmg" { 2.0 } else { 0.7 })
            + if a.bot {
                num(&data()["DIFFICULTY"][&self.config.difficulty]["error"])
            } else {
                0.0
            };
        let mut traces = vec![];
        for _ in 0..w["pellets"].as_u64().unwrap() {
            let yaw = a.yaw + (self.random() - 0.5) * spread * 2.0;
            let pitch = a.pitch + (self.random() - 0.5) * spread * 2.0;
            let dir = [
                -yaw.sin() * pitch.cos(),
                pitch.sin(),
                -yaw.cos() * pitch.cos(),
            ];
            let mut nearest = num(&w["range"]).min(wall_hit(origin, dir));
            let mut target = None;
            let mut part = "body";
            for (n, b) in self.actors.iter().enumerate() {
                if !b.alive || n == idx {
                    continue;
                }
                let crouch = if b.crouch { 0.72 } else { 1.0 };
                for (region, h, r) in [
                    ("limb", 0.48, 0.3),
                    ("body", 1.09, 0.39),
                    ("weakpoint", 1.66, 0.235),
                ] {
                    let t = ray_sphere(origin, dir, [b.pos.x, h * crouch + b.y, b.pos.z], r);
                    if t < nearest {
                        nearest = t;
                        target = Some(n);
                        part = region;
                    }
                }
            }
            let enemy = target.is_some_and(|n| self.actors[n].squad != a.squad);
            if let Some(n) = target.filter(|_| enemy) {
                let mult = if part == "weakpoint" {
                    2.0
                } else if part == "limb" {
                    0.75
                } else {
                    1.0
                };
                let amount = num(&w["damage"])
                    * mult
                    * (1.0 - num(&w["falloff"]) * (nearest / num(&w["range"])).clamp(0.0, 1.0))
                    * (1.0 - num(&data()["ARMOR"][&self.actors[n].armor]["protection"]));
                self.damage(n, amount, Some(idx), part);
            }
            traces.push(json!({"end":{"x":origin[0]+dir[0]*nearest,"y":origin[1]+dir[1]*nearest,"z":origin[2]+dir[2]*nearest},"hit":target.is_some(),"enemy":enemy,"part":part}));
        }
        self.emit("shot",json!({"actor":a.id,"weapon":a.weapon,"origin":{"x":origin[0],"y":origin[1],"z":origin[2]},"traces":traces}));
        let hearing = num(&data()["DIFFICULTY"][&self.config.difficulty]["hearing"]);
        for b in &mut self.actors {
            if b.alive && b.squad != a.squad && b.pos.distance(a.pos) < hearing {
                b.heard = Some((a.pos, self.time + 6.0));
            }
        }
        true
    }
    pub fn damage(&mut self, idx: usize, amount: f64, source: Option<usize>, part: &str) -> bool {
        if !self.actors[idx].alive || self.phase != "combat" || !amount.is_finite() || amount <= 0.0
        {
            return false;
        }
        let dealt = self.actors[idx].hp.min(amount);
        self.actors[idx].hp -= dealt;
        if let Some(s) = source {
            self.actors[s].damage += dealt;
            let heard = (self.actors[s].pos, self.time + 7.0);
            self.actors[idx].heard = Some(heard);
            let target = self.actors[idx].clone();
            for b in &mut self.actors {
                if b.bot && b.alive && b.squad == target.squad && b.pos.distance(target.pos) < 12.0
                {
                    b.heard = Some(heard);
                }
            }
        }
        if self.core.interactor.as_deref() == Some(&self.actors[idx].id) {
            self.cancel_interaction();
        }
        let source_id = source.map(|s| self.actors[s].id.clone());
        self.emit(
            "damage",
            json!({"actor":self.actors[idx].id,"source":source_id,"amount":dealt,"part":part}),
        );
        if self.actors[idx].hp <= 0.0 {
            let a = &mut self.actors[idx];
            a.hp = 0.0;
            a.alive = false;
            a.deaths += 1;
            a.reload = 0.0;
            self.drop_core(idx);
            if let Some(s) = source
                && self.actors[s].squad != self.actors[idx].squad
            {
                self.actors[s].kills += 1;
                if part == "weakpoint" {
                    self.actors[s].headshots += 1;
                }
            }
            self.emit(
                "kill",
                json!({"actor":self.actors[idx].id,"source":source_id,"part":part}),
            );
        }
        true
    }
    pub fn drop_core(&mut self, idx: usize) -> bool {
        if self.core.carrier.as_deref() != Some(&self.actors[idx].id) {
            return false;
        }
        self.cancel_interaction();
        self.core.state = "dropped".into();
        self.core.carrier = None;
        self.core.x = self.actors[idx].pos.x;
        self.core.z = self.actors[idx].pos.z;
        self.core.progress = 0.0;
        self.emit(
            "core",
            json!({"state":"dropped","actor":self.actors[idx].id}),
        );
        true
    }
    fn cancel_interaction(&mut self) {
        if self.core.state == "planting" {
            self.core.state = "carried".into();
        }
        if self.core.state == "defusing" {
            self.core.state = "uploading".into();
        }
        self.core.interactor = None;
        self.core.progress = 0.0;
        self.core.origin = None;
    }
    pub fn interact(&mut self, idx: usize, dt: f64) {
        if self.config.mode != "core" || !self.actors[idx].alive {
            return;
        }
        let a = self.actors[idx].clone();
        let attack = a.squad == self.attack_squad;
        if self.core.interactor.as_ref().is_some_and(|id| *id != a.id) {
            return;
        }
        if matches!(self.core.state.as_str(), "available" | "dropped")
            && a.pos.distance(self.core.pos()) < 1.5
        {
            if attack {
                self.core.carrier = Some(a.id.clone());
                self.core.state = "carried".into();
                self.actors[idx].contribution += 10;
                self.emit("core", json!({"state":"carried","actor":a.id}));
            } else {
                self.core.progress += dt;
                self.core.interactor = Some(a.id.clone());
                if self.core.progress >= 1.5 {
                    let p = spawn(true, 0);
                    self.core.x = p.x;
                    self.core.z = p.z;
                    self.core.state = "available".into();
                    self.core.carrier = None;
                    self.core.progress = 0.0;
                    self.core.interactor = None;
                    self.actors[idx].contribution += 15;
                    self.emit("core", json!({"state":"reset","actor":a.id}));
                }
            }
            return;
        }
        let planting = attack
            && self.core.carrier.as_ref() == Some(&a.id)
            && matches!(self.core.state.as_str(), "carried" | "planting")
            && a.pos.distance(point(&data()["OBJECTIVE"])) < 2.1;
        let defusing = !attack && self.core.uploading() && a.pos.distance(self.core.pos()) < 2.1;
        if !planting && !defusing {
            if self.core.interactor.as_ref() == Some(&a.id) {
                self.cancel_interaction();
            }
            return;
        }
        if self.core.interactor.is_none() {
            self.core.interactor = Some(a.id.clone());
            self.core.origin = Some(a.pos);
            self.core.progress = 0.0;
            self.core.state = if planting { "planting" } else { "defusing" }.into();
            self.emit("interact", json!({"actor":a.id,"state":self.core.state}));
        }
        if a.pos.distance(self.core.origin.unwrap()) > 0.28 || a.y > 0.05 {
            self.cancel_interaction();
            return;
        }
        self.core.progress += dt;
        if self.core.progress >= 5.0 {
            if planting {
                self.core.state = "uploading".into();
                self.core.x = 6.0;
                self.core.z = 0.0;
                self.core.carrier = None;
                self.core.progress = 0.0;
                self.core.interactor = None;
                self.core.upload = 30.0;
                self.actors[idx].contribution += 100;
                self.emit("core", json!({"state":"uploading","actor":a.id}));
            } else {
                self.core.state = "defused".into();
                self.core.interactor = None;
                self.core.progress = 0.0;
                self.actors[idx].contribution += 150;
                self.emit("core", json!({"state":"defused","actor":a.id}));
                self.end_round(Some(a.squad), "数据核心已拆除");
            }
        }
    }
    fn update_objective(&mut self, dt: f64) {
        if let Some(idx) = self
            .actors
            .iter()
            .position(|a| Some(&a.id) == self.core.carrier.as_ref())
        {
            if self.actors[idx].alive {
                self.core.x = self.actors[idx].pos.x;
                self.core.z = self.actors[idx].pos.z;
            } else {
                self.drop_core(idx);
            }
        }
        if let Some(id) = &self.core.interactor
            && !self
                .actors
                .iter()
                .any(|a| &a.id == id && a.alive && a.input.interact)
        {
            self.cancel_interaction();
        }
        if matches!(self.core.state.as_str(), "available" | "dropped")
            && !walkable(self.core.pos(), 0.1)
        {
            let p = spawn(true, 0);
            self.core.x = p.x;
            self.core.z = p.z;
            self.core.state = "available".into();
            self.core.carrier = None;
            self.core.progress = 0.0;
            self.core.interactor = None;
            self.emit("core", json!({"state":"reset"}));
        }
        if self.core.uploading() {
            self.core.upload = (self.core.upload - dt).max(0.0);
            if self.core.upload == 0.0 {
                self.core.state = "completed".into();
                self.emit("core", json!({"state":"completed"}));
                self.end_round(Some(self.attack_squad), "数据上传完成");
            }
        }
    }
    fn order(&mut self, idx: usize, kind: &str) {
        let a = &self.actors[idx];
        let squad = a.squad;
        self.orders[squad] =
            Some(json!({"type":kind,"x":a.pos.x,"z":a.pos.z,"until":self.time+25.0}));
        self.emit(
            "order",
            json!({"actor":self.actors[idx].id,"squad":squad,"order":kind}),
        );
        for b in &mut self.actors {
            if b.squad == squad && b.bot {
                b.path_timer = 0.0;
                b.route_stage = 2;
            }
        }
    }
    fn find_cover(&self, a: &Actor, enemy: &Actor) -> Option<(Point, bool, f64)> {
        data()["BOXES"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|b| {
                let h = num(&b["h"]);
                let bp = point(b);
                if !(0.8..=3.5).contains(&h) || a.pos.distance(bp) > 7.0 {
                    return None;
                }
                let dx = bp.x - enemy.pos.x;
                let dz = bp.z - enemy.pos.z;
                let len = dx.hypot(dz).max(1e-9);
                let p = Point {
                    x: bp.x + dx / len * (num(&b["w"]) / 2.0 + 0.65),
                    z: bp.z + dz / len * (num(&b["d"]) / 2.0 + 0.65),
                };
                (walkable(p, 0.36) && !visible(enemy.pos, enemy.y, enemy.crouch, p, 0.0, h < 1.5))
                    .then_some((p, h < 1.5, self.time + 4.0))
            })
            .min_by(|a1, b1| a.pos.distance(a1.0).total_cmp(&a.pos.distance(b1.0)))
    }
    fn think(&mut self, idx: usize, dt: f64) {
        let mut a = self.actors[idx].clone();
        let d = &data()["DIFFICULTY"][&self.config.difficulty];
        let mut input = Input {
            yaw: a.yaw,
            pitch: a.pitch,
            ..Input::default()
        };
        let target = self
            .actors
            .iter()
            .filter(|b| {
                b.alive
                    && b.squad != a.squad
                    && a.pos.distance(b.pos) <= 28.0
                    && !self.obscured(&a, b)
                    && visible(a.pos, a.y, a.crouch, b.pos, b.y, b.crouch)
            })
            .filter(|b| {
                let angle = (-(b.pos.x - a.pos.x)).atan2(-(b.pos.z - a.pos.z));
                (angle - a.yaw).cos() > -0.15
                    || a.pos.distance(b.pos) < 3.0
                    || a.heard.is_some_and(|(_, until)| until > self.time)
            })
            .min_by(|b, c| a.pos.distance(b.pos).total_cmp(&a.pos.distance(c.pos)))
            .cloned();
        if let Some(t) = &target {
            if a.target.as_ref() != Some(&t.id) {
                a.target = Some(t.id.clone());
                a.reaction = num(&d["reaction"]) + num(&d["delay"]);
            }
            a.reaction -= dt;
            a.memory = Some((t.pos, self.time + 7.0));
            let tx = t.pos.x - a.pos.x;
            let tz = t.pos.z - a.pos.z;
            input.yaw = (-tx).atan2(-tz);
            input.pitch = ((if t.crouch { 0.95 } else { 1.3 }) + t.y
                - (if a.crouch { 1.07 } else { 1.57 })
                - a.y)
                .atan2(tx.hypot(tz));
            input.fire = a.reaction <= 0.0;
            input.aim = true;
            let dist = a.pos.distance(t.pos);
            input.forward = if dist < 3.0 {
                -0.45
            } else if dist > 12.0 {
                0.35
            } else {
                0.0
            };
            input.strafe = if (self.time * 1.5 + a.slot as f64 * 2.0).sin() > 0.45 {
                0.4
            } else {
                0.0
            };
            a.path.clear();
        } else {
            a.target = None;
            a.reaction = num(&d["reaction"]);
        }
        a.cover_check -= dt;
        if let Some(t) = &target
            && a.cover_check <= 0.0
        {
            a.cover_check = 2.0 + self.random() * 2.0;
            if a.hp < 45.0 || a.ammo[&a.weapon].mag < 5 {
                a.cover = self.find_cover(&a, t);
                if a.cover.is_some() {
                    self.emit("cover", json!({"actor":a.id}));
                }
            }
        }
        if let Some((goal, crouch, until)) = a.cover.filter(|(_, _, until)| *until > self.time) {
            if a.pos.distance(goal) < 0.45 {
                input.crouch = crouch;
                input.forward = 0.0;
                input.strafe = 0.0;
                if target.is_none() {
                    input.reload = true;
                }
            } else {
                a.path_timer -= dt;
                if a.path_timer <= 0.0 || a.path.is_empty() {
                    a.path = find_path(a.pos, goal);
                    a.path_timer = 0.7;
                }
                while a.path.first().is_some_and(|p| a.pos.distance(*p) < 0.2) {
                    a.path.remove(0);
                }
                if let Some(p) = a.path.first() {
                    let len = a.pos.distance(*p).max(1e-9);
                    let dx = (p.x - a.pos.x) / len;
                    let dz = (p.z - a.pos.z) / len;
                    input.forward = -dx * input.yaw.sin() - dz * input.yaw.cos();
                    input.strafe = dx * input.yaw.cos() - dz * input.yaw.sin();
                }
            }
            if a.ammo[&a.weapon].mag == 0 {
                input.reload = true;
            }
            a.cover = Some((goal, crouch, until));
            a.input = input;
            self.actors[idx] = a;
            return;
        }
        let attacking = a.squad == self.attack_squad;
        let mut goal = None;
        let mut urgent = false;
        if self.config.mode == "core" {
            if attacking && self.core.carrier.as_ref() == Some(&a.id) {
                goal = Some(point(&data()["OBJECTIVE"]));
                urgent = true;
                if a.pos.distance(goal.unwrap()) < 1.5 && target.is_none() {
                    input.interact = true;
                }
            } else if attacking && matches!(self.core.state.as_str(), "available" | "dropped") {
                goal = Some(self.core.pos());
                urgent = true;
                if a.pos.distance(self.core.pos()) < 1.4 {
                    input.interact = true;
                }
            } else if !attacking && self.core.uploading() {
                goal = Some(self.core.pos());
                urgent = true;
                if a.pos.distance(self.core.pos()) < 1.6 && target.is_none() {
                    input.interact = true;
                }
            } else if self.core.uploading() {
                goal = Some(Point {
                    x: 7.8,
                    z: if a.slot % 2 == 1 { 2.5 } else { -2.5 },
                });
            }
        }
        if let Some(order) = self.orders[a.squad]
            .as_ref()
            .filter(|o| !urgent && num(&o["until"]) > self.time)
        {
            let leader = self
                .actors
                .iter()
                .find(|b| b.squad == a.squad && !b.bot && b.alive);
            goal = Some(match text(&order["type"]) {
                "follow" if leader.is_some() => {
                    let p = leader.unwrap().pos;
                    Point {
                        x: p.x + (a.slot as f64 * 3.0).cos() * 1.5,
                        z: p.z + (a.slot as f64 * 3.0).sin() * 1.5,
                    }
                }
                "retreat" => spawn(attacking, a.slot),
                "attack" => point(&data()["OBJECTIVE"]),
                _ => point(order),
            });
        }
        if goal.is_none() {
            let routes = &data()["BOT_ROUTES"][if attacking { "attack" } else { "defense" }];
            let approach = routes["approach"][a.slot].as_array().unwrap();
            if a.route_stage < approach.len() {
                let p = point(&approach[a.route_stage]);
                goal = Some(p);
                if a.pos.distance(p) < 0.8 || self.elapsed > (a.route_stage + 1) as f64 * 18.0 {
                    a.route_stage += 1;
                }
            } else if let Some((p, _)) = a.memory.filter(|(_, until)| *until > self.time) {
                goal = Some(p);
            } else if let Some((p, _)) = a.heard.filter(|(_, until)| *until > self.time) {
                goal = Some(p);
            } else {
                let points = routes["patrol"].as_array().unwrap();
                let p = point(&points[a.patrol % points.len()]);
                goal = Some(p);
                if a.pos.distance(p) < 1.0 {
                    a.patrol += 1;
                }
            }
        }
        if input.interact {
            input.fire = false;
            input.forward = 0.0;
            input.strafe = 0.0;
            input.pitch = 0.0;
        } else if target.is_none()
            && let Some(goal) = goal
        {
            a.path_timer -= dt;
            if a.path_timer <= 0.0
                || a.path.is_empty()
                || a.goal.is_none_or(|p| p.distance(goal) > 1.5)
            {
                a.path = find_path(a.pos, goal);
                a.goal = Some(goal);
                a.path_timer = 0.9 + self.random() * 0.4;
            }
            while a.path.first().is_some_and(|p| a.pos.distance(*p) < 0.18) {
                a.path.remove(0);
            }
            if let Some(next) = a.path.first().filter(|_| a.pos.distance(goal) > 0.35) {
                input.yaw = (-(next.x - a.pos.x)).atan2(-(next.z - a.pos.z));
                input.pitch = 0.0;
                input.forward = 1.0;
            }
            if a.pos.distance(a.last_pos) < 0.02 && input.forward != 0.0 {
                a.stuck += dt;
            } else {
                a.stuck = 0.0;
            }
            if a.stuck > 1.2 {
                a.path_timer = 0.0;
                input.strafe = if a.slot % 2 == 1 { 1.0 } else { -1.0 };
                a.stuck = 0.0;
            }
            a.last_pos = a.pos;
        }
        let am = &a.ammo[&a.weapon];
        if am.mag == 0 || (am.mag < 5 && target.is_none()) {
            input.reload = true;
        }
        if am.mag == 0 && am.reserve == 0 {
            input.weapon = Some("pistol".into());
        }
        a.input = input;
        self.actors[idx] = a;
    }
    fn living(&self, squad: usize) -> usize {
        self.actors
            .iter()
            .filter(|a| a.squad == squad && a.alive)
            .count()
    }
    pub fn evaluate_elimination(&mut self) {
        let alive = [self.living(0), self.living(1)];
        if alive == [0, 0] {
            if !self.core.uploading() {
                self.end_round(None, "双方同时阵亡");
            }
            return;
        }
        for (squad, count) in alive.iter().enumerate() {
            if *count == 0 {
                if self.config.mode == "core" && squad == self.attack_squad && self.core.uploading()
                {
                    continue;
                }
                self.end_round(Some(1 - squad), "敌方队伍已被歼灭");
                return;
            }
        }
    }
    pub fn timeout(&mut self) {
        if self.config.mode == "core" {
            self.end_round(Some(1 - self.attack_squad), "时间耗尽，核心未完成上传");
            return;
        }
        let counts = [self.living(0), self.living(1)];
        if counts[0] != counts[1] {
            self.end_round(
                Some(if counts[0] > counts[1] { 0 } else { 1 }),
                "时间耗尽，比较存活人数",
            );
            return;
        }
        let hp: Vec<f64> = (0..2)
            .map(|s| {
                self.actors
                    .iter()
                    .filter(|a| a.alive && a.squad == s)
                    .map(|a| a.hp)
                    .sum()
            })
            .collect();
        if (hp[0] - hp[1]).abs() > 0.01 {
            self.end_round(
                Some(if hp[0] > hp[1] { 0 } else { 1 }),
                "时间耗尽，比较剩余生命",
            );
            return;
        }
        if !self.overtime {
            self.overtime = true;
            self.remaining = 15.0;
            self.emit("overtime", json!({}));
        } else {
            self.end_round(None, "加时结束，回合平局");
        }
    }
    pub fn end_round(&mut self, winner: Option<usize>, reason: &str) {
        if self.phase != "combat" && self.phase != "preparation" {
            return;
        }
        if let Some(s) = winner {
            self.scores[s] += 1;
        }
        let result = json!({"winner":winner,"reason":reason,"round":self.round});
        self.result = Some(result.clone());
        self.history.push(result.clone());
        self.phase = if self
            .scores
            .iter()
            .any(|s| *s >= num(&self.rules["wins"]) as u32)
        {
            "matchResult"
        } else {
            "roundResult"
        }
        .into();
        self.remaining = if self.phase == "roundResult" {
            6.0
        } else {
            0.0
        };
        self.cancel_interaction();
        let mut e = result;
        e["phase"] = json!(self.phase);
        self.emit("result", e);
    }
}
