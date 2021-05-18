import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";
import {SqlTable} from "../sqlTable";

export class DiseaseList extends DataModelList {

    static getAssociationDetails(knex: any, diseaseName: string, targetId: number) {
        let descendentQuery = DiseaseList.getDescendentsQuery(knex, diseaseName);
        return knex({disease: "disease", t2tc: "t2tc"})
            .select({name: "ncats_name", dataType: "dtype", evidence: "evidence", zscore: "zscore",
                conf: "conf", reference: "reference", drug_name: "drug_name", log2foldchange: "log2foldchange",
                pvalue: "pvalue", score: "score", source: "source", O2S: "O2S", S2O: "S2O"})
            .where("t2tc.target_id",targetId)
            .andWhere("disease.protein_id",knex.raw("t2tc.protein_id"))
            .whereIn("disease.ncats_name",descendentQuery);
    }

    static getDescendentsQuery(knex: any, diseaseName: string) {
        let finderQuery = knex("ncats_do")
            .min({lft: 'lft', rght: 'rght'})
            .whereRaw(`name = ?`, diseaseName);
        let query = knex({lst: 'ncats_do', finder: finderQuery})
            .select('lst.name')
            .where('finder.lft', '<=', knex.raw('lst.lft'))
            .andWhere('finder.rght', '>=', knex.raw('lst.rght'));
        return query;
    }

    static getTinxQuery(knex: any, diseaseName: string) {
        let doidList = knex("disease")
            .distinct('did')
            .whereIn('ncats_name', DiseaseList.getDescendentsQuery(knex, diseaseName));
        let tinxQuery = knex({target: "target", t2tc:"t2tc", tinx_novelty:"tinx_novelty", tinx_importance:"tinx_importance", tinx_disease:"tinx_disease"})
            .select({
                targetID: 'target.id',
                targetName: 'target.name',
                tdl: 'target.tdl',
                novelty:knex.raw('(tinx_novelty.score)'),
                doid:knex.raw('(tinx_disease.doid)'),
                name:knex.raw('(tinx_disease.name)'),
                importance:knex.raw('(tinx_importance.score)')
            })
            .join(doidList.as('idList'), 'idList.did', 'tinx_disease.doid')
            .where(knex.raw('tinx_importance.doid = tinx_disease.doid'))
            .andWhere(knex.raw('tinx_importance.protein_id = t2tc.protein_id'))
            .andWhere(knex.raw('tinx_importance.protein_id = tinx_novelty.protein_id'))
            .andWhere(knex.raw('t2tc.target_id = target.id'));
        return tinxQuery;
    }

    constructor(tcrd: any, json: any) {
        super(tcrd, 'Disease', json);
    }

    defaultSortParameters(): {column: string; order: string}[]
    {
        if (this.fields.length > 0) {
            return [{column: 'id', order: 'asc'}];
        }
        return [{column: 'count', order: 'desc'}]
    };

    addModelSpecificFiltering(query: any, list: boolean): void {
        if (this.term.length > 0) {
            query.join(this.getTermQuery().as('termSearch'), 'termSearch.id', this.keyString());
        }
        if (this.associatedTarget) {
            if (!this.filterAppliedOnJoin(query, 'protein') &&
                !this.filterAppliedOnJoin(query, 'target') &&
                !this.filterAppliedOnJoin(query, 'disease')) {
                query.join(this.getAssociatedTargetQuery().as('assocTarget'), 'assocTarget.name', this.keyString());
            }
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.disease_id', this.keyString());
        }
    }

    getBatchQuery(batch: string[]){
        return this.database('ncats_disease').distinct({disease_id: 'id'})
            .whereIn('name', batch);
    }

    getTermQuery(){
        return this.database({ncats_disease: 'ncats_disease', ncats_d2da: 'ncats_d2da', disease: 'disease'})
            .distinct({id: 'ncats_disease.id'})
            .whereRaw(`match(disease.ncats_name, disease.description, disease.drug_name) against("${this.term}*" in boolean mode)`)
            .andWhere('ncats_disease.id', this.database.raw('ncats_d2da.ncats_disease_id'))
            .andWhere('ncats_d2da.disease_assoc_id', this.database.raw('disease.id'));
    }

    getAssociatedTargetQuery(): any {
        return this.database({ncats_disease: 'ncats_disease', ncats_d2da: 'ncats_d2da', disease: 'disease', protein: 'protein'})
            .distinct({name: this.keyString()}).count('* as associationCount')
            .whereRaw(this.database.raw(`match(uniprot,sym,stringid) against("${this.associatedTarget}" in boolean mode)`))
            .andWhere('ncats_disease.id', this.database.raw('ncats_d2da.ncats_disease_id'))
            .andWhere('ncats_d2da.disease_assoc_id', this.database.raw('disease.id'))
            .andWhere('disease.protein_id', this.database.raw(`protein.id`))
            .groupBy('name')
            .orderBy("associationCount", "desc");
    }

    tableJoinShouldFilterList(sqlTable: SqlTable) {
        if (this.associatedTarget && (sqlTable.tableName === 'protein' || sqlTable.tableName === 'target' || sqlTable.tableName === 'disease')) {
            return true;
        }
        return false;
    }

    getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string {
        if (this.associatedTarget && (
            fieldInfo.table === 'protein' || rootTableOverride === 'protein' ||
            fieldInfo.table === 'target' || rootTableOverride === 'target' ||
            fieldInfo.table === 'disease' || rootTableOverride === 'disease')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if(modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedTarget;
            }
            return `disease.protein_id = (select id from protein where MATCH (uniprot , sym , stringid) AGAINST ('${this.associatedTarget}' IN BOOLEAN MODE))`;
        }
        return "";
    }

}

