use redis::FromRedisValue;
use serde::Deserialize;

use crate::{
    err::{self, CusError},
    redis_conn,
};

#[derive(Deserialize)]
struct LRangeArgs {
    name: String,
    start: i64,
    stop: i64,
    db: u8,
}

pub async fn lrange(payload: String, cid: u32) -> Result<Vec<String>, CusError> {
    let args: LRangeArgs = serde_json::from_str(&payload)?;
    let mut conn = redis_conn::get_connection(cid, args.db).await?;
    let values: redis::Value = redis::cmd("lrange")
        .arg(&args.name)
        .arg(&args.start)
        .arg(&args.stop)
        .query_async(&mut conn)
        .await?;
    Ok(Vec::<String>::from_redis_value(&values)?)
}

#[derive(Deserialize)]
struct LSetArgs {
    name: String,
    index: i64,
    value: String,
    db: u8,
}
pub async fn lset(payload: String, cid: u32) -> Result<String, CusError> {
    let args: LSetArgs = serde_json::from_str(&payload)?;
    let mut conn = redis_conn::get_connection(cid, args.db).await?;
    let value: redis::Value = redis::cmd("lset")
        .arg(&args.name)
        .arg(args.index)
        .arg(&args.value)
        .query_async(&mut conn)
        .await?;
    Ok(String::from_redis_value(&value)?)
}

#[derive(Deserialize)]
struct LTrimArgs {
    name: String,
    db: u8,
    start: i64,
    stop: i64,
}

pub async fn ltrim(payload: String, cid: u32) -> Result<String, CusError> {
    let args: LTrimArgs = serde_json::from_str(&payload)?;
    let mut conn = redis_conn::get_connection(cid, args.db).await?;
    let value: redis::Value = redis::cmd("ltrim")
        .arg(&args.name)
        .arg(args.start)
        .arg(args.stop)
        .query_async(&mut conn)
        .await?;
    Ok(String::from_redis_value(&value)?)
}

#[derive(Deserialize)]
struct InsertArgs {
    name: String,
    db: u8,
    types: String,
    value: String,
    pivot: String,
}
pub async fn linsert(payload: String, cid: u32) -> Result<i64, CusError> {
    let args: InsertArgs = serde_json::from_str(&payload)?;
    let mut conn = redis_conn::get_connection(cid, args.db).await?;
    let value: redis::Value = redis::cmd("linsert")
        .arg(&args.name)
        .arg(&args.types)
        .arg(&args.pivot)
        .arg(&args.value)
        .query_async(&mut conn)
        .await?;
    if let redis::Value::Int(r) = value {
        match r {
            0 => return Err(CusError::App(String::from("key not exist"))),
            -1 => return Err(CusError::App(String::from("the pivot wasn't found."))),
            _ => return Ok(r),
        }
    }
    Err(err::new_normal())
}