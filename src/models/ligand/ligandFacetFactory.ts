import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FacetDataType, FacetInfo} from "../FacetInfo";
import {LigandFacetType} from "./ligandFacetType";

export class LigandFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FacetInfo {
        const facet_config = parent.databaseConfig.facetMap.get(`${parent.rootTable}-${typeName}`);
        const partialReturn = this.parse_facet_config(parent, typeName, allowedValues, false, facet_config);

        const type: LigandFacetType = (<any>LigandFacetType)[typeName];
        switch (type) {
            case LigandFacetType.Activity:
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: this.getActivityWhereClause(parent.associatedTarget, "act_type not in ('','-')")
                } as FacetInfo);
            case LigandFacetType.Action:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        typeModifier: parent.associatedTarget,
                        whereClause: this.getActivityWhereClause(parent.associatedTarget, "action_type is not null")
                    } as FacetInfo);
            case LigandFacetType.EC50:
            case LigandFacetType.IC50:
            case LigandFacetType.Kd:
            case LigandFacetType.Ki:
                if (!parent.associatedTarget) {
                    return this.unknownFacet();
                }
                return new FacetInfo(
                    {
                        ...partialReturn,
                        typeModifier: parent.associatedTarget,
                        whereClause: this.getActivityWhereClause(parent.associatedTarget, `act_type = '${typeName}'`)
                    } as FacetInfo);
        }
        return new FacetInfo(partialReturn);
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
