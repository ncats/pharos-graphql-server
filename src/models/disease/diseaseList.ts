import {DataModelList} from "../DataModelList";
import {DiseaseFacetType} from "./diseaseFacetType";
import {FacetInfo} from "../FacetInfo";
import {DiseaseFacetFactory} from "./diseaseFacetFactory";
import {ConfigKeys} from "../config";

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
            .where("name", diseaseName);
        let query = knex({lst: 'ncats_do', finder: finderQuery})
            .select('lst.name')
            .where('finder.lft', '<=', knex.raw('lst.lft'))
            .andWhere('finder.rght', '>=', knex.raw('lst.rght'));
        return query;
    }

    constructor(tcrd: any, json: any) {
        super(tcrd, "disease", "ncats_name", new DiseaseFacetFactory(), json);

        let facetList: string[];
        if (this.associatedTarget) {
            facetList = this.DefaultFacetsWithTarget;
        } else {
            facetList = this.DefaultFacets;
        }
        this.facetsToFetch = FacetInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, facetList)));
    }
    AllFacets = Object.keys(DiseaseFacetType).filter(key => isNaN(Number(key)));
    DefaultFacets = this.AllFacets;
    DefaultFacetsWithTarget = [
        "Data Source",
        "Drug"];

    defaultSortParameters(): {column: string; order: string}[]
    {
        return [{column: 'count', order: 'desc'}]
    };

    listQueryKey() {
        return ConfigKeys.Disease_List_Default
    };

    addLinkToRootTable(query: any, facet: FacetInfo): void {
        if (facet.dataTable == 'target') {
            query.andWhere('target.id', this.database.raw('t2tc.target_id'))
                .andWhere('disease.protein_id', this.database.raw('t2tc.protein_id'));
        }
    }

    addModelSpecificFiltering(query: any): void {
        if (this.associatedTarget) {
            query.join(this.getAssociatedTargetQuery().as('assocTarget'), 'assocTarget.name', this.keyString());
        }
        if (this.term.length > 0) {
            query.andWhere(this.database.raw(`match(disease.ncats_name, disease.description, disease.drug_name) against("${this.term}" in boolean mode)`));
        }
    }

    getAssociatedTargetQuery(): any {
        return this.database({disease: "disease", protein: "protein"})
            .distinct({name: this.keyString()}).count('* as associationCount')
            .whereRaw(this.database.raw(`match(uniprot,sym,stringid) against('${this.associatedTarget}' in boolean mode)`))
            .andWhere(this.database.raw(`disease.protein_id = protein.id`))
            .groupBy('name')
            .orderBy("associationCount", "desc");
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
        }

        return tableList;
    }
}

