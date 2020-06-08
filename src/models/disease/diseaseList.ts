import {DataModelList} from "../DataModelList";
import {DiseaseFacetType} from "./diseaseFacetType";
import {FacetInfo} from "../FacetInfo";
import {DiseaseFacetFactory} from "./diseaseFacetFactory";
import {ConfigKeys} from "../config";

export class DiseaseList extends DataModelList{
    constructor(tcrd: any, json: any) {
        super(tcrd, "disease" , "ncats_name", new DiseaseFacetFactory(), json);

        let facetList: string[];
        if(this.associatedTarget){
            facetList = this.DefaultFacetsWithTarget;
        }
        else {
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

    listQueryKey() {return ConfigKeys.Disease_List_Default};

    addLinkToRootTable(query: any, facet: FacetInfo): void {
        if (facet.dataTable == 'target') {
            query.andWhere('target.id', this.database.raw('t2tc.target_id'))
                .andWhere('disease.protein_id', this.database.raw('t2tc.protein_id'));
        }
    }

    addModelSpecificFiltering(query: any): void {
        if(this.associatedTarget){
            query.join(this.getAssociatedTargetQuery().as('assocTarget'), 'assocTarget.name', this.keyString());
        }
        if(this.term.length > 0){
            query.andWhere(this.database.raw(`match(disease.ncats_name, disease.description, disease.drug_name) against("${this.term}" in boolean mode)`));
        }
    }

    getAssociatedTargetQuery(): any {
        return this.database({disease:"disease", protein:"protein"})
            .distinct({name:this.keyString()}).count('* as associationCount')
            .whereRaw(this.database.raw(`match(uniprot,sym,stringid) against('${this.associatedTarget}' in boolean mode)`))
            .andWhere(this.database.raw(`disease.protein_id = protein.id`))
            .groupBy('name')
            .orderBy("associationCount","desc");
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

