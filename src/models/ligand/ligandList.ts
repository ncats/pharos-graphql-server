import {DataModelList} from "../DataModelList";
import {FacetDataType, FieldInfo} from "../FieldInfo";
import {SqlTable} from "../sqlTable";
import {StructureSearch} from "../externalAPI/StructureSearch";

export class LigandList extends DataModelList {
    static getAutocomplete(knex: any, term: string) {
        let query = knex("ncats_ligands")
            .select({value: knex.raw('distinct name'), source: knex.raw("'Ligand'")})
            .where('name', 'not like', 'chembl%')
            .andWhere('name', 'like', '%' + term + '%')
            .orderByRaw(`CASE WHEN name LIKE '${term}%' THEN 1
                              WHEN name LIKE '% ${term}%' THEN 2
                              ELSE 3 END, name`)
            .limit(10);
        return query;
    }

    constructor(tcrd: any, json: any) {
        super(tcrd, 'Ligand', json);
    }



    getTargetActivityDetails(identifier: string, uniprot: string): any {
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

    getAllTargetActivities(): any {
        const query = this.database({protein: 'protein', t2tc: 't2tc', ncats_ligand_activity: 'ncats_ligand_activity', ncats_ligands: 'ncats_ligands'})
            .select(['ncats_ligand_id', 't2tc.target_id', 'ncats_ligands.identifier', 'ncats_ligands.smiles', 'ncats_ligands.name', 'protein.sym', 'protein.uniprot'])
            .avg({mean: 'act_value'})
            .select({std: this.database.raw('std(act_value)')})
            .count({count: 'act_value'})
            .select({references: this.database.raw('group_concat(distinct reference)')})
            .select({pmids: this.database.raw('group_concat(distinct pubmed_ids)')})
            .where('ncats_ligand_activity.target_id', this.database.raw('t2tc.target_id'))
            .andWhere('ncats_ligands.id', this.database.raw('ncats_ligand_activity.ncats_ligand_id'))
            .andWhere('t2tc.protein_id', this.database.raw('protein.id'))
            // .whereNotNull('act_value')
            .limit(10000);
        this.addFacetConstraints(query, this.filteringFacets);
        this.addModelSpecificFiltering(query, false);
        query.groupBy(['ncats_ligand_id', 't2tc.target_id'])
            .orderByRaw('count(distinct protein.id) desc');
        console.log(query.toString());
        return query;
    }

    getSimilarLigands() {
        const sSearch = new StructureSearch(this.database, this.associatedSmiles, this.associatedStructureMethod);
        this.structureQueryHash = sSearch.queryHash;
        return sSearch.getSimilarStructures();
    }

    defaultSortParameters(): { column: string; order: string }[] {
        if (this.fields.length > 0) {
            return [{column: 'id', order: 'asc'}];
        }
        if (this.associatedSmiles) {
            return [{column: 'similarity', order: 'desc'}];
        }
        return [{column: 'targetCount', order: 'desc'}];
    };

    addModelSpecificFiltering(query: any, list: boolean): void {
        if (this.associatedTarget) {
            if (!this.filterAppliedOnJoin(query, 'ncats_ligand_activity')) {
                let associatedTargetQuery = this.database({
                    ncats_ligands: "ncats_ligands",
                    ncats_ligand_activity: "ncats_ligand_activity",
                    t2tc: "t2tc",
                    protein: "protein"
                })
                    .distinct("ncats_ligands.identifier")
                    .whereRaw(this.database.raw(`match(uniprot,sym,stringid) against("${this.associatedTarget}" in boolean mode)`))
                    .andWhere(this.database.raw(`ncats_ligands.id = ncats_ligand_activity.ncats_ligand_id`))
                    .andWhere(this.database.raw(`ncats_ligand_activity.target_id = t2tc.target_id`))
                    .andWhere(this.database.raw(`t2tc.protein_id = protein.id`)).as('assocTarget');
                query.join(associatedTargetQuery, 'assocTarget.identifier', 'ncats_ligands.identifier');
            }
        } else if (this.term.length > 0) {
            query.whereRaw(`match(ncats_ligands.name, ChEMBL, PubChem, \`Guide to Pharmacology\`, DrugCentral) against("${this.term}*" in boolean mode)`)
                .orWhere('identifier', this.term)
                .orWhere('unii', this.term)
                .orWhere('pt', this.term);
        } else if (this.associatedSmiles) {
            if (!this.filterAppliedOnJoin(query, 'structure_search_results')) {
                const that = this;
                query.join('result_cache.structure_search_results', function (this: any) {
                    this.on('structure_search_results.ncats_ligand_id', that.keyString());
                    this.andOn('structure_search_results.query_hash', '=', that.database.raw(`"${that.structureQueryHash}"`));
                });
            }
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.ligand_id', this.keyString());
        }
    }

    getBatchQuery(batch: string[]) {
        const query = this.database('ncats_ligands').distinct({ligand_id: 'id'})
            .whereIn('identifier', batch)
            .orWhereIn('name', batch)
            .orWhereIn('unii', batch)
            .orWhereIn('pt', batch);
        batch.forEach(id => {
            if (id.startsWith('CHEMBL')) {
                query.orWhere('ChEMBL', 'like', `%${id}%`);
            }
        });
        return query;
    }

    tableJoinShouldFilterList(sqlTable: SqlTable) {
        if (this.associatedTarget && (sqlTable.tableName === 'protein' || sqlTable.tableName === 'target' || sqlTable.tableName === 'ncats_ligand_activity')) {
            return true;
        }
        if (this.associatedSmiles && (sqlTable.tableName === 'structure_search_results')){
            return true;
        }
        return false;
    }

    getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string {
        if (this.associatedTarget && (fieldInfo.table === 'ncats_ligand_activity' || rootTableOverride === 'ncats_ligand_activity')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if (modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedTarget;
            }
            return `ncats_ligand_activity.target_id = (
                SELECT t2tc.target_id 
                FROM protein, t2tc 
                WHERE MATCH (uniprot , sym , stringid) 
                AGAINST ('${this.associatedTarget}' IN BOOLEAN MODE) 
                AND t2tc.protein_id = protein.id)`;
        }
        if (this.associatedSmiles && (fieldInfo.table === 'structure_search_results' || rootTableOverride === 'structure_search_results')) {
            return `structure_search_results.query_hash = "${this.structureQueryHash}"`;
        }
        return "";
    }
}

