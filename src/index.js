//
// Edit as appropriate
//
const DBHOST = 'tcrd.ncats.io';
const DBNAME = 'tcrd660';
const CONFIGDB = 'pharos_config';
const USER = 'tcrd';
const PWORD = '';

////////////////////////////////////////////////////////////////////////////////
// DON'T EDIT BELOW UNLESS YOU KNOW WHAT YOU'RE DOING!
////////////////////////////////////////////////////////////////////////////////
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('graphql-tools');
const TCRD = require('./TCRD');
const fs = require('fs');
require('typescript-require');
const responseCachePlugin = require('apollo-server-plugin-response-cache');

const typeDefs = fs.readFileSync(__dirname + '/schema.graphql','utf8');
const resolvers = require('./resolvers');

const schema = makeExecutableSchema({
    typeDefs,
    resolvers
});

const tcrdConfig = {
    client: 'mysql',
    connection: {
        host: DBHOST,
        user: USER,
        password: PWORD,
        database: DBNAME,
        configDB: CONFIGDB
    },
    pool: {
        min: 2,
        max: 10,
        createTimeoutMillis: 3000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false // <- default is true, set to false
    }
};

const tcrd = new TCRD(tcrdConfig);
const server = new ApolloServer({
    plugins: [responseCachePlugin()],
    schema: schema,
    introspection: true,
    playground: true,
    dataSources: () => ({
        tcrd: tcrd
    })
});

// Initialize the app
const app = express();

server.applyMiddleware({
    app,
    path: '/graphql'
});

const PORT = process.env.PORT || 4000;

setTimeout(() => {
    app.listen({port: PORT}, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
    });
}, 1000);

