mod game;
#[cfg(test)]
mod grenade_tests;
mod grenades;
mod physics;
mod server;
#[cfg(test)]
mod tests;
mod transport;

use std::{collections::HashSet, env, error::Error};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Resolve configuration within backend/, independently of the calling directory.
    let env_path = env::var_os("BACKEND_ENV_FILE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
            let beside_binary = env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.join(".env")));
            if source.exists() {
                source
            } else if let Some(path) = beside_binary.filter(|p| p.exists()) {
                path
            } else {
                std::path::PathBuf::from(".env")
            }
        });
    match dotenvy::from_path(env_path) {
        Ok(_) => {}
        Err(dotenvy::Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.into()),
    }
    let mode = env::var("APP_MODE").unwrap_or_else(|_| "local".into());
    if !["local", "lan", "public"].contains(&mode.as_str()) {
        return Err("APP_MODE 必须是 local、lan 或 public".into());
    }
    let host = env::var("HOST").unwrap_or_else(|_| {
        if mode == "local" {
            "127.0.0.1"
        } else {
            "0.0.0.0"
        }
        .into()
    });
    let port = env::var("PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse::<u16>()?;
    let origins = env::var("ALLOWED_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(server::normalize_origin)
        .collect::<Result<HashSet<_>, _>>()?;
    if mode == "public" && origins.is_empty() {
        return Err("公网模式需要配置 ALLOWED_ORIGINS，例如 https://game.example.com".into());
    }
    let listener = TcpListener::bind((host.as_str(), port)).await?;
    let mut app = server::App::new(origins, mode == "public");
    let udp = transport::start(&mut app).await?;
    let simulation = tokio::spawn(app.clone().simulate());
    println!(
        "Blackarms Rust backend [{mode}] → http://{} (/lan, /health)",
        listener.local_addr()?
    );
    let shutdown_app = app.clone();
    let result = axum::serve(listener, app.router())
        .with_graceful_shutdown(async move {
            shutdown().await;
            shutdown_app.close();
        })
        .await;
    simulation.abort();
    if let Some(udp) = udp {
        udp.abort();
    }
    result?;
    Ok(())
}
async fn shutdown() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).unwrap();
        tokio::select! {_=tokio::signal::ctrl_c()=>{},_=terminate.recv()=>{}}
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
