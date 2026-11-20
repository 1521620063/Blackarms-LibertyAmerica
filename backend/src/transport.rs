use crate::server::{App, normalize_origin};
use std::{env, error::Error, sync::Arc, time::Duration};
use tokio::{sync::Semaphore, task::JoinHandle, time::timeout};
use wtransport::{Endpoint, Identity, ServerConfig, VarInt};

pub async fn start(app: &mut App) -> Result<Option<JoinHandle<()>>, Box<dyn Error>> {
    let Some(bind) = env::var_os("WEBTRANSPORT_BIND") else {
        return Ok(None);
    };
    if app.origins.is_empty() {
        return Err("WebTransport requires an explicit ALLOWED_ORIGINS list".into());
    }
    let identity = Identity::load_pemfiles(
        env::var("WEBTRANSPORT_CERT")?,
        env::var("WEBTRANSPORT_KEY")?,
    )
    .await?;
    let config = ServerConfig::builder()
        .with_bind_address(bind.to_str().ok_or("invalid WEBTRANSPORT_BIND")?.parse()?)
        .with_identity(identity)
        .max_idle_timeout(Some(Duration::from_secs(45)))?
        .keep_alive_interval(Some(Duration::from_secs(15)))
        .build();
    let endpoint = Endpoint::server(config)?;
    println!(
        "WebTransport UDP listener: {} (/poses)",
        endpoint.local_addr()?
    );
    app.udp = true;
    let app = app.clone();
    Ok(Some(tokio::spawn(async move {
        let limit = Arc::new(Semaphore::new(600));
        loop {
            let incoming = endpoint.accept().await;
            let Ok(permit) = limit.clone().try_acquire_owned() else {
                continue;
            };
            let app = app.clone();
            tokio::spawn(async move {
                let _permit = permit;
                let Ok(Ok(request)) = timeout(Duration::from_secs(5), incoming).await else {
                    return;
                };
                let allowed = request
                    .origin()
                    .and_then(|o| normalize_origin(o).ok())
                    .is_some_and(|o| app.origins.contains(&o));
                let poses = allowed
                    .then(|| request.path().strip_prefix("/poses?ticket="))
                    .flatten()
                    .and_then(|ticket| app.take_pose_ticket(ticket));
                let Some(mut poses) = poses else {
                    request.forbidden().await;
                    return;
                };
                let Ok(Ok(connection)) = timeout(Duration::from_secs(5), request.accept()).await
                else {
                    return;
                };
                loop {
                    tokio::select! {
                        _ = connection.closed() => break,
                        change = poses.changed() => {
                            if change.is_err() { break; }
                            let packet = poses.borrow_and_update().clone();
                            if let Some(packet) = packet.filter(|p| connection.max_datagram_size().is_some_and(|n| p.len() <= n)) {
                                // A congested buffer must not block newer game snapshots.
                                let _ = connection.send_datagram(packet.as_ref());
                            }
                        }
                    }
                }
                connection.close(VarInt::from_u32(0), b"game session closed");
            });
        }
    })))
}
