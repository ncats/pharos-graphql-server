const {BaseRedisCache} = require("apollo-server-cache-redis");
const {ApolloServer} = require("apollo-server-express");
const responseCachePlugin = require("apollo-server-plugin-response-cache");
const {connectToRedis} = require("./redis");
const gqlfiltering = require('graphql-introspection-filtering');

module.exports.getServer = (schema, tcrd, app, schemaDirectives) => {
    const filters = gqlfiltering.schemaDirectivesToFilters(schemaDirectives)
    const filteredSchema = gqlfiltering.default(schema, filters)

    return connectToRedis().then(redisClient => {
        const serverOptions = {
            schema: filteredSchema,
            introspection: true,
            plugins: [responseCachePlugin()],
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
        server.applyMiddleware({
            app,
            path: '/graphql'
        });

        return {apollo: server, redis: redisClient};
    });
}
