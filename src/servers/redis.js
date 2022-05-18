const Redis = require("ioredis");
const {cred} = require("../db_credentials");
const crypto = require("crypto");
package_info = require("../../package.json");

const getPrefix = () => {
    return crypto.createHash('sha1')
        .update(cred.CONFIGDB + package_info.version + cred.DBNAME)
        .digest('base64').substring(0, 5);
}
module.exports.getPrefix = getPrefix;

module.exports.connectToRedis = () => {
    const REDISHOST = process.env.REDISHOST || 'localhost';// || '10.120.0.3';
    const REDISPORT = process.env.REDISPORT || 6379;
    let redisClient = new Redis({
        host: REDISHOST,
        port: REDISPORT,
        keyPrefix: getPrefix(),
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