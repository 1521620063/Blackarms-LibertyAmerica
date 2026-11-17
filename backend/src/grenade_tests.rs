use crate::{
    game::{Config, Human, Match, Projectile},
    physics::*,
};
use serde_json::json;

fn fixture() -> Match {
    let humans = (0..2)
        .map(|s| Human {
            id: format!("human-{s}"),
            name: format!("Player {s}"),
            squad: s,
            primary: "rifle".into(),
            armor: "light".into(),
        })
        .collect::<Vec<_>>();
    let mut m = Match::new(Config::parse(&json!({"teamSize":1})), &humans, 4207);
    m.start_combat();
    m.actors[0].pos = Point { x: 6.0, z: 1.0 };
    m.actors[0].yaw = -std::f64::consts::FRAC_PI_2;
    m.actors[1].pos = Point { x: 8.0, z: 1.0 };
    m.actors[1].yaw = std::f64::consts::FRAC_PI_2;
    m.actors[1].hp = 1000.0;
    m
}
fn detonate(m: &mut Match, kind: &str, x: f64, y: f64, z: f64) {
    m.projectile_id += 1;
    m.projectiles.push(Projectile {
        id: m.projectile_id,
        actor: "human-0".into(),
        weapon: kind.into(),
        x,
        y,
        z,
        vx: 0.0,
        vy: 0.0,
        vz: 0.0,
        fuse: 0.0,
    });
    m.update_grenades(0.01);
}
#[test]
fn throwables_use_authoritative_inventory_fuse_and_wall_collision() {
    for kind in ["grenade", "smoke", "flash"] {
        let mut m = fixture();
        m.actors[0].weapon = kind.into();
        m.actors[0].pos = Point { x: -12.0, z: 0.0 };
        assert!(!primary(kind));
        assert!(Input::parse(&json!({"weapon":kind})).weapon.is_some());
        assert!(m.shoot(0));
        assert!(!m.shoot(0));
        assert_eq!(
            m.actors[0].ammo[kind].mag,
            weapon(kind)["mag"].as_i64().unwrap() - 1
        );
        for _ in 0..20 {
            m.update_grenades(0.01);
        }
        assert!(m.projectiles[0].x < -11.2);
        assert!(m.projectiles[0].vx < 0.0);
        assert!(!m.events.iter().any(|e| e["type"] == "detonate"));
        for _ in 0..250 {
            m.update_grenades(0.01);
        }
        assert!(m.projectiles.is_empty());
        assert!(m.events.iter().any(|e| e["type"] == "detonate"));
        assert!(!m.events.iter().any(|e| e["type"] == "shot"));
    }
}
#[test]
fn fragmentation_respects_walls_friendlies_falloff_and_kill_credit() {
    let mut close = fixture();
    detonate(&mut close, "grenade", 7.8, 1.5, 1.0);
    assert!(close.actors[1].hp < 900.0);
    assert_eq!(close.actors[0].hp, 100.0);
    assert!(close.actors[0].damage > 100.0);
    let mut far = fixture();
    detonate(&mut far, "grenade", 5.0, 1.5, 1.0);
    assert!(far.actors[1].hp > close.actors[1].hp);
    let mut blocked = fixture();
    blocked.actors[1].pos = Point { x: -10.0, z: 0.0 };
    detonate(&mut blocked, "grenade", -12.0, 1.5, 0.0);
    assert_eq!(blocked.actors[1].hp, 1000.0);
    let mut lethal = fixture();
    lethal.actors[1].hp = 50.0;
    detonate(&mut lethal, "grenade", 7.8, 1.5, 1.0);
    assert_eq!(lethal.actors[0].kills, 1);
    assert_eq!(lethal.actors[0].headshots, 0);
    assert!(!lethal.actors[1].alive);
}
#[test]
fn smoke_and_flash_obscure_sight_without_damage_and_expire() {
    let mut m = fixture();
    detonate(&mut m, "smoke", 7.0, 1.0, 1.0);
    assert_eq!(m.smokes.len(), 1);
    assert!(m.obscured(&m.actors[0], &m.actors[1]));
    assert_eq!(m.actors[1].hp, 1000.0);
    detonate(&mut m, "flash", 7.0, 1.5, 1.0);
    assert_eq!(m.actors[1].flash, 0.0);
    m.update_grenades(14.1);
    assert!(m.smokes.is_empty());
    assert!(!m.obscured(&m.actors[0], &m.actors[1]));
    detonate(&mut m, "flash", 7.0, 1.5, 1.0);
    let front = m.actors[1].flash;
    assert!(front > 3.0);
    assert!(m.obscured(&m.actors[1], &m.actors[0]));
    assert_eq!(m.actors[1].hp, 1000.0);
    m.update_grenades(5.0);
    m.actors[1].yaw = -std::f64::consts::FRAC_PI_2;
    detonate(&mut m, "flash", 7.0, 1.5, 1.0);
    assert!(m.actors[1].flash < front * 0.3);
    m.update_grenades(5.0);
    m.actors[1].pos = Point { x: -10.0, z: 0.0 };
    detonate(&mut m, "flash", -12.0, 1.5, 0.0);
    assert_eq!(m.actors[1].flash, 0.0);
}
