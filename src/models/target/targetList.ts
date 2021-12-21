import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";
import {Jaccard} from "../similarTargets/jaccard";
import {SqlTable} from "../sqlTable";
import {DrugTargetPrediction} from "../externalAPI/DrugTargetPrediction";

export class TargetList extends DataModelList {
    proteinList: string[] = [];
    proteinListCached: boolean = false;

    defaultSortParameters(): { column: string; order: string }[] {
        if (this.fields.length > 0) {
            return [{column: 'id', order: 'asc'}];
        }
        if (this.term) {
            return [{column: 'search_score', order: 'asc'}, {column: 'name', order: 'asc'}];
        }
        if (this.associatedTarget) {
            return [{column: this.database.raw('ppitypes = "mock"'), order: 'desc'}, {column: 'p_int', order: 'desc'}, {column: 'score', order: 'desc'}];
        }
        if (this.associatedDisease) {
            return [{column: 'datasource_count', order: 'desc'}];
        }
        if (this.similarity.match.length > 0) {
            return [{column: 'jaccard', order: 'desc'}];
        }
        if (this.associatedLigand.length > 0) {
            return [{column: 'avgActVal', order: 'desc'}];
        }
        if (this.associatedSmiles.length > 0) {
            return [{column: 'result', order: 'desc'}]
        }
        return [{column: 'novelty', order: 'desc'}];
    }

    constructor(tcrd: any, json: any) {
        super(tcrd, 'Target', json);
    }

    getDrugTargetPredictions() {
        const sSearch = new DrugTargetPrediction(this.database, this.associatedSmiles);
        this.structureQueryHash = sSearch.queryHash;
        return sSearch.getPredictedTargets();
    }

    addModelSpecificFiltering(query: any, list: boolean = false): void {
        let filterQuery;
        if (list) {
            if(this.term.length > 0){
                filterQuery = this.tcrd.getScoredProteinList(this.term);
            }
            else if(this.similarity.match.length > 0) {
                filterQuery = this.getSimilarityQuery();
            }
            else if(this.associatedDisease.length > 0) {
                if (!this.filterAppliedOnJoin(query, 'disease')) {
                    filterQuery = this.fetchProteinList();
                }
            }
            else if(this.associatedTarget.length > 0) {
                if (!this.filterAppliedOnJoin(query, 'ncats_ppi')) {
                    filterQuery = this.fetchProteinList();
                }
            }
            else if(this.associatedLigand.length > 0) {
                if (!this.filterAppliedOnJoin(query, 'ncats_ligand_activity')) {
                    filterQuery = this.fetchProteinList();
                }
            }
            else if(this.associatedSmiles.length > 0) {
                if (!this.filterAppliedOnJoin(query, 'predictor_results')) {
                    filterQuery = this.fetchProteinList();
                }
            }
        } else {
            filterQuery = this.fetchProteinList();
        }
        if(!!filterQuery) {
            if (Array.isArray(filterQuery)) { // cached protein list
                query.whereIn('protein.id', filterQuery);
            } else {
                query.join(filterQuery.as("filterQuery"), 'filterQuery.protein_id', 'protein.id');
            }
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.protein_id', 'protein.id');
        }
    }

    private getSimilarityQuery() {
        return new Jaccard(
            {
                ...this.similarity,
                matchQuery: `match(protein.uniprot,protein.sym,protein.stringid) against('${this.similarity.match}' in boolean mode)`
            },
            this.rootTable, this.database, this.databaseConfig).getListQuery(true);
    }

    getLigandActivityDetails(uniprot: string, identifier: string): any {
        if (!identifier && !uniprot) {
            return null;
        }
        const query = this.database({ncats_ligands: 'ncats_ligands', ncats_ligand_activity: 'ncats_ligand_activity', t2tc: 't2tc', protein: 'protein', target: 'target'})
            .select({
                type: 'ncats_ligand_activity.act_type',
                value: 'ncats_ligand_activity.act_value',
                moa: 'ncats_ligand_activity.action_type',
                reference: 'ncats_ligand_activity.reference',
                pmids: 'ncats_ligand_activity.pubmed_ids',
                symbol: 'protein.sym',
                idgTLD: 'target.tdl',
                name: 'protein.description',
                accession: 'protein.uniprot'
            })
            .where('ncats_ligand_activity.target_id', this.database.raw('t2tc.target_id'))
            .andWhere('ncats_ligands.id', this.database.raw('ncats_ligand_activity.ncats_ligand_id'))
            .andWhere('t2tc.protein_id', this.database.raw('protein.id'))
            .andWhere('t2tc.target_id', this.database.raw('target.id'))
            .orderBy([{column: 'moa', order: 'desc'}, {column: 'pmids', order: 'desc'}]);
        if(identifier) {
            query.andWhere('ncats_ligands.identifier', identifier);
        }
        if (uniprot) {
            query.andWhere('protein.uniprot', uniprot);
        }
        // console.log(query.toString());
        return query;
    }

    getAllLigandActivities(): any {
        const query = this.database({ncats_ligands: 'ncats_ligands', ncats_ligand_activity: 'ncats_ligand_activity', t2tc: 't2tc', protein: 'protein'})
            .select([
                'ncats_ligand_id',
                't2tc.target_id',
                'ncats_ligands.identifier',
                'ncats_ligands.smiles',
                'ncats_ligands.name',
                'protein.sym',
                'protein.uniprot'])
            .avg({mean: 'act_value'})
            .select({
                std: this.database.raw('std(act_value)'),
                chemblName: 'ncats_ligands.ChEMBL',
                isdrug: 'isDrug'
                })
            .count({count: 'act_value'})
            .select({references: this.database.raw('group_concat(distinct reference)')})
            .select({pmids: this.database.raw('group_concat(distinct pubmed_ids)')})
            .where('ncats_ligand_activity.target_id', this.database.raw('t2tc.target_id'))
            .andWhere('ncats_ligands.id', this.database.raw('ncats_ligand_activity.ncats_ligand_id'))
            .andWhere('t2tc.protein_id', this.database.raw('protein.id'))
            .whereNotNull('act_value')
            .limit(10000);
        this.addFacetConstraints(query, this.filteringFacets);
        const proteinQuery = this.fetchProteinList();
        if(!!proteinQuery) {
            if (Array.isArray(proteinQuery)) { // cached protein list
                query.whereIn('t2tc.protein_id', proteinQuery);
            } else {
                query.join(proteinQuery.limit(1000).as("proteinQuery"), 'proteinQuery.protein_id', 'protein.id');
            }
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.protein_id', 'protein.id');
        }

        query.groupBy(['ncats_ligand_id', 't2tc.target_id'])
            .orderByRaw('count(distinct protein.id) desc');
        // console.log(query.toString());
        return query;
    }

    getDiseaseAssociationDetails(uniprot: string, name: string): any {
        if (!name && !uniprot) {
            return null;
        }
        const query = this.database({ncats_disease: 'ncats_disease', ncats_d2da: 'ncats_d2da', disease: 'disease', protein: 'protein'})
            .select([{type: 'dtype', drug: 'drug_name'}])
            .select([
                'disease.did', 'disease.description', 'disease.evidence', 'disease.zscore', 'disease.conf', 'disease.reference',
                'disease.log2foldchange', 'disease.pvalue', 'disease.score', 'disease.source', 'disease.O2S', 'disease.S2O'
                ])
            .where('ncats_disease.id', this.database.raw('ncats_d2da.ncats_disease_id'))
            .andWhere('ncats_d2da.disease_assoc_id', this.database.raw('disease.id'))
            .andWhere('disease.protein_id', this.database.raw('protein.id'));
            // .orderBy([{column: 'moa', order: 'desc'}, {column: 'pmids', order: 'desc'}]);
        if (name) {
            query.andWhere('ncats_disease.name', name);
        }
        if (uniprot) {
            query.andWhere('protein.uniprot', uniprot);
        }
        // console.log(query.toString());
        return query;
    }

    getAllDiseaseAssociations(): any {
        const query = this.database({ncats_disease: 'ncats_disease', ncats_d2da: 'ncats_d2da', disease: 'disease', protein: 'protein'})
            .select(['ncats_disease.name', 'protein.sym', 'protein.description', 'protein.uniprot'])
            .count({count: 'disease.id'})
            .where('ncats_disease.id', this.database.raw('ncats_d2da.ncats_disease_id'))
            .andWhere('ncats_d2da.disease_assoc_id', this.database.raw('disease.id'))
            .andWhere('disease.protein_id', this.database.raw('protein.id'))
            // .andWhere('ncats_d2da.direct', 1)
            .limit(10000);
        this.addFacetConstraints(query, this.filteringFacets);
        const proteinQuery = this.fetchProteinList();
        if(!!proteinQuery) {
            if (Array.isArray(proteinQuery)) { // cached protein list
                query.whereIn('disease.protein_id', proteinQuery);
            } else {
                query.join(proteinQuery.limit(1000).as("proteinQuery"), 'proteinQuery.protein_id', 'protein.id');
            }
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.protein_id', 'protein.id');
        }
        query.groupBy(['ncats_disease.name', 'protein.uniprot'])
            .orderByRaw('count(distinct protein.id) desc');
        // console.log(query.toString());
        return query;
    }

    getTargetInteractionDetails(uniprot: string, otherUniprot: string) {
        const query = this.database({other: 'protein', ncats_ppi: 'ncats_ppi', protein: 'protein'})
            .select({
                sym: 'protein.sym',
                uniprot: 'protein.uniprot',
                name: 'protein.description',
                score: this.database.raw('score / 1000'),
                otherSym: 'other.sym',
                otherUniprot: 'other.uniprot',
                otherName: 'other.description'
            })
            .select([`ncats_ppi.ppitypes`, `ncats_ppi.p_int`, `ncats_ppi.p_ni`,
                `ncats_ppi.p_wrong`, `ncats_ppi.evidence`, `ncats_ppi.interaction_type`])
            .where('protein.id', this.database.raw('ncats_ppi.protein_id'))
            .andWhere('other.id', this.database.raw('ncats_ppi.other_id'));

        if (uniprot) {
            query.andWhere('protein.uniprot', uniprot);
        }
        if (otherUniprot) {
            query.andWhere('other.uniprot', otherUniprot);
        }
        return query;
    }

    getAllTargetInteractions(): any {
        const query = this.database({other: 'protein', ncats_ppi: 'ncats_ppi', protein: 'protein'})
            .select({
                sym: 'protein.sym',
                uniprot: 'protein.uniprot',
                name: 'protein.description',
                score: this.database.raw('score / 1000'),
                otherSym: 'other.sym',
                otherUniprot: 'other.uniprot',
                otherName: 'other.description'
            })
            .where('protein.id', this.database.raw('ncats_ppi.protein_id'))
            .andWhere('other.id', this.database.raw('ncats_ppi.other_id'))
            .whereRaw(`NOT (ncats_ppi.ppitypes = 'STRINGDB' AND ncats_ppi.score < ${this.ppiConfidence})`)
            .limit(10000);
        this.addFacetConstraints(query, this.filteringFacets);
        const proteinQuery = this.fetchProteinList();
        if(!!proteinQuery) {
            if (Array.isArray(proteinQuery)) { // cached protein list
                query.whereIn('disease.protein_id', proteinQuery);
            } else {
                query.join(proteinQuery.limit(1000).as("proteinQuery"), 'proteinQuery.protein_id', 'protein.id');
            }
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.protein_id', 'protein.id');
        }
        query.groupBy(['protein.uniprot', 'other.uniprot']);
            // .orderByRaw('score desc');
        // console.log(query.toString());
        return query;
    }

    fetchProteinList(): any {
        if (this.term.length == 0 &&
            this.associatedTarget.length == 0 &&
            this.associatedDisease.length == 0 &&
            this.similarity.match.length == 0 &&
            this.associatedLigand.length == 0 &&
            this.associatedSmiles.length == 0
        ) {
            return null;
        }
        if (this.proteinListCached) {
            return this.proteinList;
        }
        let proteinListQuery;
        if (this.term) {
            proteinListQuery = this.tcrd.getProteinList(this.term);
        } else if (this.associatedTarget) {
            proteinListQuery = this.tcrd.getProteinListFromPPI(this.associatedTarget, this.ppiConfidence);
        } else if (this.similarity.match.length > 0) {
            proteinListQuery = new Jaccard(
                {
                    ...this.similarity,
                    matchQuery: `match(protein.uniprot,protein.sym,protein.stringid) against('${this.similarity.match}' in boolean mode)`
                },
                this.rootTable, this.database, this.databaseConfig).getListQuery(false);
        } else if (this.associatedLigand.length > 0) {
            if (this.associatedSmiles.length > 0) {
                proteinListQuery = this.getListFromAssocLigand().union(this.getListFromPredictor());
            } else {
                proteinListQuery = this.getListFromAssocLigand();
            }
        } else if (this.associatedSmiles.length > 0) {
            proteinListQuery = this.getListFromPredictor();
        }
         else {
            proteinListQuery = this.getDiseaseQuery();
        }
        this.captureQueryPerformance(proteinListQuery, "protein list");
        return proteinListQuery;
    }

    private getListFromPredictor() {
        return this.database('result_cache.predictor_results').distinct('protein_id')
            .where('query_hash', '=', this.database.raw(`"${this.structureQueryHash}"`));
    }

    private getListFromAssocLigand() {
        return this.database({
            ncats_ligands: 'ncats_ligands',
            ncats_ligand_activity: 'ncats_ligand_activity',
            t2tc: 't2tc'
        })
            .distinct('t2tc.protein_id')
            .where('t2tc.target_id', this.database.raw('ncats_ligand_activity.target_id'))
            .where('ncats_ligand_activity.ncats_ligand_id', this.database.raw('ncats_ligands.id'))
            .where('ncats_ligands.identifier', this.associatedLigand);
    }

    getDiseaseQuery() {
        const q = this.database('ncats_p2da').distinct('protein_id').where('name', this.associatedDisease);
        return q;
    }

    cacheProteinList(list: string[]) {
        this.proteinListCached = true;
        this.proteinList = list;
    }

    getBatchQuery(batch: string[]){
        return this.database('protein').distinct({protein_id: 'id'})
            .whereIn('protein.uniprot', batch)
            .orWhereIn('protein.sym', batch)
            .orWhereIn('protein.stringid', batch);
    }

    tableJoinShouldFilterList(sqlTable: SqlTable) {
        if (this.associatedDisease && sqlTable.tableName === 'disease'){
            return true;
        }
        if (this.associatedTarget && sqlTable.tableName === 'ncats_ppi'){
            return true;
        }
        if (this.associatedLigand && (sqlTable.tableName === 'ncats_ligand_activity') && !this.associatedSmiles) {
            return true;
        }
        if (this.associatedSmiles && (sqlTable.tableName === 'predictor_results') && !this.associatedLigand){
            return true;
        }
        return false;
    }

    getSpecialModelWhereClause( fieldInfo: FieldInfo, rootTableOverride: string): string {
        if (this.associatedTarget && (fieldInfo.table === 'ncats_ppi' || rootTableOverride === 'ncats_ppi')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if(modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedTarget;
            }
            return `ncats_ppi.other_id = (select id from protein where match(uniprot,sym,stringid) against('${this.associatedTarget}' in boolean mode))
            and NOT (ncats_ppi.ppitypes = 'STRINGDB' AND ncats_ppi.score < ${this.ppiConfidence})`;
        }
        if (this.associatedDisease && (fieldInfo.table === 'disease' || rootTableOverride === 'disease')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if(modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedDisease;
            }
            return `disease.id in (select disease_assoc_id from ncats_p2da where name = "${this.associatedDisease}")`;
        }
        if (this.associatedLigand && (fieldInfo.table === 'ncats_ligand_activity' || rootTableOverride === 'ncats_ligand_activity')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if(modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedLigand;
            }
            return `ncats_ligand_activity.ncats_ligand_id = (select id from ncats_ligands where identifier = "${this.associatedLigand}")`;
        }
        if (this.associatedSmiles && (fieldInfo.table === 'predictor_results' || rootTableOverride === 'predictor_results')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if(modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedSmiles.length > 30 ? this.associatedSmiles.slice(0, 30) + '...' : this.associatedSmiles;
            }
            return `predictor_results.query_hash = "${this.structureQueryHash}"`;
        }
        return "";
    }


    doSafetyCheck(query: any){
        if(this.fields.includes('Abstract')){
            if(this.top){
                query.limit(Math.min(this.top, 10000));
            }
            else {
                query.limit(10000);
            }
            this.warnings.push('Downloading abstracts is limited to 10,000 rows, due to size.')
        }
        // override to get this to do something
    }
}
