import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";
import {FacetFactory} from "../FacetFactory";

export class TargetFacetFactory extends FacetFactory {

    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean = false): FieldInfo {
        const fieldInfo = parent.databaseConfig.getOneField('Target', 'facet', parent.getAssociatedModel(), '', typeName);
        if(!fieldInfo){
            return this.unknownFacet();
        }
        fieldInfo.allowedValues = allowedValues;
        fieldInfo.parent = parent;
        if (typeName === "PPI Data Source") { // :(
            fieldInfo.valuesDelimited = true;
        }
        return fieldInfo;
    }
}
