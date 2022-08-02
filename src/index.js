////////////////////////////////////////////////////////////////////////////////
// DON'T EDIT BELOW UNLESS YOU KNOW WHAT YOU'RE DOING!
////////////////////////////////////////////////////////////////////////////////

const {cred} = require('./db_credentials');
const express = require('express');
const { makeExecutableSchema } = require('graphql-tools');
const TCRD = require('./TCRD');
const fs = require('fs');
require('typescript-require');
const typeDefs = fs.readFileSync(__dirname + '/schema.graphql','utf8');
const resolvers = require('./resolvers');
const {getServer} = require("./servers/apollo");
const {applySpecialRoutes, monitorPerformance, addFriendlyFirewall} = require("./utils");
const {getPrefix} = require("./servers/redis");
const {UndocumentedDirective} = require("./UndocumentedDirective");

const schemaDirectives = {
    undocumented: UndocumentedDirective
}

const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
    schemaDirectives
});

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
        max: 12,
        createTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false // <- default is true, set to false
    }
};

const settingsConfig = {
    client: 'sqlite3', // or 'better-sqlite3'
    connection: {
        filename: "./src/pharos_config.sqlite"
    },
    useNullAsDefault: true
};

const tcrd = new TCRD(tcrdConfig, settingsConfig);
// Initialize the app
const app = express();

applySpecialRoutes(app, tcrd);
addFriendlyFirewall(app);
monitorPerformance();

const PORT = process.env.PORT || 4444;
getServer(schema, tcrd, app, schemaDirectives).then((servers) => {
    tcrd.tableInfo.loadPromise.then(() => {
        app.listen({port: PORT}, () => {
            if (servers.redis) {
                console.log(`💰 using redis cache at ` + servers.redis.options.host);
            } else {
                console.log(`⛔ No redis cache - using In-Memory Cache`);
            }
            console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
        });
    });
});

