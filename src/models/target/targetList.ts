import {TargetFacetFactory} from "./targetFacetFactory";
import {TargetFacetType} from "./targetFacetType";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {ConfigKeys} from "../config";

export class TargetList extends DataModelList {
    batch: string[] = [];
    skip: number = 0;
    top: number = 10;
    proteinList: string[] = [];
    proteinListCached: boolean = false;

    defaultSortParameters(): {column: string; order: string}[] {
        if(this.term){
            return [{column:'min_score', order:'asc'},{column:'name', order:'asc'}];
        }
        else if(this.associatedTarget){
            return [{column:'p_int', order:'desc'},{column:'score', order:'desc'}];
        }
        return [{column:'novelty', order:'desc'}];
    }

    constructor(tcrd: any, json: any) {
        super(tcrd,"protein", "id", new TargetFacetFactory(), json);
        if (json && json.batch) {
            this.batch = json.batch;
        }

        let facetList: string[];
        if (!json || !json.facets || json.facets.length == 0) {
            if(this.associatedTarget){
                facetList = this.DefaultPPIFacets;
            }
            else {
                facetList = this.DefaultFacets;
            }
        } else if (json.facets == "all") {
            facetList = this.AllFacets;
        } else {
            facetList = json.facets;
        }
        this.facetsToFetch = FacetInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, facetList, this.isNull())));

        if (json) {
            this.skip = json.skip;
            this.top = json.top;
        }
    }

    listQueryKey() {
        if(this.associatedTarget){
            return ConfigKeys.Target_List_PPI;
        }
        return ConfigKeys.Target_List_Default;
    }

    addModelSpecificFiltering(query: any, list: boolean = false): void {
        if(list && this.term.length > 0) {
            query.join(this.tcrd.getScoredProteinList(this.term).as("searchQuery"), 'searchQuery.protein_id', 'protein.id');
        } else {
            if(!list || !this.associatedTarget) {
                this.addProteinListConstraint(query, this.fetchProteinList());
            }
        }
        this.addBatchConstraint(query, this.batch);
    }

    addLinkToRootTable(query: any, facet: FacetInfo): void {  // TODO, use database.ts instead, maybe we don't need this at all
        if (facet.dataTable == 'target') {
            query.andWhere('target.id', this.database.raw('t2tc.target_id'))
                .andWhere('protein.id', this.database.raw('t2tc.protein_id'));
        } else if (facet.dataTable == 'ncats_idg_list_type') {
            query.andWhere('protein.id', this.database.raw('ncats_idg_list.protein_id'))
                .andWhere('ncats_idg_list_type.id', this.database.raw('ncats_idg_list.idg_list'));
        } else if (facet.type == "IMPC Phenotype") {
            query.andWhere('ortholog.geneid', this.database.raw('nhprotein.geneid'))
                .andWhere('ortholog.taxid', this.database.raw('nhprotein.taxid'))
                .andWhere('nhprotein.id', this.database.raw('phenotype.nhprotein_id'))
                .andWhere('protein.id', this.database.raw('ortholog.protein_id'));
        } else { // default is to use protein_id column from keyTable
            query.andWhere('protein.id', this.database.raw(facet.dataTable + '.protein_id'));
        }
    }

    getRequiredTablesForFacet(info: FacetInfo): string[] {  // TODO this too
        let tableList = [];
        tableList.push(this.rootTable);
        if (info.dataTable == this.rootTable) {
            return tableList;
        }
        tableList.push(info.dataTable);
        switch (info.dataTable) {
            case "target":
                tableList.push("t2tc");
                break;
            case "ncats_idg_list_type":
                tableList.push("ncats_idg_list");
                break;
        }
        if (info.type == "IMPC Phenotype") {
            tableList.push("nhprotein");
            tableList.push("ortholog");
        }
        return tableList;
    }

    fetchProteinList(): any {
        if (this.term.length == 0 && this.associatedTarget.length == 0) {
            return null;
        }
        if (this.proteinListCached) {
            return this.proteinList;
        }
        let proteinListQuery;
        if (this.term) {
            proteinListQuery = this.tcrd.getProteinList(this.term);
        } else {
            proteinListQuery = this.tcrd.getProteinListFromPPI(this.associatedTarget, this.ppiConfidence);
        }
        this.captureQueryPerformance(proteinListQuery, "protein list");
        return proteinListQuery;
    }

    cacheProteinList(list: string[]) {
        this.proteinListCached = true;
        this.proteinList = list;
    }

    addBatchConstraint(query: any, batch: string[]) {
        if (!!batch && batch.length > 0) {
            query.andWhere
            (function (builder: any) {
                builder.whereIn('protein.uniprot', batch)
                    .orWhereIn('protein.sym', batch)
                    .orWhereIn('protein.stringid', batch)
            });
        }
    };

    addProteinListConstraint(query: any, proteinList: any) {
        if (!!proteinList) {
            query.whereIn('protein.id', proteinList);
        }
    };

    isNull() {
        if (this.batch.length > 0) {
            return false;
        }
        if (this.term.length > 0) {
            return false;
        }
        if(this.associatedTarget.length > 0) {
            return false;
        }
        if (this.filteringFacets.length > 0) {
            return false;
        }
        return true;
    }

    AllFacets = Object.keys(TargetFacetType).filter(key => isNaN(Number(key)));

    DefaultPPIFacets = [
        "PPI Data Source",
        "Target Development Level",
        'Family',
        "IDG Target Lists",
        "Reactome Pathway",
        "GO Process",
        "GO Component",
        "GO Function",
        "UniProt Disease",
        "Expression: UniProt Tissue",
        "Ortholog"];

    DefaultFacets =
        [
            'Target Development Level',
            'IDG Target Lists',
            'Family',
            'IMPC Phenotype',
            'GWAS',
            'Expression: Consensus',
            'Ortholog',
            'UniProt Disease',
            'UniProt Keyword'
        ];
}
