const Redis = require("ioredis");
const {cred} = require("../db_credentials");
const crypto = require("crypto");
package_info = require("../../package.json");

const getReadablePrefix = (cacheVersion = '') => {
    return [package_info.version, cred.DBNAME, cacheVersion]
        .filter(Boolean)
        .join('-');
}

const getPrefix = (cacheVersion = '') => {
    return crypto.createHash('sha1')
        .update(getReadablePrefix(cacheVersion))
        .digest('base64').substring(0, 5);
}
module.exports.getReadablePrefix = getReadablePrefix;

module.exports.connectToRedis = (cacheVersion = '') => {
    const REDISHOST = process.env.REDISHOST || 'localhost';// || '10.120.0.3';
    const REDISPORT = process.env.REDISPORT || 6379;
    const REDISPASSWORD = process.env.REDISPASSWORD || null;
    let redisClient = new Redis({
        host: REDISHOST,
        port: REDISPORT,
        password: REDISPASSWORD,
        keyPrefix: getPrefix(cacheVersion),
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
