const axios = require('axios');
const crypto = require('crypto');

export class SequenceSearch {
    querySequence: string;
    knex: any;
    queryHash: string;

    constructor(knex: any, querySequence: string) {
        this.knex = knex;
        this.querySequence = querySequence;
        this.queryHash = this.getQueryHash();
    }

    async runBlastSearch() {
        if (!this.querySequence || this.querySequence.length === 0) {
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
            const blastArgs = {sequence: this.querySequence};
            return Promise.all([
                axios.post(this.url(), blastArgs),
                this.startNewQuery()
            ]).then((response: any) => {
                    return Promise.all([
                        this.addResults(response[0].data).then(() => {
                            return this.updateProteinID();
                        }),
                        this.updateQueryStatus('success', '')
                    ])
                })
                .catch((error: any) => {
                    return this.updateQueryStatus('fail', JSON.stringify(error));
                });
        }
    }

    private updateProteinID() {
        const detailsQuery = this.knex({
            sequence_search_results: 'result_cache.sequence_search_results',
            protein: 'protein'
        }).where('query_hash', this.queryHash)
            .andWhere('protein.uniprot', this.knex.raw('sequence_search_results.uniprot'))
            .update('protein_id', this.knex.raw('protein.id'));

        const summaryQuery = this.knex({
            sequence_search_summary: 'result_cache.sequence_search_summary',
            protein: 'protein'
        }).where('query_hash', this.queryHash)
            .andWhere('protein.uniprot', this.knex.raw('sequence_search_summary.uniprot'))
            .update('protein_id', this.knex.raw('protein.id'));

        return Promise.all([detailsQuery, summaryQuery]);
    }

    private addResults(response: any) {
        const rows = response.split('\n');
        const inserts: any[] = [];
        const summaryInserts: any[] = [];

        const summaryMap: Map<string, any[]> = new Map<string, any[]>();

        rows.forEach((row: string) => {
            if(row && row.trim().length > 0) {
                const parsedRow = this.parseResponse(row);
                inserts.push(parsedRow);
                this.addToMap(summaryMap, parsedRow);
            }
        });

        summaryMap.forEach((rows, uniprot) => {

            let maxBit = 0;
            let minE = 0;
            let pident = 0;
            let qcovs = 0;

            rows.forEach(row => {
                if (row.bitscore > maxBit) {
                    maxBit = row.bitscore;
                    minE = row.evalue;
                    pident = row.pident;
                    qcovs = row.qcovs;
                }
            });

            const obj: any = {
                query_hash: this.queryHash,
                uniprot: uniprot,
                pident: pident,
                qcovs: qcovs,
                evalue: minE,
                bitscore: maxBit
            }
            summaryInserts.push(obj);
        });

        const queries = [];
        inserts.forEach(row => {
            delete row.qcovs;
        });
        while (inserts.length > 0) {
            queries.push(this.knex('result_cache.sequence_search_results').insert(inserts.splice(0, 25000)));
        }

        while (summaryInserts.length > 0) {
            queries.push(this.knex('result_cache.sequence_search_summary').insert(summaryInserts.splice(0, 25000)));
        }

        return Promise.all(queries);
    }

    private addToMap(map: Map<string, any[]>, row: any) {
        const list = map.get(row.uniprot) || [];
        list.push(row);
        if (!map.has(row.uniprot)) {
            map.set(row.uniprot, list);
        }
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
                query: this.querySequence,
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
        return crypto.createHash('sha1').update(this.querySequence).digest('base64').substr(0, 20);
    }

    private url(): string {
        return 'https://9agi0r09ga.execute-api.us-east-1.amazonaws.com/default/pharos-sequence-search';
    }

    parseResponse(row: string) {
        const pieces = row.split(',');
        const matchObj: any = {
            query_hash: this.queryHash,
            sseqid: pieces[0],
            pident: Number.parseFloat(pieces[1]),
            length : Number.parseInt(pieces[2]),
            mismatch: Number.parseInt(pieces[3]),
            gapopen: Number.parseInt(pieces[4]),
            qstart: Number.parseInt(pieces[5]),
            qend: Number.parseInt(pieces[6]),
            sstart: Number.parseInt(pieces[7]),
            send: Number.parseInt(pieces[8]),
            evalue : Number.parseFloat(pieces[9]),
            bitscore: Number.parseInt(pieces[10]),
            qcovs: Number.parseInt(pieces[11]),
            qseq: pieces[12],
            sseq: pieces[13]
        };
        const sseqidPieces = matchObj.sseqid.split('|');
        if (sseqidPieces.length > 1) {
            const idPieces = sseqidPieces[1].split('.');
            matchObj.uniprot = idPieces[0];
        }
        return matchObj;
    }
}
