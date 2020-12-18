import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {DiseaseFacetType} from "./diseaseFacetType";

export class DiseaseFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FacetInfo {
        const facet_config = parent.databaseConfig.facetMap.get(`${parent.rootTable}-${typeName}`);
        const partialReturn = this.parse_facet_config(parent, typeName, allowedValues, false, facet_config);

        const type: DiseaseFacetType = (<any>DiseaseFacetType)[typeName];
        switch (type) {
            case DiseaseFacetType["Data Source"]:
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: this.getdiseaseWhereClause(parent.associatedTarget)
                } as FacetInfo);
            case DiseaseFacetType.Drug:
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: this.getdiseaseWhereClause(parent.associatedTarget, "drug_name is not null")
                } as FacetInfo);
        }
        return new FacetInfo(partialReturn);
    }

    getdiseaseWhereClause(sym: string, extraClause?: string) {
        if (!sym) {
            return extraClause;
        }
        let baseClause = `disease.protein_id = (select id from protein where MATCH (uniprot , sym , stringid) AGAINST ('${sym}' IN BOOLEAN MODE))`;
        if (extraClause) {
            return `${baseClause} and ${extraClause}`;
        }
        return baseClause;
    }
}
