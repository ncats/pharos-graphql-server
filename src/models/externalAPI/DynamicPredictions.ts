import {Knex} from "knex";

const axios = require('axios');

export class DynamicPredictions {
    knex: Knex;
    tcrd: any;
    constructor(tcrd: any) {
        this.knex = tcrd.db;
        this.tcrd = tcrd;
    }

    kinaseCancerPredictionAPI = 'https://16z877ei3f.execute-api.us-east-1.amazonaws.com/default/pharos-kinase-cancer-prediction'
    targetAPIs = [
        this.kinaseCancerPredictionAPI + '?target={sym}'
    ];
    diseaseAPIs = [
        this.kinaseCancerPredictionAPI + '?disease={mesh_id}'
    ];
    ligandAPIs = [
        // this.kinaseCancerPredictionAPI + '?ligand={name}' // not really a prediction, just some training data
    ];

    targetDetailsFields = ['name', 'uniprot', 'sym'];
    targetValidAliasFields = ['NCBI Gene ID'];

    getDetails(pageInfo: any) {
        if (pageInfo.path === 'targets') {
            let matcher = `(protein.uniprot = "${pageInfo.id}" OR protein.sym = "${pageInfo.id}" OR protein.stringid = "${pageInfo.id}")`;
            if (pageInfo.id.length >= 3) {
                matcher = `match(protein.uniprot, protein.sym, protein.stringid) against('"${pageInfo.id}"' in boolean mode)`;
            }

            const aliasQuery = this.knex(
                {protein: 'protein'})
                .leftJoin({alias: 'alias'}, 'protein.id', 'protein_id')
                .select({type: 'type',
                    value: this.knex.raw('group_concat(distinct value)')})
                .select(this.targetDetailsFields)
                .where('protein_id', this.knex.raw('protein.id'))
                .where(this.knex.raw(matcher))
                .groupBy('type');
            console.log(aliasQuery.toString());
            return aliasQuery.then((aliases: any[]) => {
                if (aliases.length > 0) {
                    const target: any = {};
                    this.targetDetailsFields.forEach(field => target[field] = aliases[0][field]);
                    aliases.forEach((a => {
                        if (this.targetValidAliasFields.includes(a.type)) {
                            target[a.type] = a.value;
                        }
                    }));
                    return target;
                }
            });
        }
        if (pageInfo.path === 'diseases') {

        }
        if (pageInfo.path === 'ligands') {

        }
    }

    getFetchUrl(url: string, pageInfo: any, detailsObj: any) {
        if (pageInfo.path === 'targets') {
            return this.processTargetAPI(url, detailsObj, []);
        }
        if (pageInfo.path === 'diseases') {

        }
        if (pageInfo.path === 'ligands') {

        }
        return
    }

    getResults(url: string, pageInfo: any, detailsObj: any) {
        if (pageInfo.path === 'targets') {
            return this.fetchAPIs(detailsObj, [url], this.processTargetAPI.bind(this));
        }
        if (pageInfo.path === 'diseases') {

        }
        if (pageInfo.path === 'ligands') {

        }

        return
    }

    parseResults(results: any[]) {
        results.forEach((row: any) => {
            this.findDiseases(row);
            this.findTargets(row);
        });
        return [results];
    }

    processTargetAPI(url: string, target: any, extras: any[]) {
        [...this.targetDetailsFields, ...this.targetValidAliasFields].forEach(field => {
            const re = new RegExp(`{${field}}`, 'g')
            url = url.replace(re, target[field]);
        })
        return url;
    }

    processDiseaseAPI(url: string, disease: any, aliases: any[]) {
        const meshes = aliases.filter(row => row.db === 'MESH').map(row => row.value).join(',');
        return url.replace('{name}', disease.name)
            .replace('{mondo_id}', disease.mondoID)
            .replace('{mesh_id}', meshes);
    }
    processLigandAPI(url: string, ligand: any, extras: any[]) {
        return url.replace('{name}', ligand.name);
    }

    fetchTargetAPIs(target: any) {
        return this.fetchAPIs(target, this.targetAPIs, this.processTargetAPI.bind(this));
    }
    async fetchDiseaseAPIs(disease: any, aliases: { db:string, value: string }[] = []) {
        const allAliases = aliases.slice();
        if (disease.mondoID || aliases.length > 0) {
            const mondoAliases = await this.knex('mondo_xref')
                .select(['value', 'db']).where('mondoid', disease.mondoID);
            mondoAliases.forEach(newAlias => {
               const found = allAliases.find(a => a.db === newAlias.db && a.value === newAlias.value);
               if (!found) {
                   allAliases.push(newAlias);
               }
            });
            return this.fetchAPIs(disease, this.diseaseAPIs, this.processDiseaseAPI.bind(this), allAliases);
        }
    }
    async fetchLigandAPIs(ligand: any) {
        return this.fetchAPIs(ligand, this.ligandAPIs, this.processLigandAPI.bind(this));
    }

    async fetchAPIs(detailsObject: any, apiList: string[], processFunction: any, extras?: any[]) {
        const queries: any[] = [];
        apiList.forEach(api => {
            queries.push(axios.get(processFunction(api, detailsObject, extras)));
        });
        return Promise.all(queries)
            .then((responses: any[]) => {
                const nonNullResponsees = responses.filter(r => r.data && r.data.length > 0 && r.data[0]);
                nonNullResponsees.forEach(r => {
                    if (r.data) {
                        r.data.forEach((row: any) => {
                            this.findDiseases(row);
                            this.findTargets(row);
                        });
                    }
                });
                return nonNullResponsees.map(r => r.data ? r.data : null);
            }, (rejected: any) => {
                console.log(rejected);
                throw new Error(rejected);
            });
    }
    findTargets(obj: any) {
        if (obj) {
            if (obj.hasOwnProperty('@type') && obj['@type'] === 'Protein') {
                obj.url = '/targets/' + obj.name;
            } else if (Array.isArray(obj)) {
                obj.forEach(el => {
                    this.findTargets(el);
                });
            } else if (typeof obj === 'string') {

            } else {
                for (let [key, value] of Object.entries(obj)) {
                    this.findTargets(value);
                }
            }
        }
    }
    findDiseases(obj: any) {
        if (obj) {
            if (obj.hasOwnProperty('@type') && obj['@type'] === 'MedicalCondition') {
                const mondoid = this.tcrd.tableInfo.id2mondo.get(obj.alternateName);
                if (mondoid) {
                    obj.mondoid = mondoid;
                    obj.url = '/diseases/' + mondoid;
                }
            } else if (Array.isArray(obj)) {
                obj.forEach(el => {
                    this.findDiseases(el);
                });
            } else if (typeof obj === 'string') {

            } else {
                for (let [key, value] of Object.entries(obj)) {
                    this.findDiseases(value);
                }
            }
        }
    }
}
