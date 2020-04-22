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
                    dataColumn: "dtype"
                } as FacetInfo);
            case DiseaseFacetType.Drug:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "disease",
                    dataColumn: "drug_name",
                    whereClause: "drug_name is not null"
                } as FacetInfo);
        }
        return this.unknownFacet();
    }
}