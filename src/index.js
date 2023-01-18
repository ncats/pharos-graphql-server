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
const {getReadablePrefix} = require("./servers/redis");
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
        database: cred.DBNAME
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

const unfilteredCountsDB = {
    client: 'sqlite3',
    connection: {
        filename: './src/unfiltered_counts.sqlite'
    },
    useNullAsDefault: true
}

const tcrd = new TCRD(tcrdConfig, settingsConfig);
// Initialize the app
const app = express();

applySpecialRoutes(app, tcrd);
addFriendlyFirewall(app);
monitorPerformance();

const PORT = process.env.PORT || 4444;
getServer(schema, tcrd, app, schemaDirectives).then((servers) => {
    tcrd.tableInfo.loadPromise.then(async () => {
        const countDB = require('knex')(unfilteredCountsDB)
        await getUnfilteredCounts(countDB, resolvers, tcrd);
        await tcrd.tableInfo.setUnfilteredCounts(countDB);
        app.listen({port: PORT}, () => {
            if (servers.redis) {
                console.log(`💰 using redis cache at ` + servers.redis.options.host);
            } else {
                console.log(`⛔ No redis cache - using In-Memory Cache`);
            }
            console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
        });
    }, resolvers);
}, resolvers);

const versionChanged = async (db) => {
    const hasOldVersion = await db.schema.hasTable('version');
    let oldVersion = 'undefined';
    if (hasOldVersion) {
        const versionInfo = await db('version').select('version');
        if (versionInfo && versionInfo.length > 0) {
            oldVersion = versionInfo[0].version;
        }
    }
    const newVersion = getReadablePrefix();
    return [(oldVersion != newVersion), {oldVersion, newVersion}];
}

const setVersion = async (db) => {
    await db.schema.dropTableIfExists('version');
    return db.schema.createTable('version', (table) => {
       table.string('version', 128).notNullable();
    }).then(() => {
        return db('version').insert({version: getReadablePrefix()});
    });
}

const updateUnfilteredCounts = async (db, resolvers, tcrd) => {
    await db.schema.dropTableIfExists('unfiltered_counts');
    await db.schema.createTable('unfiltered_counts', (table) => {
        table.increments('id');
        table.string('model', 20).notNullable();
        table.string('filter', 100).notNullable();
        table.string('value').notNullable();
        table.integer('count').notNullable();
        table.double('p').notNullable();
        table.index(['filter', 'value']);
    });
    dataSources = {dataSources: {tcrd: tcrd}};
    const allFacets = await resolvers.Query.normalizableFilters(null, null, dataSources);

    const mappings = [
        {list: allFacets.targetFacets, endPoint: 'targets'},
        {list: allFacets.diseaseFacets, endPoint: 'diseases'},
        {list: allFacets.ligandFacets, endPoint: 'ligands'}
    ];

    for (let m = 0 ; m < mappings.length ; m++) {
        const list = mappings[m].list;
        const endPoint = mappings[m].endPoint;
        for (let i = 0 ; i < list.length ; i++) {
            const inserts = [];
            const filter = list[i];
            const args = {facets: [filter], filter: {noOptimization: true}};
            console.log(`updating: ${JSON.stringify(args)}`);
            const res = await resolvers.Query[endPoint](null, args, dataSources)
            console.log(`done: ${res.facets && res.facets.length > 0 ? res.facets[0].values.length : 0} rows`);
            if (res && res.facets) {
                res.facets.forEach(facet => {
                    facet.values.forEach(val => {
                        inserts.push({
                            model: facet.model,
                            filter: facet.facet,
                            value: val.name,
                            count: val.value,
                            p: val.value / facet.totalCount
                        })
                    });
                });
            }
            const queries = []
            while(inserts.length > 0){
                const chunk = inserts.splice(0, 500);
                queries.push(db('unfiltered_counts').insert(chunk));
            }
            await Promise.all(queries);
        }
    }
    await setVersion(db);
}

const getUnfilteredCounts = async (countDB, resolvers, tcrd) => {
    [changed, versionDetails] = await versionChanged(countDB);
    if (changed) {
        console.log(`version changed: ${JSON.stringify(versionDetails)}`);
        console.log('Updating unfiltered counts table');
        return updateUnfilteredCounts(countDB, resolvers, tcrd);
    } else {
        console.log('version unchanged: using existing unfiltered counts table');
        return Promise.resolve();
    }
}

