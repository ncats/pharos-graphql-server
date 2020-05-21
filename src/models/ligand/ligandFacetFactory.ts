import {FacetFactory} from "../FacetFactory";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {LigandFacetType} from "./ligandFacetType";

export class LigandFacetFactory extends FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FacetInfo {
        const partialReturn = {
            type: typeName,
            parent: parent,
            allowedValues: allowedValues
        };
        const type: LigandFacetType = (<any>LigandFacetType)[typeName];
        switch (type) {
            case LigandFacetType.Type:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "ncats_ligands",
                        dataColumn: "isDrug",
                        select: "Case When ncats_ligands.isDrug then 'Drug' else 'Ligand' end"
                    } as FacetInfo);
            case LigandFacetType.Activity:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "ncats_ligand_activity",
                    dataColumn: "act_type",
                    whereClause: "act_type not in ('','-')"
                } as FacetInfo);
            case LigandFacetType.Action:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "ncats_ligand_activity",
                        dataColumn: "action_type",
                        whereClause: "action_type is not null"
                    } as FacetInfo);
        }
        return this.unknownFacet();
    }
}
