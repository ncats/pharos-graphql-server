import {Knex} from "knex";
import {LigandDetails} from "../ligand/ligandDetails";

const axios = require('axios');

export class DynamicPredictions {
    knex: Knex;
    tcrd: any;
    apis: string[];

    constructor(tcrd: any, apis: string[] = []) {
        this.knex = tcrd.db;
        this.tcrd = tcrd;
        this.apis = apis;
    }

    fetchCommunityData(apis: string[], details: any, model: string) {
        const urls: string[] = [];
        apis.forEach(api => {
           if (api.length === 4) {
               const apiDetails = this.tcrd.tableInfo.communityDataList.get(`${model}-details`)
                   .find((f: any) => f.code === api);
               if (apiDetails) {
                   urls.push(apiDetails.url);
               }
           } else if (api.startsWith('http')) {
               urls.push(api);
           }
        });
        if (model === 'target') {
            return this.fetchAPIs(details, urls, this.processTargetAPI.bind(this), []);
        }
        else if (model === 'disease')
        {
            const mondoQuery =  this.knex({
                mondo: 'mondo',
                mondo_xref: 'mondo_xref'
            }).select({
                name:'name',
                mondoid:'mondo.mondoid',
                alias:'xref'
            }).where('mondo.mondoid', this.knex.raw('mondo_xref.mondoid'))
                .andWhere((q: any) => {
                    q.where('mondo.name', details.name);
                    if (details.mondoID) {
                        q.orWhere('mondo.mondoid', details.mondoID);
                    }
                });
            const otherQuery = this.knex({
               ncats_disease: 'ncats_disease',
               ncats_d2da: 'ncats_d2da',
               disease: 'disease'
            }).select({
                name: 'ncats_disease.name',
                mondoid: this.knex.raw('null'),
                alias: 'disease.did'
            }).where('ncats_disease.name', details.name)
                .andWhere('ncats_disease_id', this.knex.raw('ncats_disease.id'))
                .andWhere('disease_assoc_id', this.knex.raw('disease.id'));
            return mondoQuery.union(otherQuery).then((res: any[]) => {
                const idMap = new Map<string, string>();
                for (let i = 0 ; i < res.length ; i++) {
                    if (i === 0) {
                        idMap.set('name', res[i].name);
                        idMap.set('mondo', res[i].mondoid);
                    }
                    const chunks = res[i].alias.split(':');
                    let key = chunks[0].toLowerCase();
                    if (idMap.has(key)) {
                        // @ts-ignore
                        const existingKeys = idMap.get(key).split('|');
                        if (!existingKeys.includes(res[i].alias)) {
                            existingKeys.push(res[i].alias);
                            idMap.set(key, existingKeys.join('|'));
                        }
                    } else {
                        idMap.set(key, res[i].alias);
                    }
                }
                const aliases = Object.fromEntries(idMap);
                return this.fetchAPIs(details, urls, this.processDiseaseAPI.bind(this), aliases);
            });
        }
        else if (model === 'ligand') {
            return this.fetchAPIs(details, urls, this.processLigandAPI.bind(this), []);
        }
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
            const query =  this.knex({
                ncats_disease: 'ncats_disease',
                mondo_xref: 'mondo_xref'
            }).select({
                name:'name',
                mondoid:'ncats_disease.mondoid',
                alias:'xref'
            }).where('name', pageInfo.id)
                .andWhere('ncats_disease.mondoid', this.knex.raw('mondo_xref.mondoid'));
            return query.then((res: any[]) => {
                const idMap = new Map<string, string>();
                for (let i = 0 ; i < res.length ; i++) {
                    if (i === 0) {
                        idMap.set('name', res[i].name);
                        idMap.set('mondo', res[i].mondoid);
                    }
                    const chunks = res[i].alias.split(':');
                    const key = chunks[0].toLowerCase();
                    if (idMap.has(key)) {
                        idMap.set(key, idMap.get(key) + '|' + res[i].alias);
                    } else {
                        idMap.set(key, res[i].alias);
                    }
                }
                return Object.fromEntries(idMap);
            });

        }
        if (pageInfo.path === 'ligands') {
            const ligandDetails = new LigandDetails(this.knex);
            return ligandDetails.getDetailsQuery(pageInfo.id, true).then((rows: any[]) => {
                if (rows && rows.length > 0) {
                    return rows[0];
                }
                return null;
            });
        }
    }

    getFetchUrl(url: string, pageInfo: any, detailsObj: any) {
        if (pageInfo.path === 'targets') {
            return this.processTargetAPI(url, detailsObj, []);
        }
        if (pageInfo.path === 'diseases') {
            return this.processDiseaseAPI(url, detailsObj, detailsObj);
        }
        if (pageInfo.path === 'ligands') {
            return this.processLigandAPI(url, detailsObj, []);
        }
        return
    }

    getResults(url: string) {
        if (url) {
            return this.fetchUrlAndProcessResults([axios.get(url)]);
        }
        return;
    }

    async parseResults(results: any[]) {
        for(let i = 0 ; i < results.length ; i++) {
            this.findDiseases(results[i]);
            this.findTargets(results[i]);
            await this.findCitations(results[i]);
        }
        return [results];
    }

    processTargetAPI(url: string, target: any, extras: any[]) {
        [...this.targetDetailsFields, ...this.targetValidAliasFields].forEach(field => {
            const re = new RegExp(`{${field}}`, 'g')
            url = url.replace(re, target[field]);
        })
        return url;
    }

    processDiseaseAPI(url: string, disease: any, aliasMap: any) {
        let pUrl = url;
        for (let field in aliasMap) {
            const re = new RegExp(`{${field}}`, 'g');
            pUrl = pUrl.replace(re, aliasMap[field]);
        }
        return pUrl;
    }

    processLigandAPI(url: string, ligand: any, extras: any[]) {
        let pUrl = url;
        for (let field in ligand) {
            const re = new RegExp(`{${field}}`, 'g');
            pUrl = pUrl.replace(re, encodeURIComponent(ligand[field]));
        }
        return pUrl;
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

    async fetchAPIs(detailsObject: any, apiList: string[], processFunction: any, extras?: any) {
        const queries: any[] = [];
        apiList.forEach(api => {
            queries.push(axios.get(processFunction(api, detailsObject, extras)));
        });
        return this.fetchUrlAndProcessResults(queries);
    }

    private fetchUrlAndProcessResults(queries: any[]) {
        return Promise.all(queries)
            .then(async (responses: any[]) => {
                for (let j = 0; j < responses.length; j++) {
                    const r = responses[j]
                    if (r.data) {
                        for (let i = 0; i < r.data.length; i++) {
                            this.findDiseases(r.data[i]);
                            this.findTargets(r.data[i]);
                            await this.findCitations(r.data[i]);
                        }
                    }
                }
                return responses.map(r => r.data ? r.data : null);
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
    async findCitations(obj: any) {
        if (obj) {
            if (obj.hasOwnProperty('@type') && obj['@type'] === 'ScholarlyArticle') {
                await this.fillInCitationGaps(obj);
            } else if (Array.isArray(obj)) {
                obj.forEach(async el => {
                    await this.findCitations(el);
                });
            } else if (typeof obj === 'string') {

            } else {
                for (let [key, value] of Object.entries(obj)) {
                    await this.findCitations(value);
                }
            }
        }
    }
    async fillInCitationGaps(citationObj: any) {
        const pmid = citationObj.identifier.name === 'PMID' ? citationObj.identifier.value : '';
        if (pmid) {
            let refetch = false;
            let freshData: any = {};
            ['name','abstract','author','datePublished','publisher'].forEach(field => {
                if (!citationObj.hasOwnProperty(field)) {
                    refetch = true;
                }
            });
            if (refetch) {
                freshData = await this.knex('ncats_pubmed.pubmed').select('*').where('id', pmid);
                freshData = freshData.length > 0 ? freshData[0] : freshData;
            }
            if (!citationObj.hasOwnProperty('name')) {
                citationObj['name'] = freshData['title'];
            }
            if (!citationObj.hasOwnProperty('abstract')) {
                citationObj['abstract'] = freshData['abstract'];
            }
            if (!citationObj.hasOwnProperty('author')) {
                citationObj['author'] = freshData.authors.split(', ').map((a: string) => {
                    return { "@type": "Person", "name": a };
                })
            }
            if (!citationObj.hasOwnProperty('publisher')) {
                citationObj['publisher'] = { "@type": "Organization", "name": freshData.journal };
            }
            if (!citationObj.hasOwnProperty('datePublished')) {
                citationObj['datePublished'] = freshData.date;
            }
            if (!citationObj.hasOwnProperty('creditText') && citationObj.author.length > 0) {
                citationObj['creditText'] = citationObj.author.length > 2 ? this.getLastName(citationObj.author[0]) + ' et al.' :
                    citationObj.author.length === 2 ? this.getLastName(citationObj.author[0]) + ' and ' + this.getLastName(citationObj.author[1]) :
                        citationObj.author[0].name;
            }
            if (!citationObj.hasOwnProperty('url')) {
                citationObj['url'] = 'https://pubmed.ncbi.nlm.nih.gov/' + pmid;
            }

        }

    }

    getLastName(author: any) {
        const names = author.name.split(' ');
        return names[names.length - 1];
    }
}
