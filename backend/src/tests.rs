use crate::{
    game::{Config, Human, Match},
    physics::*,
    server::{InputQueue, normalize_origin},
};
use serde_json::json;
fn game(mode: &str) -> Match {
    let config = Config::parse(&json!({"mode":mode,"teamSize":1}));
    let humans = (0..2)
        .map(|s| Human {
            id: format!("human-{s}"),
            name: format!("Player {s}"),
            squad: s,
            primary: "rifle".into(),
            armor: "light".into(),
        })
        .collect::<Vec<_>>();
    Match::new(config, &humans, 4207)
}
fn near(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-9, "{a} != {b}");
}
#[test]
fn inputs_cannot_set_authoritative_fields() {
    let i = Input::parse(
        &json!({"forward":100,"strafe":-100,"pitch":9,"x":999,"hp":999,"weapon":"unknown","order":"unknown"}),
    );
    assert_eq!(i.forward, 1.0);
    assert_eq!(i.strafe, -1.0);
    assert_eq!(i.pitch, 1.4);
    assert!(i.weapon.is_none());
    assert!(i.order.is_none());
}
#[test]
fn queue_is_bounded_deduplicated_and_discardable() {
    let mut q = InputQueue::default();
    for seq in 1..=20 {
        q.push(&json!([{"sequence":seq,"input":{"forward":1}}]));
    }
    for _ in 0..12 {
        assert!(q.next().is_some());
    }
    assert!(q.next().is_none());
    assert_eq!(q.ack, 20);
    q.push(&json!([{"sequence":20,"input":{}}]));
    assert!(q.next().is_none());
    q.push(&json!([{"sequence":21,"input":{}}]));
    q.discard();
    assert_eq!(q.ack, 21);
    assert!(q.next().is_none());
}
#[test]
fn movement_matches_frontend_at_sixty_hz() {
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../tests/movement.json")).unwrap();
    for case in cases.as_array().unwrap() {
        let mut m = game("elimination");
        m.start_combat();
        m.actors[0].pos = Point { x: 6.0, z: 1.0 };
        let input = Input::parse(&case["input"]);
        for _ in 0..case["ticks"].as_u64().unwrap() {
            m.set_input("human-0", input.clone());
            m.step(STEP);
        }
        let a = &m.actors[0];
        near(a.pos.x, num(&case["expected"]["x"]));
        near(a.pos.z, num(&case["expected"]["z"]));
        near(a.y, num(&case["expected"]["y"]));
        near(a.vy, num(&case["expected"]["vy"]));
    }
}
#[test]
fn collision_navigation_and_sight_respect_walls() {
    for attack in [true, false] {
        for slot in [0, 1, 2, 3, 4] {
            let p = spawn(attack, slot);
            assert!(walkable(p, 0.36));
            assert!(!find_path(p, Point { x: 6.0, z: 0.0 }).is_empty());
        }
    }
    assert!(!walkable(Point { x: 40.0, z: 0.0 }, 0.29));
    assert!(!visible(
        Point { x: -12.0, z: 0.0 },
        0.0,
        false,
        Point { x: -10.0, z: 0.0 },
        0.0,
        false
    ));
}
#[test]
fn ready_loadout_and_round_lifecycle() {
    let mut m = game("elimination");
    m.set_loadout("human-0", "sniper", "heavy");
    assert_eq!(m.actors[0].weapon, "sniper");
    for s in 0..2 {
        m.set_input(&format!("human-{s}"), Input::parse(&json!({"ready":true})));
    }
    m.step(STEP);
    assert_eq!(m.phase, "combat");
    m.set_loadout("human-0", "smg", "light");
    assert_eq!(m.actors[0].weapon, "sniper");
    m.end_round(Some(0), "test");
    m.end_round(Some(0), "duplicate");
    assert_eq!(m.scores, [1, 0]);
    for _ in 0..361 {
        m.step(STEP);
    }
    assert_eq!(m.round, 2);
    assert_eq!(m.phase, "preparation");
    assert!(m.actors.iter().all(|a| a.alive && a.hp == 100.0));
}
#[test]
fn shooting_damage_armor_and_ammo_remain_authoritative() {
    let mut m = game("elimination");
    m.start_combat();
    m.actors[0].pos = Point { x: 6.0, z: 1.0 };
    m.actors[0].yaw = -std::f64::consts::FRAC_PI_2;
    m.actors[1].pos = Point { x: 8.0, z: 1.0 };
    m.actors[0].aim = true;
    let before = m.actors[0].ammo["rifle"].mag;
    assert!(m.shoot(0));
    assert_eq!(m.actors[0].ammo["rifle"].mag, before - 1);
    assert!(m.actors[1].hp < 100.0);
    assert!(!m.shoot(0));
    assert!(m.damage(1, 1000.0, Some(0), "weakpoint"));
    assert_eq!(m.actors[0].kills, 1);
    assert_eq!(m.actors[0].headshots, 1);
    assert!(!m.actors[1].alive);
    m.evaluate_elimination();
    assert_eq!(m.phase, "roundResult");
    assert_eq!(m.scores, [1, 0]);
}
#[test]
fn core_upload_continues_after_attackers_die() {
    let mut m = game("core");
    m.start_combat();
    m.actors[0].pos = Point { x: 6.0, z: 0.0 };
    for _ in 0..301 {
        m.interact(0, STEP);
    }
    assert_eq!(m.core.state, "uploading");
    m.damage(0, 1000.0, Some(1), "body");
    m.evaluate_elimination();
    assert_eq!(m.phase, "combat");
    for _ in 0..1801 {
        m.step(STEP);
    }
    assert_eq!(m.core.state, "completed");
    assert_eq!(m.scores, [1, 0]);
}
#[test]
fn core_interaction_cancels_on_movement_or_damage_and_can_be_defused() {
    let mut m = game("core");
    m.start_combat();
    m.actors[0].pos = Point { x: 6.0, z: 0.0 };
    m.interact(0, 1.0);
    assert_eq!(m.core.state, "planting");
    m.actors[0].pos.x += 0.3;
    m.interact(0, STEP);
    assert_eq!(m.core.state, "carried");
    m.actors[0].pos.x = 6.0;
    m.interact(0, 1.0);
    m.damage(0, 1.0, Some(1), "body");
    assert_eq!(m.core.state, "carried");
    for _ in 0..301 {
        m.interact(0, STEP);
    }
    m.actors[1].pos = Point { x: 6.0, z: 1.0 };
    for _ in 0..301 {
        m.interact(1, STEP);
    }
    assert_eq!(m.core.state, "defused");
    assert_eq!(m.scores, [0, 1]);
}
#[test]
fn overtime_and_match_victory() {
    let mut m = game("elimination");
    m.start_combat();
    m.timeout();
    assert!(m.overtime);
    m.timeout();
    assert_eq!(m.scores, [0, 0]);
    assert_eq!(m.phase, "roundResult");
    for _ in 0..3 {
        m.phase = "combat".into();
        m.end_round(Some(0), "win");
    }
    assert_eq!(m.phase, "matchResult");
}
#[test]
fn bots_complete_matches_without_clients() {
    for mode in ["elimination", "core"] {
        let mut m = Match::new(Config::parse(&json!({"mode":mode,"teamSize":1})), &[], 4207);
        for _ in 0..60 * 900 {
            m.step(STEP);
            if m.phase == "matchResult" {
                break;
            }
        }
        assert_eq!(m.phase, "matchResult", "mode {mode}");
    }
}
#[test]
fn snapshot_excludes_input_queues_and_pathfinding() {
    let m = game("core");
    let s = m.snapshot();
    let a = &s["actors"][0];
    assert!(a.get("input").is_none());
    assert!(a.get("path").is_none());
    assert_eq!(s["attackSquad"], 0);
    assert!(a["switchTime"].is_number());
}
#[test]
fn origin_configuration_is_explicit() {
    assert_eq!(
        normalize_origin("https://Game.Example/").unwrap(),
        "https://game.example"
    );
    for bad in [
        "null",
        "file:///tmp",
        "https://game.example/path",
        "https://user@game.example",
        "*",
    ] {
        assert!(normalize_origin(bad).is_err(), "{bad}");
    }
}
