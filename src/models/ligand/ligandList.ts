import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";
import {SqlTable} from "../sqlTable";

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
        let facetList: string[];
        if (this.associatedTarget) {
            facetList = this.DefaultFacetsWithTarget;
        } else {
            facetList = this.DefaultFacets;
        }
        this.facetsToFetch = FieldInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, facetList)));
    }

    get DefaultFacetsWithTarget() {
        return this.databaseConfig.getDefaultFields('Ligand', 'facet', 'Target')
            .map(a => a.name) || [];
    };

    defaultSortParameters(): { column: string; order: string }[] {
        if (this.fields.length > 0) {
            return [{column: 'id', order: 'asc'}];
        }
        return [{column: 'actcnt', order: 'desc'}];
    };

    getAvailableListFields(): FieldInfo[] {
        if (this.associatedTarget) {
            const fieldList = this.databaseConfig.getAvailableFields('Ligand', 'list', 'Target');
            return fieldList;
        }
        return this.databaseConfig.getAvailableFields('Ligand', 'list');
    }

    addModelSpecificFiltering(query: any, list: boolean, tables: string[]): void {
        if (this.associatedTarget) {
            if(!tables.includes('ncats_ligand_activity')) {
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
            query.whereRaw(`match(name, ChEMBL, PubChem, \`Guide to Pharmacology\`, DrugCentral) against("${this.term}*")`);
        }
        if (this.batch && this.batch.length > 0) {
            query.join(this.getBatchQuery(this.batch).as('batchQuery'), 'batchQuery.ligand_id', this.keyString());
        }
    }

    getBatchQuery(batch: string[]){
        return this.database('ncats_ligands').distinct({ligand_id: 'id'})
            .whereIn('identifier', batch)
            .orWhereIn('name', batch);
    }

    tableNeedsInnerJoin(sqlTable: SqlTable) {
        if (this.associatedTarget && (sqlTable.tableName === 'protein' || sqlTable.tableName === 'target' || sqlTable.tableName === 'ncats_ligand_activity')) {
            return true;
        }
        return false;
    }

    getSpecialModelWhereClause( fieldInfo: FieldInfo, rootTableOverride: string): string {
        if (this.associatedTarget && (fieldInfo.table === 'ncats_ligand_activity' || rootTableOverride === 'ncats_ligand_activity')) {
            const modifiedFacet = this.facetsToFetch.find(f => f.name === fieldInfo.name);
            if(modifiedFacet) {
                modifiedFacet.typeModifier = this.associatedTarget;
            }
            return `ncats_ligand_activity.target_id = (
                SELECT t2tc.target_id 
                FROM protein, t2tc 
                WHERE MATCH (uniprot , sym , stringid) 
                AGAINST ('${this.associatedTarget}' IN BOOLEAN MODE) 
                AND t2tc.protein_id = protein.id)`;
        }
        return "";
    }
}

