import {DataModelList} from "../DataModelList";
import {DiseaseFacetType} from "./diseaseFacetType";
import {FacetInfo} from "../FacetInfo";
import {DiseaseFacetFactory} from "./diseaseFacetFactory";
import {ConfigKeys} from "../config";

export class DiseaseList extends DataModelList{
    constructor(tcrd: any, json: any) {
        super(tcrd, "disease" , "name", new DiseaseFacetFactory(), json);
        this.facetsToFetch = FacetInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, this.DefaultFacets)));
    }
    AllFacets = Object.keys(DiseaseFacetType).filter(key => isNaN(Number(key)));
    DefaultFacets = this.AllFacets;

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
            let associatedTargetQuery = this.database({disease:"disease", protein:"protein"})
                .distinct("disease.name").whereRaw(this.database.raw(`match(uniprot,sym,stringid) against('${this.associatedTarget}' in boolean mode)`)).
            andWhere(this.database.raw(`disease.protein_id = protein.id`)).as('assocTarget');
            query.join(associatedTargetQuery, 'assocTarget.name', 'disease.name');
        }
        if(this.term.length > 0){
            query.andWhere(this.database.raw(`match(disease.name, disease.description, disease.drug_name) against('${this.term}' in boolean mode)`));
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
        }

        return tableList;
    }
}

