const Redis = require("ioredis");
const {cred} = require("../db_credentials");

module.exports.connectToRedis = () => {
    const REDISHOST = process.env.REDISHOST || 'localhost';// || '10.120.0.3';
    console.log(REDISHOST);
    const REDISPORT = process.env.REDISPORT || 6379;
    let redisClient = new Redis({
        host: REDISHOST,
        port: REDISPORT,
        keyPrefix: cred.CONFIGDB,
        lazyConnect: true
    });
    redisClient.on('error',(err) => {
        console.log(err);
        redisClient.disconnect();
    })
    try {
        return redisClient.connect().then((res) => {
            return redisClient;
        }).catch((err) => {
            redisClient.disconnect();
            return null;
        });
    } catch {
        redisClient.disconnect();
        return Promise.resolve(null);
    }
}