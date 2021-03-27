import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";
import {Jaccard} from "../similarTargets/jaccard";
import {SqlTable} from "../sqlTable";

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
            return [{column: 'p_int', order: 'desc'}, {column: 'score', order: 'desc'}];
        }
        if (this.associatedDisease) {
            return [{column: 'datasource_count', order: 'desc'}];
        }
        if (this.similarity.match.length > 0) {
            return [{column: 'jaccard', order: 'desc'}];
        }
        return [{column: 'novelty', order: 'desc'}];
    }

    constructor(tcrd: any, json: any) {
        super(tcrd, 'Target', json);

        let facetList: string[];
        if (!json || !json.facets || json.facets.length == 0) {
            if (this.associatedTarget) {
                facetList = this.DefaultPPIFacets;
            } else if (this.associatedDisease) {
                facetList = this.DefaultDiseaseFacets;
            } else {
                facetList = this.DefaultFacets;
            }
        } else if (json.facets == "all") {
            facetList = this.AllFacets;
        } else {
            facetList = json.facets;
        }
        this.facetsToFetch = FieldInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, facetList, this.isNull())));
    }

    getAvailableListFields(): FieldInfo[] {
        if (this.associatedTarget) {
            return this.databaseConfig.getAvailableFields('Target', 'list', 'Target');
        }
        if (this.associatedDisease) {
            return this.databaseConfig.getAvailableFields('Target', 'list', 'Disease');
        }
        if (this.similarity.match.length > 0) {
            const dataFields = this.databaseConfig.getAvailableFields('Target', 'list', '', 'Similarity');
            dataFields.push({isFromListQuery: true, table: "filterQuery", column: "overlap"} as FieldInfo);
            dataFields.push({isFromListQuery: true, table: "filterQuery", column: "baseSize"} as FieldInfo);
            dataFields.push({isFromListQuery: true, table: "filterQuery", column: "testSize"} as FieldInfo);
            dataFields.push({isFromListQuery: true, table: "filterQuery", column: "commonOptions"} as FieldInfo);
            dataFields.push({isFromListQuery: true, table: "filterQuery", column: "jaccard"} as FieldInfo);
            return dataFields;
        }
        const dataFields = this.databaseConfig.getAvailableFields('Target', 'list');
        if(this.term.length > 0){
            dataFields.push({isFromListQuery: true, table: 'filterQuery', column: 'min_score', alias: 'search_score'} as FieldInfo);
        }
        return dataFields;
    }

    addModelSpecificFiltering(query: any, list: boolean = false, tables: string[]): void {
        let filterQuery;
        if (list) {
            if(this.term.length > 0){
                filterQuery = this.tcrd.getScoredProteinList(this.term);
            }
            else if(this.similarity.match.length > 0) {
                filterQuery = this.getSimilarityQuery();
            }
            else if(this.associatedDisease.length > 0) {
                if(!tables.includes('disease')) {
                    filterQuery = this.fetchProteinList();
                }
            }
            else if(this.associatedTarget.length > 0) {
                if (!tables.includes('ncats_ppi')) {
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

    fetchProteinList(): any {
        if (this.term.length == 0 && this.associatedTarget.length == 0 && this.associatedDisease.length == 0 && this.similarity.match.length == 0) {
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
        } else {
            proteinListQuery = this.getDiseaseQuery();
        }
        this.captureQueryPerformance(proteinListQuery, "protein list");
        return proteinListQuery;
    }

    getDiseaseQuery() {
        return this.database.select(this.database.raw(` 
distinct protein_id
FROM
    disease as d
JOIN (SELECT 
            lst.name
        FROM
            ncats_do lst,
            (SELECT 
                MIN(lft) AS 'lft', MIN(rght) AS 'rght'
            FROM
                ncats_do
            WHERE
                name = "${this.associatedDisease}") AS finder
        WHERE
            finder.lft <= lst.lft
                AND finder.rght >= lst.rght) as diseaseList
ON diseaseList.name = d.ncats_name`));
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

    get DefaultPPIFacets() {
        return this.databaseConfig.getDefaultFields('Target', 'facet', 'Target')
            .sort((a, b) => a.order - b.order)
            .map(a => a.name) || [];
    };

    get DefaultDiseaseFacets() {
        return this.databaseConfig.getDefaultFields('Target', 'facet', 'Disease')
            .sort((a, b) => a.order - b.order)
            .map(a => a.name) || [];
    };

    tableNeedsInnerJoin(sqlTable: SqlTable) {
        if (this.associatedDisease && sqlTable.tableName === 'disease'){
            return true;
        }
        if (this.associatedTarget && sqlTable.tableName === 'ncats_ppi'){
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
            return `disease.ncats_name in (
            SELECT 
                lst.name
            FROM
                ncats_do lst, (SELECT 
                MIN(lft) AS 'lft', MIN(rght) AS 'rght'
            FROM
                ncats_do
            WHERE
                name = "${this.associatedDisease}") AS finder
            WHERE
                finder.lft <= lst.lft
                    AND finder.rght + 0 >= lst.rght)`;
        }
        return "";
    }
}
