import {Knex} from "knex";

const axios = require('axios');

export class DynamicPredictions {
    knex: Knex;
    constructor(knex: any) {
        this.knex = knex;
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

    processTargetAPI(url: string, target: any, extras: any[]) {
        return url.replace('{sym}', target.sym)
            .replace('{uniprot}', target.uniprot);
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

    async fetchTargetAPIs(target: any) {
        return this.fetchAPIs(target, this.targetAPIs, this.processTargetAPI);
    }
    async fetchDiseaseAPIs(disease: any) {
        const aliases = await this.knex('mondo_xref')
            .select(['value', 'db']).where('mondoid', disease.mondoID);
        return this.fetchAPIs(disease, this.diseaseAPIs, this.processDiseaseAPI, aliases);
    }
    async fetchLigandAPIs(ligand: any) {
        return this.fetchAPIs(ligand, this.ligandAPIs, this.processLigandAPI);
    }

    async fetchAPIs(detailsObject: any, apiList: string[], processFunction: any, extras?: any[]) {
        const queries: any[] = [];
        apiList.forEach(api => {
            queries.push(axios.get(processFunction(api, detailsObject, extras)));
        });
        return Promise.all(queries)
            .then((responses: any[]) => {
                return responses.map(r => r.data ? r.data : null);
            }, (rejected: any) => {
                console.log(rejected);
                throw new Error(rejected);
            });
    }
}
