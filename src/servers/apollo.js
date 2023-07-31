const {BaseRedisCache} = require("apollo-server-cache-redis");
const {ApolloServer} = require("apollo-server-express");
const responseCachePlugin = require("apollo-server-plugin-response-cache");
const {connectToRedis} = require("./redis");
const {ApolloServerPluginLandingPageLocalDefault} = require("apollo-server-core");
const bodyParser = require('body-parser');

module.exports.getServer = (schema, tcrd, app, schemaDirectives) => {
    return connectToRedis().then(async redisClient => {
        app.use(bodyParser.json({ limit: '50mb' }));
        const serverOptions = {
            schema: schema,
            introspection: true,
            plugins: [
                responseCachePlugin.default(),
                ApolloServerPluginLandingPageLocalDefault({ footer: false})
            ],
            playground: true,
            dataSources: () => ({
                tcrd: tcrd
            })
        };
        if (redisClient) {
            serverOptions.cache = new BaseRedisCache({ client: redisClient });
            serverOptions.dataSources = () => ({
                tcrd: tcrd,
                redis: redisClient
            });
        }
        const server = new ApolloServer(serverOptions);
        await server.start();
        server.applyMiddleware({
            app,
            path: '/graphql',
        });

        return {apollo: server, redis: redisClient};
    });
}
