import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";

export class DiseaseFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FacetInfo {
        const facet_config = parent.databaseConfig.getFacetConfig(parent.rootTable, typeName);
        const partialReturn = this.parse_facet_config(parent, typeName, allowedValues, false, facet_config);

        switch (typeName) {
            case "Data Source":
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: this.getdiseaseWhereClause(parent.associatedTarget)
                } as FacetInfo);
            case "Drug":
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
