import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";

export class LigandFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FieldInfo {
        const fieldInfo = parent.databaseConfig.getOneField('Disease', 'facet', parent.getAssociatedModel(), '', typeName);
        if(!fieldInfo){
            return this.unknownFacet();
        }

        switch (typeName) {
            case "Activity":
                fieldInfo.typeModifier = parent.associatedTarget;
                fieldInfo.where_clause = this.getActivityWhereClause(parent.associatedTarget, "act_type not in ('','-')") || fieldInfo.where_clause;
            case "Action":
                fieldInfo.typeModifier = parent.associatedTarget;
                fieldInfo.where_clause = this.getActivityWhereClause(parent.associatedTarget, "action_type is not null") || fieldInfo.where_clause;
            case "EC50":
            case "IC50":
            case "Kd":
            case "Ki":
                if (!parent.associatedTarget) {
                    return this.unknownFacet();
                }
                fieldInfo.typeModifier = parent.associatedTarget;
                fieldInfo.where_clause = this.getActivityWhereClause(parent.associatedTarget, `act_type = '${typeName}'`) || fieldInfo.where_clause;
        }
        return fieldInfo;
    }

    getActivityWhereClause(sym: string, extraClause?: string){
        if (!sym) {
            return extraClause;
        }
        let baseClause = `ncats_ligand_activity.target_id = (SELECT t2tc.target_id FROM protein, t2tc 
                            WHERE MATCH (uniprot , sym , stringid) 
                            AGAINST ('${sym}' IN BOOLEAN MODE) AND t2tc.protein_id = protein.id)`;
        if(extraClause) {
            return `${baseClause} and ${extraClause}`;
        }
        return baseClause;
    }
}
