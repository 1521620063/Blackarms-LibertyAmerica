use crate::{
    game::{Config, Human, Match},
    physics::{Input, STEP, primary},
};
use axum::{
    Json, Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
};
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, HashSet, VecDeque},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::mpsc;

#[cfg(test)]
#[path = "server_tests.rs"]
mod tests;

fn token(bytes: usize) -> String {
    (0..bytes)
        .map(|_| format!("{:02x}", rand::random::<u8>()))
        .collect()
}
#[derive(Default)]
pub struct InputQueue {
    frames: VecDeque<(u64, Input)>,
    pub received: u64,
    pub ack: u64,
    pub enabled: bool,
}
impl InputQueue {
    pub fn push(&mut self, value: &Value) {
        let Some(frames) = value.as_array().filter(|v| v.len() <= 6) else {
            return;
        };
        for f in frames {
            let Some(seq) = f["sequence"]
                .as_u64()
                .filter(|s| *s > self.received && *s <= 9_007_199_254_740_991)
            else {
                continue;
            };
            if !f["input"].is_object() {
                continue;
            }
            self.enabled = true;
            self.received = seq;
            self.frames.push_back((seq, Input::parse(&f["input"])));
        }
        while self.frames.len() > 12 {
            self.frames.pop_front();
        }
    }
    pub fn next(&mut self) -> Option<Input> {
        self.frames.pop_front().map(|(seq, input)| {
            self.ack = seq;
            input
        })
    }
    pub fn discard(&mut self) {
        self.frames.clear();
        self.ack = self.received;
    }
}
struct Peer {
    human: Human,
    tx: mpsc::Sender<String>,
    code: Option<String>,
    last: Instant,
    last_input: Instant,
    window: Instant,
    messages: u32,
    queue: InputQueue,
}
struct Room {
    code: String,
    host: String,
    config: Config,
    members: Vec<String>,
    game: Option<Match>,
    session: String,
}
#[derive(Default)]
struct Hub {
    peers: BTreeMap<String, Peer>,
    rooms: BTreeMap<String, Room>,
    ticks: u64,
}
impl Hub {
    fn send(&self, id: &str, message: Value) {
        if let Some(p) = self.peers.get(id) {
            let _ = p.tx.try_send(message.to_string());
        }
    }
    fn broadcast(&self, room: &Room, message: Value) {
        let message = message.to_string();
        for id in &room.members {
            if let Some(p) = self.peers.get(id) {
                let _ = p.tx.try_send(message.clone());
            }
        }
    }
    fn roster(&self, room: &Room) -> Value {
        json!({"type":"lobby","code":room.code,"host":room.host,"config":room.config,"players":room.members.iter().filter_map(|id|self.peers.get(id).map(|p|&p.human)).collect::<Vec<_>>(),"started":room.game.is_some()})
    }
    fn room_list(&self) -> Value {
        let mut rooms = self.rooms.values().collect::<Vec<_>>();
        rooms.sort_by_key(|room| {
            (
                room.members.len() >= room.config.team_size * 2,
                room.game.is_some(),
            )
        });
        json!({"type":"rooms","rooms":rooms.iter().map(|room| json!({
            "code":room.code,
            "hostName":self.peers[&room.host].human.name,
            "mode":room.config.mode,
            "teamSize":room.config.team_size,
            "players":room.members.len(),
            "capacity":room.config.team_size * 2,
            "phase":room.game.as_ref().map_or("lobby", |game| game.phase.as_str()),
        })).collect::<Vec<_>>()})
    }
    fn snapshot(&self, room: &Room) -> Value {
        let mut v = room.game.as_ref().unwrap().snapshot();
        v["session"] = json!(room.session);
        v["inputAcks"] = json!(
            room.members
                .iter()
                .filter_map(|id| self.peers.get(id).map(|p| (id.clone(), p.queue.ack)))
                .collect::<BTreeMap<_, _>>()
        );
        v
    }
    fn leave(&mut self, id: &str) {
        let Some(code) = self.peers.get_mut(id).and_then(|p| p.code.take()) else {
            return;
        };
        let Some(mut room) = self.rooms.remove(&code) else {
            return;
        };
        room.members.retain(|p| p != id);
        if let Some(a) = room
            .game
            .as_mut()
            .and_then(|g| g.actors.iter_mut().find(|a| a.id == id))
        {
            a.bot = true;
            a.waiting = false;
            a.input = Input::default();
            a.ready = true;
            a.name = format!("{} / AI", a.name);
        }
        if room.members.is_empty() {
            return;
        }
        if room.host == id {
            room.host = room.members[0].clone();
        }
        self.broadcast(&room, self.roster(&room));
        self.rooms.insert(code, room);
    }
    fn remove(&mut self, id: &str) {
        self.leave(id);
        self.peers.remove(id);
    }
    fn message(&mut self, id: &str, msg: &Value) -> Result<(), &'static str> {
        let kind = msg["type"].as_str().ok_or("消息格式无效")?;
        if kind == "ping" {
            self.send(id, json!({"type":"pong","sent":msg["sent"]}));
            return Ok(());
        }
        if kind == "list" {
            self.send(id, self.room_list());
            return Ok(());
        }
        if kind == "leave" {
            self.leave(id);
            return Ok(());
        }
        if kind == "create" || kind == "join" {
            let name = match msg.get("name") {
                None => "先锋",
                Some(value) => value.as_str().ok_or("呼号格式无效")?,
            };
            if name.trim_matches(' ').is_empty() {
                return Err("请输入呼号。");
            }
            if name.chars().take(21).count() > 20 {
                return Err("呼号最多 20 个字符。");
            }
            if name.starts_with(' ')
                || name.ends_with(' ')
                || !name.chars().all(|c| c.is_alphanumeric() || c == ' ')
            {
                return Err("呼号只能包含汉字、字母、数字和中间的空格。");
            }
            if kind == "create" && self.rooms.len() >= 100 {
                return Err("房间数量已满");
            }
            let code = if kind == "create" {
                let mut code = token(3).to_uppercase();
                while self.rooms.contains_key(&code) {
                    code = token(3).to_uppercase();
                }
                code
            } else {
                msg["code"].as_str().unwrap_or("").trim().to_uppercase()
            };
            if kind == "join" {
                let room = self
                    .rooms
                    .get(&code)
                    .ok_or("房间不存在，请检查房间码和服务器地址")?;
                if self.peers.get(id).and_then(|p| p.code.as_deref()) == Some(code.as_str()) {
                    self.send(id, self.roster(room));
                    return Ok(());
                }
                if room.members.len() >= room.config.team_size * 2 {
                    return Err("房间已满");
                }
            }
            self.leave(id);
            if kind == "create" {
                self.rooms.insert(
                    code.clone(),
                    Room {
                        code: code.clone(),
                        host: id.into(),
                        config: Config::parse(&msg["config"]),
                        members: vec![],
                        game: None,
                        session: String::new(),
                    },
                );
            }
            let mut room = self.rooms.remove(&code).unwrap();
            let count0 = room
                .members
                .iter()
                .filter(|id| self.peers[*id].human.squad == 0)
                .count();
            let count1 = room.members.len() - count0;
            let p = self.peers.get_mut(id).unwrap();
            p.code = Some(code.clone());
            p.human.name = name.into();
            p.human.squad = room
                .game
                .as_ref()
                .and_then(|game| game.actors.iter().find(|a| a.bot && a.id == id))
                .map_or(if count0 <= count1 { 0 } else { 1 }, |a| a.squad);
            p.human.primary = room.config.primary.clone();
            p.human.armor = room.config.armor.clone();
            p.queue = InputQueue::default();
            if let Some(game) = &mut room.game {
                game.take_over_bot(&p.human);
                let actor = game.actors.iter().find(|a| a.id == id).unwrap();
                p.human.primary.clone_from(&actor.primary);
                p.human.armor.clone_from(&actor.armor);
            }
            room.members.push(id.into());
            self.broadcast(&room, self.roster(&room));
            if room.game.is_some() {
                self.send(
                    id,
                    json!({"type":"started","state":self.snapshot(&room),"lateJoin":true}),
                );
            }
            self.rooms.insert(code, room);
            return Ok(());
        }
        let code = self
            .peers
            .get(id)
            .and_then(|p| p.code.clone())
            .ok_or("请先创建或加入房间")?;
        let mut room = self.rooms.remove(&code).ok_or("房间不存在")?;
        // Reinsert the room even when a command fails.
        let result = (|| {
            match kind {
                "team" if room.game.is_none() => {
                    let squad = if msg["squad"] == 1 { 1 } else { 0 };
                    if room
                        .members
                        .iter()
                        .filter(|p| p.as_str() != id && self.peers[*p].human.squad == squad)
                        .count()
                        >= room.config.team_size
                    {
                        return Err("该队伍已满");
                    }
                    self.peers.get_mut(id).unwrap().human.squad = squad;
                    self.broadcast(&room, self.roster(&room));
                }
                "start" => {
                    if room.host != id {
                        return Err("只有房主可以开始比赛");
                    }
                    if room.game.as_ref().is_some_and(|g| g.phase != "matchResult") {
                        return Err("比赛正在进行");
                    }
                    let humans = room
                        .members
                        .iter()
                        .map(|id| self.peers[id].human.clone())
                        .collect::<Vec<_>>();
                    room.game = Some(Match::new(room.config.clone(), &humans, 4207));
                    room.session = token(8);
                    for id in &room.members {
                        self.peers.get_mut(id).unwrap().queue = InputQueue::default();
                    }
                    self.broadcast(
                        &room,
                        json!({"type":"started","state":self.snapshot(&room)}),
                    );
                }
                "input" => {
                    if let Some(game) = &mut room.game {
                        let peer = self.peers.get_mut(id).unwrap();
                        if msg["frames"].is_array() {
                            if msg["session"] == room.session
                                && msg["round"].as_u64() == Some(game.round as u64)
                            {
                                let received = peer.queue.received;
                                peer.queue.push(&msg["frames"]);
                                if peer.queue.received != received {
                                    peer.last_input = Instant::now();
                                }
                            }
                        } else if !peer.queue.enabled {
                            game.set_input(id, Input::parse(&msg["input"]));
                            peer.last_input = Instant::now();
                        }
                    }
                }
                "loadout" => {
                    let w = msg["primary"]
                        .as_str()
                        .filter(|w| primary(w))
                        .unwrap_or("rifle");
                    let armor = if msg["armor"] == "heavy" {
                        "heavy"
                    } else {
                        "light"
                    };
                    let p = self.peers.get_mut(id).unwrap();
                    p.human.primary = w.into();
                    p.human.armor = armor.into();
                    if let Some(game) = &mut room.game {
                        game.set_loadout(id, w, armor);
                    }
                    self.broadcast(&room, self.roster(&room));
                }
                _ => {}
            }
            Ok(())
        })();
        self.rooms.insert(code, room);
        result
    }
    fn tick(&mut self) {
        self.ticks += 1;
        for room in self.rooms.values_mut() {
            if let Some(game) = &mut room.game {
                let round = game.round;
                for id in &room.members {
                    let peer = self.peers.get_mut(id).unwrap();
                    if peer.queue.enabled {
                        let frame = peer.queue.next();
                        if let Some(a) = game.actors.iter_mut().find(|a| &a.id == id) {
                            a.waiting = frame.is_none();
                        }
                        if let Some(input) = frame {
                            game.set_input(id, input);
                        }
                    }
                }
                game.step(STEP);
                if game.round != round {
                    for id in &room.members {
                        self.peers.get_mut(id).unwrap().queue.discard();
                    }
                }
            }
        }
    }
    fn maintain(&mut self) {
        let now = Instant::now();
        let expired = self
            .peers
            .iter()
            .filter(|(_, p)| now.duration_since(p.last) > Duration::from_secs(30))
            .map(|(id, _)| id.clone())
            .collect::<Vec<_>>();
        for id in expired {
            self.remove(&id);
        }
        for (id, peer) in &mut self.peers {
            if now.duration_since(peer.last_input) > Duration::from_millis(1200) {
                peer.queue.discard();
                if let Some(game) = peer
                    .code
                    .as_ref()
                    .and_then(|c| self.rooms.get_mut(c))
                    .and_then(|r| r.game.as_mut())
                {
                    game.set_input(id, Input::default());
                }
            }
        }
    }
    fn broadcast_states(&self) {
        for room in self.rooms.values().filter(|r| r.game.is_some()) {
            self.broadcast(room, json!({"type":"state","state":self.snapshot(room)}));
        }
    }
}
#[derive(Clone)]
pub struct App {
    hub: Arc<Mutex<Hub>>,
    pub origins: HashSet<String>,
    pub public: bool,
}
pub fn normalize_origin(value: &str) -> Result<String, String> {
    if value.contains('#') {
        return Err(format!("Origin 不能包含片段: {value}"));
    }
    let uri = value
        .parse::<Uri>()
        .map_err(|_| format!("无效 Origin: {value}"))?;
    let scheme = uri
        .scheme_str()
        .filter(|s| *s == "http" || *s == "https")
        .ok_or_else(|| format!("Origin 必须使用 http/https: {value}"))?;
    let host = uri
        .authority()
        .filter(|a| !a.as_str().contains('@'))
        .ok_or_else(|| format!("无效 Origin: {value}"))?;
    if uri.path_and_query().is_some_and(|p| p.as_str() != "/") {
        return Err(format!("Origin 不能包含路径或查询: {value}"));
    }
    let hostname = host.host();
    if hostname.is_empty() {
        return Err(format!("无效 Origin: {value}"));
    }
    let suffix = &host.as_str()[hostname.len()..];
    let port = if suffix.is_empty() {
        None
    } else {
        Some(
            suffix
                .strip_prefix(':')
                .and_then(|s| s.parse::<u16>().ok())
                .ok_or_else(|| format!("无效 Origin 端口: {value}"))?,
        )
    };
    let authority = match port {
        Some(80) if scheme == "http" => hostname.to_string(),
        Some(443) if scheme == "https" => hostname.to_string(),
        Some(port) => format!("{hostname}:{port}"),
        None => hostname.to_string(),
    };
    Ok(format!("{scheme}://{authority}").to_lowercase())
}
impl App {
    pub fn new(origins: HashSet<String>, public: bool) -> Self {
        Self {
            hub: Arc::new(Mutex::new(Hub::default())),
            origins,
            public,
        }
    }
    pub fn router(self) -> Router {
        Router::new()
            .route("/health", get(health))
            .route("/lan", get(upgrade))
            .with_state(self)
    }
    pub fn close(&self) {
        let mut hub = self.hub.lock().unwrap();
        hub.rooms.clear();
        hub.peers.clear();
    }
    pub async fn simulate(self) {
        let mut interval = tokio::time::interval(Duration::from_secs_f64(STEP));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut last = Instant::now();
        let mut accumulator = 0.0;
        loop {
            interval.tick().await;
            let now = Instant::now();
            accumulator += now.duration_since(last).as_secs_f64().min(0.25);
            last = now;
            let mut hub = self.hub.lock().unwrap();
            hub.maintain();
            let before = hub.ticks / 3;
            while accumulator + 1e-9 >= STEP {
                hub.tick();
                accumulator -= STEP;
            }
            if hub.ticks / 3 != before {
                hub.broadcast_states();
            }
        }
    }
}
async fn health(State(app): State<App>) -> impl IntoResponse {
    (
        [(axum::http::header::CACHE_CONTROL, "no-store")],
        Json(json!({"status":"ok","rooms":app.hub.lock().unwrap().rooms.len()})),
    )
}
async fn upgrade(State(app): State<App>, headers: HeaderMap, ws: WebSocketUpgrade) -> Response {
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| normalize_origin(v).ok());
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    let allowed = origin.as_ref().is_some_and(|o| {
        app.origins.contains(o)
            || (!app.public
                && o.split_once("://").is_some_and(|(scheme, _)| {
                    normalize_origin(&format!("{scheme}://{host}")).as_ref() == Ok(o)
                }))
    });
    if !allowed {
        return (StatusCode::FORBIDDEN, "Frontend origin is not allowed").into_response();
    }
    if app.hub.lock().unwrap().peers.len() >= 600 {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    ws.max_message_size(4096)
        .max_frame_size(4096)
        .on_upgrade(move |socket| connection(app, socket))
}
async fn connection(app: App, socket: WebSocket) {
    let id = token(6);
    let (tx, mut rx) = mpsc::channel::<String>(32);
    let now = Instant::now();
    {
        let mut hub = app.hub.lock().unwrap();
        hub.peers.insert(
            id.clone(),
            Peer {
                human: Human {
                    id: id.clone(),
                    name: "先锋".into(),
                    squad: 0,
                    primary: "rifle".into(),
                    armor: "light".into(),
                },
                tx,
                code: None,
                last: now,
                last_input: now,
                window: now,
                messages: 0,
                queue: InputQueue::default(),
            },
        );
        hub.send(&id, json!({"type":"hello","id":id}));
    }
    let (mut sink, mut stream) = socket.split();
    let writer = async {
        while let Some(msg) = rx.recv().await {
            if !matches!(
                tokio::time::timeout(Duration::from_secs(5), sink.send(Message::Text(msg.into())))
                    .await,
                Ok(Ok(()))
            ) {
                break;
            }
        }
    };
    let reader = async {
        while let Some(Ok(message)) = stream.next().await {
            if matches!(message, Message::Close(_)) {
                break;
            }
            let Message::Text(raw) = message else {
                continue;
            };
            let mut hub = app.hub.lock().unwrap();
            let Some(peer) = hub.peers.get_mut(&id) else {
                break;
            };
            let now = Instant::now();
            if now.duration_since(peer.window) > Duration::from_secs(1) {
                peer.window = now;
                peer.messages = 0;
            }
            peer.messages += 1;
            if peer.messages > 100 {
                continue;
            }
            match serde_json::from_str::<Value>(&raw) {
                Ok(msg) if msg.is_object() => {
                    peer.last = now;
                    if let Err(error) = hub.message(&id, &msg) {
                        hub.send(&id, json!({"type":"error","message":error}));
                    }
                }
                _ => hub.send(&id, json!({"type":"error","message":"消息格式无效"})),
            }
        }
    };
    tokio::select! {_=writer=>{},_=reader=>{}}
    app.hub.lock().unwrap().remove(&id);
}
