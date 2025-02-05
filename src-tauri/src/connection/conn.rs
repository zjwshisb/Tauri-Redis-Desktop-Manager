use crate::{
    connection::{CValue, Node},
    err::CusError,
    model::Command,
    ssh::{self, SshProxy},
    utils,
};
use chrono::prelude::*;
use redis::cluster::{ClusterClient, ClusterConnection as RedisSyncClusterConnection};
use redis::cluster_async::ClusterConnection;
use redis::Arg;
use redis::Client;
use redis::Connection as RedisSyncConnection;
use redis::FromRedisValue;
use redis::{
    aio::{ConnectionLike, MultiplexedConnection},
    AsyncConnectionConfig,
};

use redis::aio::Monitor;
use ssh_jumper::model::SshForwarderEnd;
use std::net::SocketAddr;
use tokio::sync::oneshot::Receiver;

#[derive(Clone, Debug)]
pub struct ConnectedParam {
    pub tcp_host: String,
    pub tcp_port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl redis::IntoConnectionInfo for ConnectedParam {
    fn into_connection_info(self) -> redis::RedisResult<redis::ConnectionInfo> {
        Ok(redis::ConnectionInfo {
            addr: redis::ConnectionAddr::Tcp(self.tcp_host.clone(), self.tcp_port),
            redis: redis::RedisConnectionInfo {
                db: 0,
                username: self.username,
                password: self.password,
                protocol: redis::ProtocolVersion::RESP2,
            },
        })
    }
}

#[derive(Clone, Debug)]
pub struct ConnectionParams {
    pub redis_params: ConnectedParam,
    pub ssh_params: Option<ssh::SshParams>,
    pub is_cluster: bool,
}

pub trait Connectable {
    fn get_params(&self) -> ConnectionParams;
}

pub struct Connection {
    pub params: ConnectionParams,
    pub cancel_tunnel_rx: Option<Receiver<SshForwarderEnd>>,
    pub tunnel_addr: Option<SocketAddr>,
}

impl SshProxy for Connection {
    fn store_addr(&mut self, addr: SocketAddr, rx: Receiver<SshForwarderEnd>) {
        self.cancel_tunnel_rx = Some(rx);
        self.tunnel_addr = Some(addr);
    }
    fn get_ssh_config(&self) -> Option<ssh::SshParams> {
        self.params.ssh_params.clone()
    }
    fn close_tunnel(&mut self) {
        if let Some(mut rx) = self.cancel_tunnel_rx.take() {
            rx.close();
        }
    }
}
impl Connectable for Connection {
    fn get_params(&self) -> ConnectionParams {
        self.params.clone()
    }
}
impl Drop for Connection {
    fn drop(&mut self) {
        self.close_tunnel();
    }
}
impl Connection {
    pub fn new(params: ConnectionParams) -> Self {
        Self {
            params,
            cancel_tunnel_rx: None,
            tunnel_addr: None,
        }
    }
    // get the ssl proxy
    pub fn get_proxy(&self) -> Option<String> {
        if let Some(addr) = self.tunnel_addr {
            return Some(format!("{}:{}", addr.ip(), addr.port()));
        }
        None
    }
    // the server is cluster or not
    pub fn is_cluster(&self) -> bool {
        self.params.is_cluster
    }
    // get the connection host
    pub fn get_host(&self) -> String {
        format!(
            "redis://{}:{}",
            self.params.redis_params.tcp_host.clone(),
            self.params.redis_params.tcp_port
        )
    }
    // get the redis params
    // if proxy set
    // host/port will be replaced
    pub fn get_connected_params(&self) -> ConnectedParam {
        let mut params = self.params.redis_params.clone();
        if let Some(addr) = self.tunnel_addr {
            params.tcp_host = addr.ip().to_string();
            params.tcp_port = addr.port();
        }
        params
    }

    pub async fn get_monitor(&self) -> Result<Monitor, CusError> {
        let params = self.get_connected_params();
        let client = Client::open(params)?;
        let result = client.get_async_monitor().await;
        match result {
            Ok(c) => Ok(c),
            Err(e) => Err(CusError::App(e.to_string())),
        }
    }

    pub async fn get_sync_one(&self) -> Result<RedisSyncConnection, CusError> {
        let params = self.get_connected_params();
        let client = Client::open(params)?;
        let result = client.get_connection();
        match result {
            Ok(c) => Ok(c),
            Err(e) => Err(CusError::App(e.to_string())),
        }
    }

    pub async fn get_sync_cluster_one(&self) -> Result<RedisSyncClusterConnection, CusError> {
        let params: ConnectedParam = self.get_connected_params();
        let client = ClusterClient::new(vec![params])?;
        let result = client.get_connection();
        match result {
            Ok(c) => Ok(c),
            Err(e) => Err(CusError::App(e.to_string())),
        }
    }

    pub async fn get_normal(
        &mut self,
        config: &AsyncConnectionConfig,
    ) -> Result<MultiplexedConnection, CusError> {
        ssh::create_tunnel(self).await?;
        let params = self.get_connected_params();
        let client: Client = Client::open(params)?;
        let conn: MultiplexedConnection = client
            .get_multiplexed_async_connection_with_config(config)
            .await?;
        Ok(conn)
    }
    pub async fn get_cluster(&mut self) -> Result<ClusterConnection, CusError> {
        ssh::create_tunnel(self).await?;
        let params = self.get_connected_params();
        let client = ClusterClient::new(vec![params])?;
        let r = client.get_async_connection().await;
        match r {
            Ok(connection) => Ok(connection),
            Err(_) => Err(CusError::App(String::from("Connection Timeout"))),
        }
    }
}

pub struct ConnectionWrapper {
    pub conn: Box<dyn ConnectionLike + Send>,
    pub id: String,
    pub nodes: Vec<Node>,
    pub db: u8,
    pub created_at: DateTime<Local>,
    pub model: Connection,
    pub version: Option<String>,
}

impl ConnectionWrapper {
    pub async fn build<T: Connectable>(model: T) -> Result<Self, CusError> {
        let b: Box<dyn ConnectionLike + Send>;
        let params: ConnectionParams = model.get_params();
        let mut connection = Connection::new(params);
        if connection.params.is_cluster {
            b = Box::new(connection.get_cluster().await?)
        } else {
            b = Box::new(connection.get_normal(&AsyncConnectionConfig::new()).await?);
        }
        let r = Self {
            id: utils::random_str(32),
            nodes: vec![],
            db: 0,
            created_at: Local::now(),
            model: connection,
            conn: b,
            version: None,
        };
        Ok(r)
    }

    pub fn get_host(&self) -> String {
        self.model.get_host()
    }

    pub fn is_cluster(&self) -> bool {
        self.model.is_cluster()
    }

    // execute the redis command
    pub async fn execute<T>(
        &mut self,
        cmd: &mut redis::Cmd,
    ) -> Result<(T, Command), (CusError, Command)>
    where
        T: FromRedisValue,
    {
        let mut cmd_vec: Vec<String> = vec![];
        for arg in cmd.args_iter() {
            match arg {
                Arg::Simple(v) => match String::from_utf8(v.to_vec()) {
                    Ok(s) => {
                        cmd_vec.push(s);
                    }
                    Err(_) => {
                        cmd_vec.push(utils::binary_to_redis_str(&v.to_vec()));
                    }
                },
                Arg::Cursor => {}
            }
        }
        let start = Local::now();
        let value_r = cmd.query_async(self).await;
        let end = Local::now();
        let mut rep: Vec<String> = vec![];
        let mut cus_cmd = Command {
            id: utils::random_str(32),
            cmd: cmd_vec.join(" "),
            response: CValue::Nil,
            created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            host: self.model.get_host(),
            duration: end.timestamp_micros() - start.timestamp_micros(),
        };
        match value_r {
            Ok(value) => match T::from_redis_value(&value) {
                Ok(v) => {
                    cus_cmd.response = CValue::build(value);
                    Ok((v, cus_cmd))
                }
                Err(err) => Err((CusError::App(err.to_string()), cus_cmd)),
            },
            Err(err) => {
                rep.push(err.to_string());
                cus_cmd.response = CValue::Str(err.to_string());
                Err((CusError::App(err.to_string()), cus_cmd))
            }
        }
    }
}

impl ConnectionLike for ConnectionWrapper {
    fn req_packed_command<'a>(
        &'a mut self,
        cmd: &'a redis::Cmd,
    ) -> redis::RedisFuture<'a, redis::Value> {
        self.conn.req_packed_command(cmd)
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a redis::Pipeline,
        offset: usize,
        count: usize,
    ) -> redis::RedisFuture<'a, Vec<redis::Value>> {
        self.conn.req_packed_commands(cmd, offset, count)
    }

    fn get_db(&self) -> i64 {
        self.conn.get_db()
    }
}
