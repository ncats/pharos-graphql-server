import {TargetFacetFactory} from "./targetFacetFactory";
import {TargetFacetType} from "./targetFacetType";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";

export class TargetList extends DataModelList {
    batch: string[] = [];
    skip: number = 0;
    top: number = 10;
    proteinList: string[] = [];
    proteinListCached: boolean = false;

    constructor(json: any) {
        super("protein", "id", new TargetFacetFactory(), json);
        if (json && json.batch) {
            this.batch = json.batch;
        }

        if (!json || !json.facets || json.facets.length == 0) {
            this.facetsToFetch = FacetInfo.deduplicate(
                this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, this.DefaultFacets, this.isNull())));
        } else if (json.facets == "all") {
            this.facetsToFetch = FacetInfo.deduplicate(
                this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, this.AllFacets, this.isNull())));
        } else {
            this.facetsToFetch = FacetInfo.deduplicate(
                this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, json.facets, this.isNull())));
        }

        if(json) {
            this.skip = json.skip;
            this.top = json.top;
        }
    }

    addModelSpecificConstraints(query: any, tcrd: any): void {
        this.addBatchConstraint(query, this.batch);
        this.addProteinListConstraint(query, this.fetchProteinList(tcrd));
    }

    addLinkToRootTable(query: any, db: any, facet: FacetInfo): void {
        if (facet.dataTable == 'target') {
            query.andWhere('target.id', db.db.raw('t2tc.target_id'))
                .andWhere('protein.id', db.db.raw('t2tc.protein_id'));
        } else if (facet.dataTable == 'ncats_idg_list_type') {
            query.andWhere('protein.id', db.db.raw('ncats_idg_list.protein_id'))
                .andWhere('ncats_idg_list_type.id', db.db.raw('ncats_idg_list.idg_list'));
        } else if (facet.type == "IMPC Phenotype") {
            query.andWhere('ortholog.geneid', db.db.raw('nhprotein.geneid'))
                .andWhere('ortholog.taxid', db.db.raw('nhprotein.taxid'))
                .andWhere('nhprotein.id', db.db.raw('phenotype.nhprotein_id'))
                .andWhere('protein.id', db.db.raw('ortholog.protein_id'));
        } else { // default is to use protein_id column from keyTable
            query.andWhere('protein.id', db.db.raw(facet.dataTable + '.protein_id'));
        }
    }

    getRequiredTablesForFacet(info: FacetInfo): string[] {
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

    fetchProteinList(tcrd: any): any {
        if (this.term.length == 0) {
            return null;
        }
        if (this.proteinListCached) {
            return this.proteinList;
        }
        let proteinListQuery = tcrd.getProteinList(this.term);
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
        if (this.filteringFacets.length > 0) {
            return false;
        }
        return true;
    }

    AllFacets = Object.keys(TargetFacetType).filter(key => isNaN(Number(key)));

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