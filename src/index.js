const {cred} = require('./db_credentials');
////////////////////////////////////////////////////////////////////////////////
// DON'T EDIT BELOW UNLESS YOU KNOW WHAT YOU'RE DOING!
////////////////////////////////////////////////////////////////////////////////
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('graphql-tools');
const { TargetDetails } = require("./models/target/targetDetails");
const querystring = require('querystring');
const TCRD = require('./TCRD');
const fs = require('fs');
var url = require("url");
require('typescript-require');
const responseCachePlugin = require('apollo-server-plugin-response-cache');
const { parseResidueData } = require('./utils');

const typeDefs = fs.readFileSync(__dirname + '/schema.graphql','utf8');
const resolvers = require('./resolvers');
const {TargetList} = require("./models/target/targetList");
const {DiseaseList} = require("./models/disease/diseaseList");
const {LigandList} = require("./models/ligand/ligandList");
const {performance} = require("perf_hooks");

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
        min: 5,
        max: 30,
        createTimeoutMillis: 3000,
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
    // res.redirect(`https://tripod.nih.gov/servlet/renderServlet?standardize=true&size=${paramMap.size}&structure=${paramMap.structure}`);
    res.redirect(`https://pharos-ligand.ncats.io/indexer/render?structure=${paramMap.structure}&size=${paramMap.size}`);
});

app.get("/annotations?*", async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const queryMap = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const targetDetails = new TargetDetails({}, {uniprot: queryMap.uniprot}, tcrd);
    const results = await targetDetails.getSequenceAnnotations();
    res.end(JSON.stringify(results));
});

app.get("/variants?*", async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const queryMap = querystring.parse(parsedUrl.query);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const targetDetails = new TargetDetails({}, {uniprot: queryMap.uniprot}, tcrd);
    const results = await targetDetails.getSequenceVariants();
    res.end(JSON.stringify(parseResidueData(results)));
});

app.get("/sitemap.xml", async (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const targetList = new TargetList(tcrd, {fields:["Preferred Symbol"]});
    const diseaseList = new DiseaseList(tcrd, {fields:["Associated Disease"]});
    const ligandList = new LigandList(tcrd, {fields: ["Ligand Name"], filter: {facets: [{facet: "Type", values: ["Drug"]}]}});

    const targetQuery = targetList.getListQuery("list");
    const diseaseQuery = diseaseList.getListQuery("list").andWhere("name", "not like", '%(%');
    const ligandQuery = ligandList.getListQuery("list").andWhere("name", "not like", '%(%');

    // console.log(ligandQuery.toString());

    const targetResults = await targetQuery;
    const diseaseResults = await diseaseQuery;
    const ligandResults = await ligandQuery;

    const results = [
        ...targetResults.map(r => "targets/" + r.preferredSymbol),
        ...diseaseResults.map(r => "diseases/" + r.Name),
        ...ligandResults.map(r => "ligands/" + r.name)
    ];
    const mappedElements = results.map(r => `<url><loc>https://pharos.nih.gov/${r}</loc><lastmod>${cred.LASTMOD}</lastmod></url>`).join('\n');
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${mappedElements}
</urlset>`);
})

server.applyMiddleware({
    app,
    path: '/graphql'
});

const args = process.argv.slice(2);

if (args && args.length > 0 && args[0] === 'perf') {
    console.log('time, heapTotal, heapUsed, external');
    setInterval(() => {
        const mem = process.memoryUsage();
        console.log(`${performance.now()}, ${mem.heapTotal / (1024 * 1024)}, ${mem.heapUsed / (1024 * 1024)}, ${mem.external / (1024 * 1024)}`);
    }, 5000);
}

const PORT = process.env.PORT || 4000;
tcrd.tableInfo.loadPromise.then(() => {
    app.listen({port: PORT}, () => {
        console.log('🏭 using configuration from: ' + cred.CONFIGDB);
        console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
    });
});

