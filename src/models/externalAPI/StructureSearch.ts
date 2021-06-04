const axios = require('axios');
const crypto = require('crypto');

export class StructureSearch {
    smiles: string;
    method: string;
    similarityCutoff: number = 0.6; // always do the same cutoff so we don't cache different cutoffs for the same structure
    knex: any;
    queryHash: string;

    constructor(knex: any, smiles: string, method: string = "sim") {
        this.knex = knex;
        this.smiles = smiles;
        this.method = method.toLowerCase().substr(0, 3);
        this.queryHash = this.getQueryHash();
    }

    async getSimilarStructures() {
        if (!this.smiles) {
            return [];
        }
        const existingQuery = await this.getQueryCount();
        if (existingQuery.length > 0 && existingQuery[0].count > 0) {
            switch (existingQuery[0].query_status) {
                case 'success':
                    return this.updateQueryCount(existingQuery[0].count);
                case 'in progress':
                    throw new Error('this query is still in progress');
                case 'fail':
                    throw new Error(existingQuery[0].error);
            }
        } else {
            return Promise.all([
                axios.get(this.url()),
                this.startNewQuery()
            ])
                .then((response: any) => {
                    return Promise.all([
                        this.addResults(response[0].data),
                        this.updateQueryStatus('success', '')
                    ])
                })
                .catch((error: any) => {
                    return this.updateQueryStatus('fail', JSON.stringify(error));
                });
        }
    }

    private addResults(dataArray: any[]) {
        const inserts = dataArray.map(row => {
            return {
                id: null,
                query_hash: this.queryHash,
                structure: row.structure,
                ncats_ligand_id: row.id,
                similarity: row.similarity
            }
        });

        const queries = [];
        while (inserts.length > 0) {
            queries.push(this.knex('result_cache.structure_search_results').insert(inserts.splice(0, 25000)));
        }
        return Promise.all(queries);
    }

    private updateQueryStatus(status: string, error: string) {
        const q = this.knex('result_cache.search_query').update(
            {
                query_status: status,
                error: error
            }).where('query_hash', this.queryHash);
        return q;
    }

    private startNewQuery() {
        const date = new Date().toISOString();
        return this.knex('result_cache.search_query')
            .insert({
                query_hash: this.queryHash,
                query: this.url(),
                query_status: 'in progress',
                count: 1,
                first_query: date,
                last_query: date
            })
    }

    private updateQueryCount(currentCount: number) {
        return this.knex('result_cache.search_query')
            .where('query_hash', this.queryHash)
            .update({
                count: currentCount + 1,
                last_query: new Date().toISOString()
            });
    }

    private getQueryCount() {
        return this.knex('result_cache.search_query')
            .select(['count', 'query_status', 'error'])
            .where('query_hash', this.queryHash);
    }

    private getQueryHash() {
        return crypto.createHash('sha1').update(this.url()).digest('base64').substr(0, 20);
    }

    private url(): string {
        return `http://ec2-54-160-174-162.compute-1.amazonaws.com:8080/search?${this.queryString()}`;
    }

    private queryString() {
        return `structure=${encodeURIComponent(this.smiles)}&type=${this.method}&t=${this.similarityCutoff}&format=json`
    }
}
