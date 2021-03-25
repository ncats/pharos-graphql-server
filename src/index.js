const {cred} = require('./db_credentials');
////////////////////////////////////////////////////////////////////////////////
// DON'T EDIT BELOW UNLESS YOU KNOW WHAT YOU'RE DOING!
////////////////////////////////////////////////////////////////////////////////
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('graphql-tools');
const TCRD = require('./TCRD');
const fs = require('fs');
var url = require("url");
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
        host: cred.DBHOST,
        user: cred.USER,
        password: cred.PWORD,
        database: cred.DBNAME,
        configDB: cred.CONFIGDB
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

app.get("/render", (req, res) => {
    const parsedUrl = url.parse(req.url);
    const pieces = parsedUrl.query.split('&');
    const paramMap = {};
    pieces.forEach(piece => {
        const chunks = piece.split('=');
        paramMap[chunks[0]] = chunks[1];
    });
    res.redirect(`https://tripod.nih.gov/idg/api/v1/render/${paramMap.structure}?size=${paramMap.size}`);
});

server.applyMiddleware({
    app,
    path: '/graphql'
});

const PORT = process.env.PORT || 4000;
tcrd.tableInfo.loadPromise.then(() => {
    app.listen({port: PORT}, () => {
        console.log('🏭 using configuration from: ' + cred.CONFIGDB);
        console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
    });
});

