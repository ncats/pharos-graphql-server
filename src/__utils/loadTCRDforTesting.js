const {cred} = require('../db_credentials');

jest.setTimeout(60000);

const tcrdConfig = {
    client: 'mysql',
    connection: {
        host: cred.DBHOST,
        user: cred.USER,
        password: cred.PWORD,
        database: cred.DBNAME,
        configDB: cred.CONFIGDB
    },
    pool: {
        min: 2,
        max: 20,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: true // <- default is true, set to false
    }
};


exports.tcrdConfig = tcrdConfig;
