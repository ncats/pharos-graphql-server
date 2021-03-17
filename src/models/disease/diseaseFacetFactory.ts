import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";

export class DiseaseFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FieldInfo {
        const fieldInfo = parent.databaseConfig.getOneField('Disease', 'facet', parent.getAssociatedModel(), '', typeName);
        if(!fieldInfo){
            return this.unknownFacet();
        }

        switch (typeName) {
            case "Data Source":
                fieldInfo.typeModifier = parent.associatedTarget;
                fieldInfo.where_clause = this.getdiseaseWhereClause(parent.associatedTarget) || fieldInfo.where_clause;
            case "Drug":
                fieldInfo.typeModifier = parent.associatedTarget;
                fieldInfo.where_clause = this.getdiseaseWhereClause(parent.associatedTarget, "drug_name is not null") || fieldInfo.where_clause;
        }
        return fieldInfo;
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
