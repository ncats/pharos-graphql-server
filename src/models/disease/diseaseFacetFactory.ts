import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {DiseaseFacetType} from "./diseaseFacetType";

export class DiseaseFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FacetInfo {
        const partialReturn = {
            type: typeName,
            parent: parent,
            allowedValues: allowedValues
        };
        const type: DiseaseFacetType = (<any>DiseaseFacetType)[typeName];
        switch (type) {
            case DiseaseFacetType["Target Development Level"]:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "target",
                        dataColumn: "tdl"
                    } as FacetInfo);
            case DiseaseFacetType["Data Source"]:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "disease",
                    dataColumn: "dtype",
                    typeModifier: parent.associatedTarget,
                    whereClause: this.getdiseaseWhereClause(parent.associatedTarget)
                } as FacetInfo);
            case DiseaseFacetType.Drug:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "disease",
                    dataColumn: "drug_name",
                    typeModifier: parent.associatedTarget,
                    whereClause: this.getdiseaseWhereClause(parent.associatedTarget, "drug_name is not null")
                } as FacetInfo);
        }
        return this.unknownFacet();
    }

    getdiseaseWhereClause(sym: string, extraClause?: string){
        if (!sym) {
            return extraClause;
        }
        let baseClause = `disease.protein_id = (select id from protein where MATCH (uniprot , sym , stringid) AGAINST ('${sym}' IN BOOLEAN MODE))`;
        if(extraClause) {
            return `${baseClause} and ${extraClause}`;
        }
        return baseClause;
    }
}
