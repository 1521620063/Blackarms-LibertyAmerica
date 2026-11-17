use super::*;

fn hub_with_peers(ids: &[&str]) -> Hub {
    let mut hub = Hub::default();
    for id in ids {
        let (tx, _) = mpsc::channel(32);
        let now = Instant::now();
        hub.peers.insert(
            (*id).into(),
            Peer {
                human: Human {
                    id: (*id).into(),
                    name: (*id).into(),
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
    }
    hub
}

#[test]
fn joining_current_room_is_idempotent_even_when_full() {
    let mut hub = hub_with_peers(&["host", "guest"]);
    hub.message(
        "host",
        &json!({"type":"create","name":"Host","config":{"teamSize":1}}),
    )
    .unwrap();
    let code = hub.peers["host"].code.clone().unwrap();
    hub.message(
        "host",
        &json!({"type":"join","code":code,"name":"Replacement"}),
    )
    .unwrap();
    assert_eq!(hub.rooms[&code].members, ["host"]);
    assert_eq!(hub.peers["host"].human.name, "Host");
    hub.message("guest", &json!({"type":"join","code":code}))
        .unwrap();
    hub.message("host", &json!({"type":"join","code":code}))
        .unwrap();
    assert_eq!(hub.rooms[&code].members, ["host", "guest"]);
    assert_eq!(hub.rooms[&code].host, "host");
    hub.message("host", &json!({"type":"start"})).unwrap();
    assert_eq!(
        hub.rooms[&code]
            .game
            .as_ref()
            .unwrap()
            .actors
            .iter()
            .filter(|a| !a.bot)
            .count(),
        2
    );
}

#[test]
fn five_vs_five_limits_teams_and_room_capacity() {
    let ids = [
        "host", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "extra",
    ];
    let mut hub = hub_with_peers(&ids);
    hub.message("host", &json!({"type":"create","config":{"teamSize":5}}))
        .unwrap();
    let code = hub.peers["host"].code.clone().unwrap();
    for id in &ids[1..10] {
        hub.message(id, &json!({"type":"join","code":code}))
            .unwrap();
    }
    assert_eq!(hub.rooms[&code].config.team_size, 5);
    for squad in 0..2 {
        assert_eq!(
            ids[..10]
                .iter()
                .filter(|id| hub.peers[**id].human.squad == squad)
                .count(),
            5
        );
    }
    let other_squad = 1 - hub.peers["host"].human.squad;
    assert_eq!(
        hub.message("host", &json!({"type":"team","squad":other_squad})),
        Err("该队伍已满")
    );
    assert_eq!(
        hub.message("extra", &json!({"type":"join","code":code})),
        Err("房间已满")
    );
    hub.message("host", &json!({"type":"start"})).unwrap();
    let game = hub.rooms[&code].game.as_ref().unwrap();
    assert_eq!(game.actors.len(), 10);
    assert!(game.actors.iter().all(|a| !a.bot));
}

#[test]
fn heartbeats_do_not_keep_abandoned_inputs_active() {
    let mut hub = hub_with_peers(&["host"]);
    hub.message("host", &json!({"type":"create","config":{"teamSize":1}}))
        .unwrap();
    let code = hub.peers["host"].code.clone().unwrap();
    hub.message("host", &json!({"type":"start"})).unwrap();
    hub.message(
        "host",
        &json!({"type":"input","input":{"forward":1,"fire":true,"interact":true}}),
    )
    .unwrap();
    hub.peers.get_mut("host").unwrap().last_input = Instant::now() - Duration::from_secs(2);
    hub.message("host", &json!({"type":"ping","sent":123}))
        .unwrap();
    hub.maintain();
    let input = &hub.rooms[&code].game.as_ref().unwrap().actors[0].input;
    assert_eq!(input.forward, 0.0);
    assert!(!input.fire && !input.interact);
    assert!(
        hub.peers.contains_key("host"),
        "an active heartbeat should keep the connection alive"
    );
    hub.message("host", &json!({"type":"input","input":{"forward":1}}))
        .unwrap();
    hub.maintain();
    assert_eq!(
        hub.rooms[&code].game.as_ref().unwrap().actors[0]
            .input
            .forward,
        1.0
    );
}

#[test]
fn origins_normalize_default_ports_and_reject_invalid_authorities() {
    assert_eq!(
        normalize_origin("https://GAME.example:443/").unwrap(),
        "https://game.example"
    );
    assert_eq!(
        normalize_origin("http://game.example:80").unwrap(),
        "http://game.example"
    );
    assert_eq!(
        normalize_origin("https://game.example:8443").unwrap(),
        "https://game.example:8443"
    );
    assert_eq!(
        normalize_origin("https://[::1]:443").unwrap(),
        "https://[::1]"
    );
    for origin in [
        "https://game.example:bad",
        "https://game.example:99999",
        "https://game.example/path",
        "https://user@game.example",
        "https://game.example#fragment",
    ] {
        assert!(
            normalize_origin(origin).is_err(),
            "accepted invalid origin: {origin}"
        );
    }
}
